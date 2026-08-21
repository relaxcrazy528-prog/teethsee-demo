from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, replace
import hashlib
import json
from pathlib import Path
import re
from typing import Iterable

from PIL import Image, UnidentifiedImageError


VALID_LABELS = ("D", "d")
LABEL_TO_ID = {"D": 1, "d": 2}
MAX_ANNOTATION_BYTES = 2 * 1024 * 1024
TIMESTAMP_PATTERN = re.compile(r"(\d{13})")
EXPLICIT_PATIENT_PATTERN = re.compile(r"^anonymous_([^_]+)_\d{13}_")


class DatasetError(ValueError):
    pass


@dataclass(frozen=True)
class Box:
    label: str
    xyxy: tuple[float, float, float, float]


@dataclass(frozen=True)
class Sample:
    sample_id: str
    image_relative: str
    annotation_relative: str
    capture_mode: str
    view: str
    width: int
    height: int
    boxes: tuple[Box, ...]
    group_key: str
    group_id: str = ""
    split: str = ""


@dataclass
class AuditState:
    annotation_files: int = 0
    usable_samples: int = 0
    empty_samples: int = 0
    ambiguous_samples: int = 0
    missing_images: int = 0
    invalid_annotations: int = 0
    invalid_images: int = 0
    ignored_shapes: Counter[str] | None = None
    labels: Counter[str] | None = None

    def __post_init__(self) -> None:
        self.ignored_shapes = self.ignored_shapes or Counter()
        self.labels = self.labels or Counter()


def _inside(root: Path, candidate: Path) -> Path:
    resolved_root = root.resolve()
    resolved = candidate.resolve()
    if not resolved.is_relative_to(resolved_root):
        raise DatasetError("标注中的图片路径越过了数据集目录")
    return resolved


def _sample_id(annotation_relative: str) -> str:
    return hashlib.sha256(annotation_relative.encode("utf-8")).hexdigest()[:24]


def _read_json(path: Path) -> dict[str, object]:
    if path.stat().st_size > MAX_ANNOTATION_BYTES:
        raise DatasetError("标注文件超过允许大小")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DatasetError("标注文件无法读取") from exc
    if not isinstance(value, dict):
        raise DatasetError("标注根节点必须是对象")
    return value


def _parse_box(shape: object, width: int, height: int, audit: AuditState) -> Box | None:
    if not isinstance(shape, dict):
        audit.ignored_shapes["invalid_shape"] += 1
        return None
    label = str(shape.get("label", ""))
    shape_type = str(shape.get("shape_type", ""))
    if label not in VALID_LABELS:
        audit.ignored_shapes[f"unknown_label:{label or 'empty'}"] += 1
        return None
    if shape_type != "rectangle":
        audit.ignored_shapes[f"shape_type:{shape_type or 'empty'}"] += 1
        return None
    points = shape.get("points")
    if not isinstance(points, list) or len(points) != 2:
        audit.ignored_shapes["invalid_rectangle"] += 1
        return None
    try:
        x1, y1 = (float(value) for value in points[0])
        x2, y2 = (float(value) for value in points[1])
    except (TypeError, ValueError) as exc:
        raise DatasetError("矩形坐标不正确") from exc
    left, right = sorted((max(0.0, x1), min(float(width), x2)))
    top, bottom = sorted((max(0.0, y1), min(float(height), y2)))
    if right - left < 2 or bottom - top < 2:
        audit.ignored_shapes["degenerate_rectangle"] += 1
        return None
    audit.labels[label] += 1
    return Box(label, (left, top, right, bottom))


def _patient_key(filename: str) -> tuple[str | None, int | None]:
    explicit = EXPLICIT_PATIENT_PATTERN.match(filename)
    if explicit:
        return f"explicit:{explicit.group(1)}", None
    timestamp = TIMESTAMP_PATTERN.search(filename)
    return None, int(timestamp.group(1)) if timestamp else None


def _assign_temporal_groups(samples: list[Sample], maximum_gap_minutes: int = 20) -> list[Sample]:
    unresolved: list[tuple[int, int, Sample]] = []
    resolved = list(samples)
    for index, sample in enumerate(samples):
        if sample.group_key:
            continue
        timestamp = TIMESTAMP_PATTERN.search(Path(sample.image_relative).name)
        if timestamp:
            unresolved.append((int(timestamp.group(1)), index, sample))
        else:
            resolved[index] = replace(sample, group_key=f"unparsed:{sample.sample_id}")
    unresolved.sort(key=lambda item: (item[0], item[2].sample_id))
    cluster_number = 0
    previous_timestamp: int | None = None
    view_counts: Counter[str] = Counter()
    cluster_size = 0
    for timestamp, index, sample in unresolved:
        gap_too_large = previous_timestamp is not None and timestamp - previous_timestamp > maximum_gap_minutes * 60_000
        repeated_view = view_counts[sample.view] >= 2
        if previous_timestamp is None or gap_too_large or repeated_view or cluster_size >= 10:
            cluster_number += 1
            view_counts = Counter()
            cluster_size = 0
        key = f"temporal:{cluster_number:05d}"
        resolved[index] = replace(sample, group_key=key)
        view_counts[sample.view] += 1
        cluster_size += 1
        previous_timestamp = timestamp
    return resolved


