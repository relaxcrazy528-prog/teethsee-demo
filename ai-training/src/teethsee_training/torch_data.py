from __future__ import annotations

import json
from pathlib import Path
import random

from PIL import Image
import torch
from torch.utils.data import Dataset
from torchvision.transforms import ColorJitter
from torchvision.transforms import functional as vision_functional


LABEL_TO_ID = {"D": 1, "d": 2}


def _inside(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("清单中的图片路径越过数据集目录")
    return path


class ManifestDetectionDataset(Dataset):
    def __init__(self, dataset_root: Path, manifest_path: Path, split: str, augment: bool = False) -> None:
        self.dataset_root = dataset_root.resolve()
        self.records = []
        self.augment = augment
        self.color_jitter = ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1, hue=0.02)
        for line in manifest_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("split") == split:
                self.records.append(record)
        if not self.records:
            raise ValueError(f"清单中没有 {split} 样本")

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int):
        record = self.records[index]
        image_path = _inside(self.dataset_root, str(record["image"]))
        with Image.open(image_path) as opened:
            image = opened.convert("RGB")
        boxes = torch.tensor([item["xyxy"] for item in record["boxes"]], dtype=torch.float32).reshape(-1, 4)
        labels = torch.tensor([LABEL_TO_ID[item["label"]] for item in record["boxes"]], dtype=torch.int64)

        if self.augment:
            image = self.color_jitter(image)
            if random.random() < 0.5:
                image = vision_functional.hflip(image)
                if boxes.numel():
                    width = image.width
                    old_left = boxes[:, 0].clone()
                    old_right = boxes[:, 2].clone()
                    boxes[:, 0] = width - old_right
                    boxes[:, 2] = width - old_left

        image_tensor = vision_functional.pil_to_tensor(image).to(dtype=torch.float32).div_(255.0)
        area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        target = {
            "boxes": boxes,
            "labels": labels,
            "area": area,
            "iscrowd": torch.zeros((len(labels),), dtype=torch.int64),
            "image_id": torch.tensor([index], dtype=torch.int64),
        }
        return image_tensor, target, str(record["sample_id"])


def collate_detection_batch(batch):
    images, targets, sample_ids = zip(*batch, strict=True)
    return list(images), list(targets), list(sample_ids)
