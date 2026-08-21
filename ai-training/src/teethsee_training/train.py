from __future__ import annotations

import argparse
from contextlib import nullcontext
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import random
import sys
import time

import numpy as np
from safetensors.torch import save_file
import torch
from torch.utils.data import DataLoader

from .metrics import Detection, evaluate_detections
from .modeling import ARCHITECTURES, build_model
from .torch_data import ManifestDetectionDataset, collate_detection_batch


@dataclass(frozen=True)
class TrainConfig:
    architecture: str
    epochs: int
    batch_size: int
    learning_rate: float
    weight_decay: float
    workers: int
    seed: int
    score_threshold: float
    patience: int


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _move_targets(targets, device):
    return [{key: value.to(device) for key, value in target.items()} for target in targets]


def _train_epoch(model, loader, optimizer, scaler, device) -> float:
    model.train()
    total_loss = 0.0
    batches = 0
    for images, targets, _ in loader:
        images = [image.to(device) for image in images]
        targets = _move_targets(targets, device)
        optimizer.zero_grad(set_to_none=True)
        context = torch.autocast(device_type="cuda", dtype=torch.float16) if device.type == "cuda" else nullcontext()
        with context:
            losses = model(images, targets)
            loss = sum(losses.values())
        if not torch.isfinite(loss):
            raise RuntimeError("训练损失出现非有限值")
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)
        scaler.step(optimizer)
        scaler.update()
        total_loss += float(loss.detach().cpu())
        batches += 1
    return total_loss / max(1, batches)


@torch.inference_mode()
def _evaluate(model, loader, device, score_threshold: float) -> dict[str, object]:
    model.eval()
    predictions: list[Detection] = []
    truth: list[Detection] = []
    for images, targets, sample_ids in loader:
        outputs = model([image.to(device) for image in images])
        for sample_id, output, target in zip(sample_ids, outputs, targets, strict=True):
            for box, label, score in zip(output["boxes"].cpu(), output["labels"].cpu(), output["scores"].cpu(), strict=True):
                if float(score) >= score_threshold:
                    predictions.append(Detection(sample_id, int(label), tuple(float(value) for value in box), float(score)))
            for box, label in zip(target["boxes"], target["labels"], strict=True):
                truth.append(Detection(sample_id, int(label), tuple(float(value) for value in box)))
    return evaluate_detections(predictions, truth, class_ids=(1, 2))


def _safe_state_dict(model) -> dict[str, torch.Tensor]:
    return {name: tensor.detach().cpu().contiguous() for name, tensor in model.state_dict().items()}


def main() -> int:
    parser = argparse.ArgumentParser(description="训练 teethsee 龋齿目标检测模型")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--architecture", choices=ARCHITECTURES, default=ARCHITECTURES[0])
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=0.005)
    parser.add_argument("--weight-decay", type=float, default=0.0005)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=20260821)
    parser.add_argument("--score-threshold", type=float, default=0.25)
    parser.add_argument("--patience", type=int, default=7)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.workers < 0 or args.patience < 1:
        parser.error("训练参数必须为正数")
    if not 0.01 <= args.score_threshold <= 0.99:
        parser.error("score-threshold 必须在 0.01 到 0.99 之间")

    output_dir = args.output_dir.expanduser().resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        parser.error("输出目录必须不存在或为空")
    output_dir.mkdir(parents=True, exist_ok=True)
    config = TrainConfig(
        architecture=args.architecture,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        workers=args.workers,
        seed=args.seed,
        score_threshold=args.score_threshold,
        patience=args.patience,
    )
    _seed_everything(config.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        print("警告：未检测到 CUDA，将使用 CPU 训练。", file=sys.stderr)

    root = args.dataset_root.expanduser().resolve()
    manifest = args.manifest.expanduser().resolve()
    train_dataset = ManifestDetectionDataset(root, manifest, "train", augment=True)
    valid_dataset = ManifestDetectionDataset(root, manifest, "valid", augment=False)
    test_dataset = ManifestDetectionDataset(root, manifest, "test", augment=False)
    loader_options = {
        "batch_size": config.batch_size,
        "num_workers": config.workers,
        "collate_fn": collate_detection_batch,
        "pin_memory": device.type == "cuda",
        "persistent_workers": config.workers > 0,
    }
    generator = torch.Generator().manual_seed(config.seed)
    train_loader = DataLoader(train_dataset, shuffle=True, generator=generator, **loader_options)
    valid_loader = DataLoader(valid_dataset, shuffle=False, **loader_options)
    test_loader = DataLoader(test_dataset, shuffle=False, **loader_options)

    model = build_model(config.architecture, num_classes=3, pretrained=True).to(device)
    optimizer = torch.optim.SGD(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=config.learning_rate,
        momentum=0.9,
        weight_decay=config.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config.epochs)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")
    best_map = -1.0
    stale_epochs = 0
    metrics_path = output_dir / "metrics.jsonl"
    model_config = {
        **asdict(config),
        "labels": {"background": 0, "D": 1, "d": 2},
        "manifest_sha256": _sha256(manifest),
        "framework": {"torch": torch.__version__},
        "created_at_unix": int(time.time()),
    }
    (output_dir / "model-config.json").write_text(
        json.dumps(model_config, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    for epoch in range(1, config.epochs + 1):
        train_loss = _train_epoch(model, train_loader, optimizer, scaler, device)
        validation = _evaluate(model, valid_loader, device, config.score_threshold)
        scheduler.step()
        record = {"epoch": epoch, "train_loss": round(train_loss, 6), "learning_rate": optimizer.param_groups[0]["lr"], "validation": validation}
        with metrics_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        current_map = float(validation["map50"])
        print(json.dumps(record, ensure_ascii=False))
        if current_map > best_map:
            best_map = current_map
            stale_epochs = 0
            save_file(_safe_state_dict(model), output_dir / "best.safetensors", metadata={"architecture": config.architecture})
        else:
            stale_epochs += 1
            if stale_epochs >= config.patience:
                break

    from safetensors.torch import load_file

    model.load_state_dict(load_file(output_dir / "best.safetensors", device=str(device)), strict=True)
    test_metrics = _evaluate(model, test_loader, device, config.score_threshold)
    (output_dir / "test-metrics.json").write_text(
        json.dumps(test_metrics, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": "complete", "best_validation_map50": best_map, "test": test_metrics}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
