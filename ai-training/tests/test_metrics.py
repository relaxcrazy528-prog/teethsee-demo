import pytest

from teethsee_training.metrics import Detection, box_iou, evaluate_detections


def test_iou_for_identical_box_is_one() -> None:
    assert box_iou((0, 0, 10, 10), (0, 0, 10, 10)) == pytest.approx(1.0)


def test_perfect_predictions_score_perfect_map() -> None:
    truth = [Detection("a", 1, (0, 0, 10, 10)), Detection("b", 2, (20, 20, 40, 40))]
    predictions = [Detection("a", 1, (0, 0, 10, 10), 0.9), Detection("b", 2, (20, 20, 40, 40), 0.8)]
    result = evaluate_detections(predictions, truth, class_ids=(1, 2))
    assert result["map50"] == pytest.approx(1.0)
    assert result["map50_95"] == pytest.approx(1.0)


def test_false_positive_reduces_precision() -> None:
    truth = [Detection("a", 1, (0, 0, 10, 10))]
    predictions = [
        Detection("b", 1, (0, 0, 10, 10), 0.95),
        Detection("a", 1, (0, 0, 10, 10), 0.90),
    ]
    result = evaluate_detections(predictions, truth, class_ids=(1,), iou_thresholds=(0.5,))
    assert result["per_class"]["1"]["precision50"] == pytest.approx(0.5)