def _opaque_group_id(group_key: str, seed: str) -> str:
    return hashlib.sha256(f"{seed}:{group_key}".encode("utf-8")).hexdigest()[:20]


def load_labelme_dataset(dataset_root: Path, seed: str = "teethsee-dataset-v1") -> tuple[list[Sample], AuditState]:
    root = dataset_root.resolve()
    images_root = _inside(root, root / "Images")
    annotations_root = _inside(root, root / "Annotations" / "Labelme")
    if not images_root.is_dir() or not annotations_root.is_dir():
        raise DatasetError("数据集必须包含 Images 和 Annotations/Labelme")

    samples: list[Sample] = []
    audit = AuditState()
    for annotation_path in sorted(annotations_root.rglob("*.json")):
        audit.annotation_files += 1
        relative_annotation = annotation_path.relative_to(root).as_posix()
        parts = annotation_path.relative_to(annotations_root).parts
        if len(parts) < 3:
            audit.invalid_annotations += 1
            continue
        capture_mode, view = parts[0], parts[1]
        try:
            data = _read_json(annotation_path)
            image_name = Path(str(data.get("imagePath", ""))).name
            if not image_name:
                image_name = f"{annotation_path.stem}.jpg"
            image_path = _inside(images_root, images_root / capture_mode / view / image_name)
            if not image_path.is_file():
                fallback = _inside(images_root, images_root / capture_mode / view / f"{annotation_path.stem}.jpg")
                image_path = fallback
            if not image_path.is_file():
                audit.missing_images += 1
                continue
            try:
                with Image.open(image_path) as image:
                    if image.format != "JPEG":
                        raise DatasetError("图片不是 JPEG")
                    width, height = image.size
                    image.verify()
            except (UnidentifiedImageError, OSError, ValueError, DatasetError):
                audit.invalid_images += 1
                continue
            declared_width = int(data.get("imageWidth", width))
            declared_height = int(data.get("imageHeight", height))
            if abs(declared_width - width) > 1 or abs(declared_height - height) > 1:
                audit.invalid_annotations += 1
                continue
            shapes = data.get("shapes", [])
            if not isinstance(shapes, list):
                raise DatasetError("shapes 必须是数组")
            boxes = tuple(
                box
                for shape in shapes
                if (box := _parse_box(shape, width, height, audit)) is not None
            )
            if not boxes:
                if shapes:
                    audit.ambiguous_samples += 1
                    continue
                audit.empty_samples += 1
            explicit_key, _ = _patient_key(image_path.name)
            samples.append(
                Sample(
                    sample_id=_sample_id(relative_annotation),
                    image_relative=image_path.relative_to(root).as_posix(),
                    annotation_relative=relative_annotation,
                    capture_mode=capture_mode,
                    view=view,
                    width=width,
                    height=height,
                    boxes=boxes,
                    group_key=explicit_key or "",
                )
            )
        except (DatasetError, OSError, TypeError, ValueError):
            audit.invalid_annotations += 1
    samples = _assign_temporal_groups(samples)
    samples = [replace(sample, group_id=_opaque_group_id(sample.group_key, seed)) for sample in samples]
    audit.usable_samples = len(samples)
    return samples, audit


def count_original_coco_group_leakage(dataset_root: Path, samples: Iterable[Sample]) -> dict[str, int]:
    root = dataset_root.resolve()
    sample_by_name = {Path(sample.image_relative).name: sample for sample in samples}
    group_splits: defaultdict[str, set[str]] = defaultdict(set)
    assigned_images = 0
    for split in ("train", "valid", "test"):
        path = root / "Annotations" / "MS_coco" / f"{split}.json"
        if not path.is_file():
            continue
        try:
            data = _read_json(path)
        except DatasetError:
            continue
        images = data.get("images", [])
        if not isinstance(images, list):
            continue
        for item in images:
            if not isinstance(item, dict):
                continue
            sample = sample_by_name.get(str(item.get("file_name", "")))
            if sample:
                assigned_images += 1
                group_splits[sample.group_id].add(split)
    return {
        "assigned_images": assigned_images,
        "groups": len(group_splits),
        "groups_crossing_splits": sum(len(splits) > 1 for splits in group_splits.values()),
    }
