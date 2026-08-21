from __future__ import annotations

import hashlib
from pathlib import Path
import ssl
import sys
import tempfile
from urllib.request import Request, urlopen


MODEL_URL = (
    "https://huggingface.co/nsr51324/Oral_Diseases_Image_Classification/resolve/"
    "a39c1db941ca82d9bf6ba4ee9885d01e8e58976f/checkpoints/best_model.pth"
)
MODEL_SHA256 = "40bd3f0d2f1481704b49946ab76231914f86f4de58cb1fb4b82041a3cd8562f7"
MODEL_BYTES = 94_400_529
TARGET = Path(__file__).resolve().parents[1] / "models" / "source" / "oral-diseases-resnet50.pth"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    if TARGET.is_file() and TARGET.stat().st_size == MODEL_BYTES and sha256_file(TARGET) == MODEL_SHA256:
        print(f"源模型已经存在并通过校验：{TARGET}")
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    request = Request(MODEL_URL, headers={"User-Agent": "teethsee-ai-service/0.1"})
    context = ssl.create_default_context()
    try:
        with tempfile.NamedTemporaryFile(dir=TARGET.parent, suffix=".download", delete=False) as temp:
            temporary_path = Path(temp.name)
            with urlopen(request, timeout=60, context=context) as response:
                declared = response.headers.get("Content-Length")
                if declared and int(declared) > MODEL_BYTES:
                    raise RuntimeError("远端模型文件大小异常")
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > MODEL_BYTES:
                        raise RuntimeError("远端模型文件超过预期大小")
                    temp.write(chunk)
        if temporary_path.stat().st_size != MODEL_BYTES:
            raise RuntimeError("模型文件大小不符合预期")
        if sha256_file(temporary_path) != MODEL_SHA256:
            raise RuntimeError("模型文件 SHA-256 校验失败")
        temporary_path.replace(TARGET)
        print(f"源模型下载完成并通过校验：{TARGET}")
        return 0
    except Exception as exc:
        if "temporary_path" in locals():
            temporary_path.unlink(missing_ok=True)
        print(f"模型下载失败：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
