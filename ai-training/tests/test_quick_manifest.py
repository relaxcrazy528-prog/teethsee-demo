import json
from pathlib import Path

import pytest

from teethsee_training.quick_manifest import select_quick_records, write_quick_manifest


def _record(sample_id: str, split: str, labels: list[str]) -> dict[str, object]:
    return {
        "sample_id": sample_id,
        "split": split,
        "boxes": [{"label": label, "xyxy": [0, 0, 10, 10]} for label in labels],
    }


def test_quick_selection_is_deterministic_and_keeps_rare_and_empty_samples() -> None:
    records = []
    for split in ("train", "valid", "test"):
        records.extend(_record(f"{split}-D-{index}", split, ["D"]) for index in range(20))
        records.extend(_record(f"{split}-d-{index}", split, ["d"]) for index in range(5))
        records.extend(_record(f"{split}-empty-{index}", split, []) for index in range(3))

    limits = {"train": 10, "valid": 8, "test": 8}
    first = select_quick_records(records, limits, seed=7)
    second = select_quick_records(records, limits, seed=7)
    assert first == second
    for split, limit in limits.items():
        chosen = [record for record in first if record["split"] == split]
        assert len(chosen) == limit
        assert any(not record["boxes"] for record in chosen)
        assert any(any(box["label"] == "d" for box in record["boxes"]) for record in chosen)


def test_quick_manifest_refuses_to_overwrite(tmp_path: Path) -> None:
    source = tmp_path / "manifest.jsonl"
    records = []
    for split in ("train", "valid", "test"):
        records.extend(_record(f"{split}-{index}", split, ["D"]) for index in range(2))
    source.write_text("".join(json.dumps(record) + "\n" for record in records), encoding="utf-8")
    output = tmp_path / "quick.jsonl"
    limits = {"train": 1, "valid": 1, "test": 1}
    write_quick_manifest(source, output, limits, seed=1)
    with pytest.raises(ValueError, match="拒绝覆盖"):
        write_quick_manifest(source, output, limits, seed=1)


def test_quick_selection_respects_single_sample_limit() -> None:
    records = []
    for split in ("train", "valid", "test"):
        records.append(_record(f"{split}-d", split, ["d"]))
        records.append(_record(f"{split}-empty", split, []))
    selected = select_quick_records(records, {split: 1 for split in ("train", "valid", "test")}, seed=1)
    assert len(selected) == 3
