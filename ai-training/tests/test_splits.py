from teethsee_training.dataset import Box, Sample
from teethsee_training.splits import SPLITS, assign_grouped_splits, split_summary


def _sample(index: int, group: int, label: str) -> Sample:
    return Sample(
        sample_id=f"{index:024x}",
        image_relative=f"Images/{index}.jpg",
        annotation_relative=f"Annotations/{index}.json",
        capture_mode="pilot",
        view="Frontal",
        width=100,
        height=100,
        boxes=(Box(label, (1, 1, 20, 20)),),
        group_key=f"raw:{group}",
        group_id=f"group-{group}",
    )


def test_split_never_separates_patient_group() -> None:
    samples = [_sample(index, index // 2, "D" if index % 3 else "d") for index in range(30)]
    assigned = assign_grouped_splits(samples, seed=7)
    for group in {sample.group_id for sample in assigned}:
        assert len({sample.split for sample in assigned if sample.group_id == group}) == 1
    summary = split_summary(assigned)
    assert set(summary) == set(SPLITS)
    assert sum(item["samples"] for item in summary.values()) == 30


def test_split_is_deterministic() -> None:
    samples = [_sample(index, index, "D") for index in range(12)]
    first = assign_grouped_splits(samples, seed=3)
    second = assign_grouped_splits(reversed(samples), seed=3)
    assert {item.sample_id: item.split for item in first} == {item.sample_id: item.split for item in second}


def test_split_sample_ratios_remain_close_to_targets() -> None:
    samples = [_sample(index, index // 2, "D" if index % 4 else "d") for index in range(200)]
    assigned = assign_grouped_splits(samples, seed=11)
    counts = {split: sum(item.split == split for item in assigned) for split in SPLITS}
    assert abs(counts["train"] / 200 - 0.8) <= 0.03
    assert abs(counts["valid"] / 200 - 0.1) <= 0.03
    assert abs(counts["test"] / 200 - 0.1) <= 0.03
