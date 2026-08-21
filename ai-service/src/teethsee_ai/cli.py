from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .config import load_settings
from .images import ALLOWED_MEDIA_TYPES, assess_quality, validate_and_decode_image
from .model import ModelLoadError, OralDiseaseClassifier
from .report import build_report


def _media_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    raise ValueError(f"仅支持 {', '.join(sorted(ALLOWED_MEDIA_TYPES))}")


def main() -> int:
    parser = argparse.ArgumentParser(description="运行 teethsee 口腔图片离线分类")
    parser.add_argument("image", type=Path, help="PNG 或 JPEG 口腔照片")
    args = parser.parse_args()
    image_path = args.image.expanduser().resolve()
    if not image_path.is_file():
        parser.error("找不到指定图片")

    try:
        image = validate_and_decode_image(image_path.read_bytes(), _media_type(image_path))
        quality = assess_quality(image)
        settings = load_settings()
        predictions = OralDiseaseClassifier(settings.model_path).predict(image)
        print(json.dumps(build_report(predictions, quality, settings.min_confidence), ensure_ascii=False, indent=2))
        return 0
    except (ValueError, ModelLoadError) as exc:
        print(f"分析失败：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

