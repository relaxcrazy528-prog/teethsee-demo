from teethsee_ai.images import ImageQuality
from teethsee_ai.model import Prediction
from teethsee_ai.report import build_report


def test_report_returns_screening_result_above_threshold() -> None:
    report = build_report(
        [Prediction("Calculus", 0.82), Prediction("Caries", 0.12)],
        ImageQuality(True, 120.0, 50.0, ()),
        0.60,
    )
    assert report["status"] == "screening_result"
    assert report["top_prediction"]["label_zh"] == "疑似牙结石表现"
    assert report["model"]["calibrated_for_teethsee_camera"] is False


def test_report_refuses_low_quality_image() -> None:
    report = build_report(
        [Prediction("Caries", 0.95)],
        ImageQuality(False, 20.0, 10.0, ("画面过暗",)),
        0.60,
    )
    assert report["status"] == "uncertain"
    assert report["title"] == "暂时无法形成可靠观察"

