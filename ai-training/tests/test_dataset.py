import json
from pathlib import Path

from PIL import Image

from teethsee_training.dataset import load_labelme_dataset


def _write_sample(root: Path, patient: str, labels: list[str]) -> None:
    image_dir = root / "Images" / "retractors" / "Mandibular"
    annotation_dir = root / "Annotations" / "Labelme" / "retractors" / "Mandibular"
    image_dir.mkdir(parents=True, exist_ok=True)
    annotation_dir.mkdir(parents=True, exist_ok=True)
    name = f"anonymous_{patient}_1729483204892_Mandibular_View"
    Image.new("RGB", (200, 100), color=(220, 180, 160)).save(image_dir / f"{name}.jpg", format="JPEG")
    shapes = [
        {"label": label, "shape_type": "rectangle", "points": [[10, 10], [80, 70]]}
        for label in labels
    ]
    (annotation_dir / f"{name}.json").write_text(
        json.dumps({"imagePath": f"{name}.jpg", "imageWidth": 200, "imageHeight": 100, "shapes": shapes}),
        encoding="utf-8",
    )


def test_labelme_parser_keeps_d_and_ignores_unknown(tmp_path: Path) -> None:
    _write_sample(tmp_path, "003-001-001-00", ["D", "d", "M"])
    samples, audit = load_labelme_dataset(tmp_path)
    assert len(samples) == 1
    assert [box.label for box in samples[0].boxes] == ["D", "d"]
    assert audit.ignored_shapes["unknown_label:M"] == 1
    assert "003-001-001-00" not in samples[0].group_id


def test_missing_image_is_counted_not_loaded(tmp_path: Path) -> None:
    annotation_dir = tmp_path / "Annotations" / "Labelme" / "pilot" / "Frontal"
    annotation_dir.mkdir(parents=True)
    (tmp_path / "Images" / "pilot" / "Frontal").mkdir(parents=True)
    (annotation_dir / "missing.json").write_text(
        json.dumps({"imagePath": "missing.jpg", "imageWidth": 100, "imageHeight": 100, "shapes": []}),
        encoding="utf-8",
    )
    samples, audit = load_labelme_dataset(tmp_path)
    assert samples == []
    assert audit.missing_images == 1


def test_unknown_only_annotation_is_not_used_as_negative(tmp_path: Path) -> None:
    _write_sample(tmp_path, "003-001-002-00", ["M"])
    samples, audit = load_labelme_dataset(tmp_path)
    assert samples == []
    assert audit.ambiguous_samples == 1
