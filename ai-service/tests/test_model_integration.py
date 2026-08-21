from pathlib import Path

import pytest

from teethsee_ai.config import load_settings
from teethsee_ai.images import validate_and_decode_image
from teethsee_ai.model import EXPECTED_CLASSES, OralDiseaseClassifier


ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "assets" / "demo-oral" / "牙结石演示-下前牙-明显.png"


@pytest.mark.skipif(not load_settings().model_path.is_file(), reason="本机尚未下载模型权重")
def test_real_checkpoint_produces_six_probabilities() -> None:
    image = validate_and_decode_image(SAMPLE.read_bytes(), "image/png")
    predictions = OralDiseaseClassifier(load_settings().model_path).predict(image)
    assert {item.label for item in predictions} == EXPECTED_CLASSES
    assert sum(item.probability for item in predictions) == pytest.approx(1.0, abs=1e-5)
    assert predictions == sorted(predictions, key=lambda item: item.probability, reverse=True)
