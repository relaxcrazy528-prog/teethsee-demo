from io import BytesIO

from PIL import Image
import pytest

from teethsee_ai.images import ImageValidationError, assess_quality, validate_and_decode_image


def image_bytes(format_name: str = "PNG", color: tuple[int, int, int] = (120, 80, 60)) -> bytes:
    output = BytesIO()
    Image.new("RGB", (256, 256), color=color).save(output, format=format_name)
    return output.getvalue()


def test_accepts_png_and_decodes_rgb() -> None:
    image = validate_and_decode_image(image_bytes(), "image/png")
    assert image.mode == "RGB"
    assert image.size == (256, 256)


def test_rejects_mismatched_magic_number() -> None:
    with pytest.raises(ImageValidationError) as error:
        validate_and_decode_image(image_bytes("JPEG"), "image/png")
    assert error.value.code == "invalid_image_signature"


def test_rejects_unsupported_media_type() -> None:
    with pytest.raises(ImageValidationError) as error:
        validate_and_decode_image(b"GIF89a", "image/gif")
    assert error.value.status_code == 415


def test_quality_marks_dark_flat_image() -> None:
    quality = assess_quality(Image.new("RGB", (256, 256), color=(0, 0, 0)))
    assert quality.acceptable is False
    assert "画面过暗" in quality.warnings

