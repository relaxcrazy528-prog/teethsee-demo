from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image, UnidentifiedImageError

from .dataset import LABEL_TO_ID, VALID_LABELS, count_original_coco_group_leakage, load_labelme_dataset
from .splits import assign_grouped_splits, split_summary


DATASET_DOI = "10.5281/zenodo.14827784"


def _write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _scan_images(dataset_root: Path) -> dict[str, object]:
    formats = Counter()
    exif_count = 0
    invalid_count = 0
    total = 0
    for path in sorted((dataset_root / "Images").rglob("*.jpg")):
        total += 1
        try:
            with Image.open(path) as image:
                formats[str(image.format)] += 1
                if image.getexif():
                    exif_count += 1
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError):
            invalid_count += 1
    return {"total": total, "formats": dict(formats), "with_exif": exif_count, "invalid": invalid_count}


def _dataset_fingerprint(samples) -> str:
    digest = hashlib.sha256()
    for sample in sorted(samples, key=lambda item: item.sample_id):
        digest.update(sample.sample_id.encode("ascii"))
        digest.update(sample.group_id.encode("ascii"))
        for box in sample.boxes:
            digest.update(box.label.encode("ascii"))
            digest.update(repr(box.xyxy).encode("ascii"))
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="审计 Dataset2 并生成患者级训练清单")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=20260821)
    args = parser.parse_args()
    dataset_root = args.dataset_root.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        parser.error("输出目录必须不存在或为空，避免覆盖已有清单")
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        samples, audit = load_labelme_dataset(dataset_root)
        assigned = assign_grouped_splits(samples, seed=args.seed)
    except (ValueError, OSError) as exc:
        print(f"数据准备失败：{exc}", file=sys.stderr)
        return 1

    manifest_path = output_dir / "manifest.jsonl"
    with manifest_path.open("w", encoding="utf-8") as handle:
        for sample in assigned:
            record = {
                "sample_id": sample.sample_id,
                "split": sample.split,
                "group_id": sample.group_id,
                "image": sample.image_relative,
                "annotation": sample.annotation_relative,
                "capture_mode": sample.capture_mode,
                "view": sample.view,
                "width": sample.width,
                "height": sample.height,
                "boxes": [{"label": box.label, "xyxy": list(box.xyxy)} for box in sample.boxes],
            }
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    fingerprint = _dataset_fingerprint(assigned)
    report = {
        "schema_version": 1,
        "dataset": {"name": "Annotated intraoral image dataset for dental caries detection", "doi": DATASET_DOI},
        "local_images": _scan_images(dataset_root),
        "annotations": {
            "files": audit.annotation_files,
            "usable_samples": audit.usable_samples,
            "empty_samples": audit.empty_samples,
            "ambiguous_samples": audit.ambiguous_samples,
            "missing_images": audit.missing_images,
            "invalid_annotations": audit.invalid_annotations,
            "invalid_images": audit.invalid_images,
            "valid_boxes": dict(audit.labels),
            "ignored": dict(audit.ignored_shapes),
        },
        "patient_groups": len({sample.group_id for sample in assigned}),
        "original_coco_leakage": count_original_coco_group_leakage(dataset_root, samples),
        "new_splits": split_summary(assigned),
        "dataset_fingerprint": fingerprint,
    }
    metadata = {
        "schema_version": 1,
        "dataset_fingerprint": fingerprint,
        "labels": {"background": 0, **LABEL_TO_ID},
        "label_meanings": {"D": "visible caries in permanent tooth", "d": "visible caries in primary tooth"},
        "valid_labels": list(VALID_LABELS),
        "split_unit": "pseudonymous patient group",
        "seed": args.seed,
    }
    _write_json(output_dir / "dataset-audit.json", report)
    _write_json(output_dir / "dataset-metadata.json", metadata)
    print(json.dumps({"manifest": str(manifest_path), "samples": len(assigned), "fingerprint": fingerprint}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
