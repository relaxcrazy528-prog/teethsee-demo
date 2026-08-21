from __future__ import annotations

from dataclasses import asdict, dataclass
from io import BytesIO
import warnings
from PIL import Image, ImageFilter, ImageStat, UnidentifiedImageError


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MIN_IMAGE_SIDE = 96
MAX_IMAGE_SIDE = 6000
ALLOWED_MEDIA_TYPES = frozenset({"image/jpeg", "image/png"})
ALLOWED_FORMATS = frozenset({"JPEG", "PNG"})
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ImageValidationError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ImageQuality:
    acceptable: bool
    brightness: float
    edge_energy: float
    warnings: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        result = asdict(self)
        result["warnings"] = list(self.warnings)
        return result


def _has_expected_magic(data: bytes, media_type: str) -> bool:
    if media_type == "image/jpeg":
        return data.startswith(JPEG_MAGIC)
    if media_type == "image/png":
        return data.startswith(PNG_MAGIC)
    return False


def validate_and_decode_image(data: bytes, media_type: str) -> Image.Image:
    normalized_type = media_type.split(";", 1)[0].strip().lower()
    if normalized_type not in ALLOWED_MEDIA_TYPES:
        raise ImageValidationError("unsupported_image", "仅支持 PNG 或 JPEG 图片", 415)
    if not data:
        raise ImageValidationError("empty_image", "图片内容为空")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageValidationError("image_too_large", "图片不能超过 8MB", 413)
    if not _has_expected_magic(data, normalized_type):
        raise ImageValidationError("invalid_image_signature", "文件内容与图片格式不一致", 415)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as probe:
                if probe.format not in ALLOWED_FORMATS:
                    raise ImageValidationError("unsupported_image", "仅支持 PNG 或 JPEG 图片", 415)
                width, height = probe.size
                if (
                    min(width, height) < MIN_IMAGE_SIDE
                    or max(width, height) > MAX_IMAGE_SIDE
                    or width * height > MAX_IMAGE_PIXELS
                ):
                    raise ImageValidationError("invalid_image_dimensions", "图片尺寸不在允许范围内")
                probe.verify()
        with Image.open(BytesIO(data)) as decoded:
            decoded.load()
            return decoded.convert("RGB")
    except ImageValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageValidationError("image_too_large", "图片像素数量过大", 413) from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("invalid_image", "无法读取图片内容") from exc


def assess_quality(image: Image.Image) -> ImageQuality:
    sample = image.copy()
    sample.thumbnail((512, 512))
    grayscale = sample.convert("L")
    brightness = float(ImageStat.Stat(grayscale).mean[0])
    edges = grayscale.filter(ImageFilter.FIND_EDGES)
    edge_energy = float(ImageStat.Stat(edges).stddev[0])

    warnings: list[str] = []
    if brightness < 45:
        warnings.append("画面过暗")
    elif brightness > 225:
        warnings.append("画面可能过曝或反光明显")
    if edge_energy < 12:
        warnings.append("画面可能模糊或缺少可辨识细节")
    return ImageQuality(
        acceptable=not warnings,
        brightness=round(brightness, 2),
        edge_energy=round(edge_energy, 2),
        warnings=tuple(warnings),
    )
