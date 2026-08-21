from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys
import tempfile

from PIL import Image, UnidentifiedImageError


def _inside(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("清单中的图片路径越过数据集目录")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="创建去 EXIF、匿名文件名的训练副本")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    root = args.dataset_root.expanduser().resolve()
    manifest = args.manifest.expanduser().resolve()
    output = args.output_dir.expanduser().resolve()
    if output == Path.home().resolve() or output == Path("/"):
        parser.error("拒绝使用过宽的输出目录")
    if output.exists():
        parser.error("输出目录必须不存在，避免覆盖任何已有文件")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(dir=output.parent, prefix=".teethsee-sanitize-"))
    images_output = temporary / "images"
    images_output.mkdir(parents=True, exist_ok=True)

    rewritten = []
    try:
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            sample_id = str(record["sample_id"])
            if len(sample_id) != 24 or not all(character in "0123456789abcdef" for character in sample_id):
                raise ValueError("sample_id 格式不正确")
            source = _inside(root, str(record["image"]))
            target = images_output / f"{sample_id}.jpg"
            with Image.open(source) as image:
                image.convert("RGB").save(target, format="JPEG", quality=95, optimize=True, progressive=True)
            record["image"] = f"images/{sample_id}.jpg"
            record.pop("annotation", None)
            rewritten.append(record)
    except (KeyError, ValueError, OSError, json.JSONDecodeError, UnidentifiedImageError) as exc:
        shutil.rmtree(temporary, ignore_errors=True)
        print(f"脱敏复制失败：{exc}", file=sys.stderr)
        return 1
    with (temporary / "manifest.jsonl").open("w", encoding="utf-8") as handle:
        for record in rewritten:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(output)
    print(json.dumps({"output": str(output), "images": len(rewritten)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
