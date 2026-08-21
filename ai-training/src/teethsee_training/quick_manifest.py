from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import tempfile


SPLITS = ("train", "valid", "test")
MAX_MANIFEST_BYTES = 32 * 1024 * 1024


def _load_records(path: Path) -> list[dict[str, object]]:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise ValueError("找不到训练清单")
    if resolved.stat().st_size > MAX_MANIFEST_BYTES:
        raise ValueError("训练清单超过 32MB 安全限制")

    records: list[dict[str, object]] = []
    for line_number, line in enumerate(resolved.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"训练清单第 {line_number} 行不是有效 JSON") from exc
        if not isinstance(record, dict):
            raise ValueError(f"训练清单第 {line_number} 行必须是对象")
        if record.get("split") not in SPLITS:
            raise ValueError(f"训练清单第 {line_number} 行含未知数据集划分")
        if not isinstance(record.get("sample_id"), str) or not record["sample_id"]:
            raise ValueError(f"训练清单第 {line_number} 行缺少 sample_id")
        boxes = record.get("boxes")
        if not isinstance(boxes, list):
            raise ValueError(f"训练清单第 {line_number} 行缺少 boxes")
        records.append(record)
    if not records:
        raise ValueError("训练清单为空")
    return records


def _labels(record: dict[str, object]) -> set[str]:
    labels: set[str] = set()
    for box in record["boxes"]:
        if isinstance(box, dict) and box.get("label") in {"D", "d"}:
            labels.add(str(box["label"]))
    return labels


def _stable_shuffle(records: list[dict[str, object]], seed: int, split: str) -> list[dict[str, object]]:
    split_seed = int.from_bytes(hashlib.sha256(f"{seed}:{split}".encode("ascii")).digest()[:8], "big")
    shuffled = list(records)
    random.Random(split_seed).shuffle(shuffled)
    return shuffled


def select_quick_records(
    records: list[dict[str, object]],
    limits: dict[str, int],
    seed: int,
) -> list[dict[str, object]]:
    selected: list[dict[str, object]] = []
    for split in SPLITS:
        candidates = _stable_shuffle([record for record in records if record["split"] == split], seed, split)
        limit = limits[split]
        if limit < 1:
            raise ValueError("每个数据集划分的样本上限必须大于 0")
        if len(candidates) < limit:
            raise ValueError(f"{split} 只有 {len(candidates)} 个样本，少于请求的 {limit} 个")

        rare_target = max(1, limit // 5)
        empty_target = max(1, limit // 16)
        rare = [record for record in candidates if "d" in _labels(record)][: min(rare_target, limit)]
        remaining_slots = limit - len(rare)
        empty = [record for record in candidates if not _labels(record)][: min(empty_target, remaining_slots)]
        chosen_ids = {str(record["sample_id"]) for record in rare + empty}
        remainder = [record for record in candidates if str(record["sample_id"]) not in chosen_ids]
        chosen = rare + empty + remainder[: limit - len(rare) - len(empty)]
        selected.extend(sorted(chosen, key=lambda record: str(record["sample_id"])))
    return selected


def _summary(records: list[dict[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for split in SPLITS:
        split_records = [record for record in records if record["split"] == split]
        result[split] = {
            "samples": len(split_records),
            "D_samples": sum("D" in _labels(record) for record in split_records),
            "d_samples": sum("d" in _labels(record) for record in split_records),
            "empty_samples": sum(not _labels(record) for record in split_records),
        }
    return result


def write_quick_manifest(input_path: Path, output_path: Path, limits: dict[str, int], seed: int) -> dict[str, object]:
    source = input_path.expanduser().resolve()
    destination = output_path.expanduser().resolve()
    if source == destination:
        raise ValueError("快速试训清单不能覆盖原清单")
    if destination.exists():
        raise ValueError("快速试训清单已存在，拒绝覆盖")

    selected = select_quick_records(_load_records(source), limits, seed)
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as handle:
            for record in selected:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        os.replace(temporary_name, destination)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise
    return _summary(selected)


def main() -> int:
    parser = argparse.ArgumentParser(description="从患者级清单生成本地 CPU 快速试训子集")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--train-samples", type=int, default=96)
    parser.add_argument("--valid-samples", type=int, default=24)
    parser.add_argument("--test-samples", type=int, default=24)
    parser.add_argument("--seed", type=int, default=20260821)
    args = parser.parse_args()
    limits = {"train": args.train_samples, "valid": args.valid_samples, "test": args.test_samples}
    try:
        summary = write_quick_manifest(args.manifest, args.output, limits, args.seed)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"manifest": str(args.output.expanduser().resolve()), "summary": summary}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
