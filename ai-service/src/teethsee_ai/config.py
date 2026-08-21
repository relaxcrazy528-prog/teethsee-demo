from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = SERVICE_ROOT / "models" / "oral-diseases-resnet50.onnx"


def _read_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 必须是整数") from exc
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} 必须在 {minimum} 到 {maximum} 之间")
    return value


def _read_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} 必须是数字") from exc
    if not minimum <= value <= maximum:
        raise RuntimeError(f"{name} 必须在 {minimum} 到 {maximum} 之间")
    return value


@dataclass(frozen=True)
class Settings:
    model_path: Path
    allowed_origins: frozenset[str]
    max_requests_per_minute: int
    min_confidence: float


def load_settings() -> Settings:
    model_path = Path(os.getenv("TEETHSEE_AI_MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser().resolve()
    origins = frozenset(
        origin.strip()
        for origin in os.getenv("TEETHSEE_AI_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    )
    if "*" in origins or "null" in origins:
        raise RuntimeError("网页来源必须使用明确地址，不能使用 * 或 null")
    return Settings(
        model_path=model_path,
        allowed_origins=origins,
        max_requests_per_minute=_read_int("TEETHSEE_AI_MAX_REQUESTS_PER_MINUTE", 20, 1, 300),
        min_confidence=_read_float("TEETHSEE_AI_MIN_CONFIDENCE", 0.60, 0.50, 0.99),
    )
