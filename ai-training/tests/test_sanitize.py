import json
from pathlib import Path
import sys

from PIL import Image

from teethsee_training import sanitize


def test_sanitized_copy_removes_exif_and_patient_filename(tmp_path: Path, monkeypatch) -> None:
    dataset = tmp_path / "dataset"
    source = dataset / "Images" / "patient-001.jpg"
    source.parent.mkdir(parents=True)
    exif = Image.Exif()
    exif[0x010F] = "Private camera"
    Image.new("RGB", (128, 128), color=(200, 160, 140)).save(source, format="JPEG", exif=exif)
    manifest = tmp_path / "manifest.jsonl"
    sample_id = "0123456789abcdef01234567"
    manifest.write_text(
        json.dumps(
            {
                "sample_id": sample_id,
                "split": "train",
                "image": "Images/patient-001.jpg",
                "annotation": "Annotations/patient-001.json",
                "boxes": [],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    output = tmp_path / "sanitized"
    monkeypatch.setattr(
        sys,
        "argv",
        ["sanitize", "--dataset-root", str(dataset), "--manifest", str(manifest), "--output-dir", str(output)],
    )
    assert sanitize.main() == 0
    sanitized_image = output / "images" / f"{sample_id}.jpg"
    with Image.open(sanitized_image) as image:
        assert not image.getexif()
    rewritten = json.loads((output / "manifest.jsonl").read_text(encoding="utf-8"))
    assert rewritten["image"] == f"images/{sample_id}.jpg"
    assert "annotation" not in rewritten
    assert "patient-001" not in rewritten["image"]
