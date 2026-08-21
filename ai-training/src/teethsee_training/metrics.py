from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

import numpy as np


@dataclass(frozen=True)
class Detection:
    image_id: str
    label: int
    box: tuple[float, float, float, float]
    score: float = 1.0


def box_iou(left: tuple[float, float, float, float], right: tuple[float, float, float, float]) -> float:
    x1 = max(left[0], right[0])
    y1 = max(left[1], right[1])
    x2 = min(left[2], right[2])
    y2 = min(left[3], right[3])
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    left_area = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
    right_area = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
    union = left_area + right_area - intersection
    return intersection / union if union > 0 else 0.0


def _average_precision(recalls: np.ndarray, precisions: np.ndarray) -> float:
    values = []
    for threshold in np.linspace(0.0, 1.0, 101):
        candidates = precisions[recalls >= threshold]
        values.append(float(candidates.max()) if candidates.size else 0.0)
    return float(np.mean(values))


def evaluate_detections(
    predictions: Iterable[Detection],
    ground_truth: Iterable[Detection],
    class_ids: Iterable[int],
    iou_thresholds: Iterable[float] = tuple(np.arange(0.5, 1.0, 0.05)),
) -> dict[str, object]:
    predicted = list(predictions)
    truth = list(ground_truth)
    thresholds = tuple(round(float(value), 2) for value in iou_thresholds)
    per_class: dict[str, object] = {}
    all_ap = []
    ap50 = []

    for class_id in class_ids:
        class_truth = [item for item in truth if item.label == class_id]
        class_predictions = sorted(
            (item for item in predicted if item.label == class_id),
            key=lambda item: (-item.score, item.image_id),
        )
        aps = []
        recall_at_50 = 0.0
        precision_at_50 = 0.0
        for threshold in thresholds:
            by_image: defaultdict[str, list[Detection]] = defaultdict(list)
            for item in class_truth:
                by_image[item.image_id].append(item)
            matched = {image_id: [False] * len(items) for image_id, items in by_image.items()}
            true_positives = []
            false_positives = []
            for prediction in class_predictions:
                candidates = by_image.get(prediction.image_id, [])
                best_index = -1
                best_iou = threshold
                for index, target in enumerate(candidates):
                    if matched[prediction.image_id][index]:
                        continue
                    overlap = box_iou(prediction.box, target.box)
                    if overlap >= best_iou:
                        best_iou = overlap
                        best_index = index
                if best_index >= 0:
                    matched[prediction.image_id][best_index] = True
                    true_positives.append(1.0)
                    false_positives.append(0.0)
                else:
                    true_positives.append(0.0)
                    false_positives.append(1.0)
            if class_predictions:
                cumulative_tp = np.cumsum(true_positives)
                cumulative_fp = np.cumsum(false_positives)
                recalls = cumulative_tp / max(1, len(class_truth))
                precisions = cumulative_tp / np.maximum(cumulative_tp + cumulative_fp, 1e-12)
                ap = _average_precision(recalls, precisions) if class_truth else 0.0
                if threshold == 0.5:
                    recall_at_50 = float(recalls[-1]) if recalls.size else 0.0
                    precision_at_50 = float(precisions[-1]) if precisions.size else 0.0
            else:
                ap = 0.0
            aps.append(ap)
            all_ap.append(ap)
            if threshold == 0.5:
                ap50.append(ap)
        per_class[str(class_id)] = {
            "ground_truth": len(class_truth),
            "predictions": len(class_predictions),
            "ap50": round(aps[0], 6) if aps else 0.0,
            "map50_95": round(float(np.mean(aps)), 6) if aps else 0.0,
            "precision50": round(precision_at_50, 6),
            "recall50": round(recall_at_50, 6),
        }
    return {
        "map50": round(float(np.mean(ap50)), 6) if ap50 else 0.0,
        "map50_95": round(float(np.mean(all_ap)), 6) if all_ap else 0.0,
        "per_class": per_class,
    }
