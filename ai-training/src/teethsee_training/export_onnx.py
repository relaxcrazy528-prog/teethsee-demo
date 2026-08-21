from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import onnx
from safetensors.torch import load_file
import torch
from torch import nn

from .modeling import build_model


class DetectionExportWrapper(nn.Module):
    def __init__(self, model: nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, image: torch.Tensor):
        output = self.model([image])[0]
        return output["boxes"], output["labels"], output["scores"]


def main() -> int:
    parser = argparse.ArgumentParser(description="把 teethsee 龋齿模型导出为 ONNX")
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--width", type=int, default=1024)
    args = parser.parse_args()
    if not 320 <= args.height <= 4096 or not 320 <= args.width <= 4096:
        parser.error("导出尺寸必须在 320 到 4096 之间")
    if args.output.exists():
        parser.error("输出 ONNX 文件已存在，拒绝覆盖")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    model = build_model(str(config["architecture"]), num_classes=3, pretrained=False)
    model.load_state_dict(load_file(args.weights), strict=True)
    model.eval()
    wrapper = DetectionExportWrapper(model)
    example = torch.zeros((3, args.height, args.width), dtype=torch.float32)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        wrapper,
        (example,),
        args.output,
        input_names=["image"],
        output_names=["boxes", "labels", "scores"],
        opset_version=18,
        dynamo=True,
    )
    onnx.checker.check_model(onnx.load(args.output))
    digest = hashlib.sha256(args.output.read_bytes()).hexdigest()
    print(json.dumps({"output": str(args.output.resolve()), "sha256": digest}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
