from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import replace
import hashlib
from typing import Iterable

from .dataset import Sample, VALID_LABELS


SPLITS = ("train", "valid", "test")


def _stable_noise(seed: int, value: str) -> int:
    return int(hashlib.sha256(f"{seed}:{value}".encode("utf-8")).hexdigest()[:12], 16)


def assign_grouped_splits(
    samples: Iterable[Sample],
    ratios: tuple[float, float, float] = (0.8, 0.1, 0.1),
    seed: int = 20260821,
) -> list[Sample]:
    sample_list = list(samples)
    if len(sample_list) < 3 or len({sample.group_id for sample in sample_list}) < 3:
        raise ValueError("至少需要三个患者组才能建立训练、验证和测试集")
    if len(ratios) != 3 or any(ratio <= 0 for ratio in ratios) or abs(sum(ratios) - 1.0) > 1e-9:
        raise ValueError("划分比例必须是三个总和为 1 的正数")

    grouped: defaultdict[str, list[Sample]] = defaultdict(list)
    for sample in sample_list:
        grouped[sample.group_id].append(sample)
    total_boxes = Counter(box.label for sample in sample_list for box in sample.boxes)
    target_samples = {split: len(sample_list) * ratios[index] for index, split in enumerate(SPLITS)}
    target_labels = {
        split: {label: total_boxes[label] * ratios[index] for label in VALID_LABELS}
        for index, split in enumerate(SPLITS)
    }

    group_stats = []
    for group_id, group_samples in grouped.items():
        labels = Counter(box.label for sample in group_samples for box in sample.boxes)
        rarity = sum(labels[label] / max(1, total_boxes[label]) for label in VALID_LABELS)
        group_stats.append((group_id, group_samples, labels, rarity))
    # Place common-label groups first so small validation/test capacities are not
    # consumed by a few primary-dentition-heavy groups before the global targets exist.
    group_stats.sort(key=lambda item: (item[3], -len(item[1]), _stable_noise(seed, item[0])))

    assigned_samples = Counter()
    assigned_labels: dict[str, Counter[str]] = {split: Counter() for split in SPLITS}
    group_assignment: dict[str, str] = {}

    for index, (group_id, group_samples, labels, _) in enumerate(group_stats):
        if index < len(SPLITS):
            chosen = SPLITS[index]
        else:
            scores: list[tuple[float, int, str]] = []
            for candidate in SPLITS:
                objective = 0.0
                for split in SPLITS:
                    projected_samples = assigned_samples[split] + (len(group_samples) if split == candidate else 0)
                    sample_error = (projected_samples - target_samples[split]) / max(1.0, target_samples[split])
                    objective += sample_error * sample_error * 100.0
                    for label in VALID_LABELS:
                        projected_label = assigned_labels[split][label] + (labels[label] if split == candidate else 0)
                        label_error = (projected_label - target_labels[split][label]) / max(1.0, target_labels[split][label])
                        objective += label_error * label_error
                scores.append((objective, _stable_noise(seed, f"{group_id}:{candidate}"), candidate))
            chosen = min(scores)[2]
        group_assignment[group_id] = chosen
        assigned_samples[chosen] += len(group_samples)
        assigned_labels[chosen].update(labels)

    result = [replace(sample, split=group_assignment[sample.group_id]) for sample in sample_list]
    for split in SPLITS:
        if not any(sample.split == split for sample in result):
            raise RuntimeError(f"{split} 划分为空")
    for group_id in grouped:
        if len({sample.split for sample in result if sample.group_id == group_id}) != 1:
            raise RuntimeError("患者组跨越了多个划分")
    return sorted(result, key=lambda sample: (sample.split, sample.sample_id))


def split_summary(samples: Iterable[Sample]) -> dict[str, object]:
    result: dict[str, object] = {}
    sample_list = list(samples)
    for split in SPLITS:
        selected = [sample for sample in sample_list if sample.split == split]
        result[split] = {
            "samples": len(selected),
            "groups": len({sample.group_id for sample in selected}),
            "boxes": dict(Counter(box.label for sample in selected for box in sample.boxes)),
            "empty_samples": sum(not sample.boxes for sample in selected),
        }
    return result
