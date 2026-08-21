from __future__ import annotations

from dataclasses import dataclass
import hashlib
import math
import os
from pathlib import Path
from threading import Lock

import numpy as np
import onnxruntime as ort
from PIL import Image


MODEL_SHA256 = "0060cf48d43b26fe29633f6e91e88d29c0ad9542e7bf73868b75dd22c46ca550"
MODEL_ID = "nsr51324/Oral_Diseases_Image_Classification"
MODEL_REVISION = "a39c1db941ca82d9bf6ba4ee9885d01e8e58976f"
CLASS_NAMES = (
    "Calculus",
    "Caries",
    "Gingivitis",
    "Hypodontia",
    "Tooth Discoloration",
    "Ulcers",
)
EXPECTED_CLASSES = frozenset(CLASS_NAMES)
IMAGE_SIZE = (224, 224)
MEAN = np.asarray([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 3, 1, 1)
STD = np.asarray([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 3, 1, 1)


class ModelLoadError(RuntimeError):
    pass


@dataclass(frozen=True)
class Prediction:
    label: str
    probability: float


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exponents = np.exp(shifted)
    denominator = float(np.sum(exponents))
    if not math.isfinite(denominator) or denominator <= 0:
        raise ModelLoadError("模型输出无法转换为概率")
    return exponents / denominator


def _preprocess(image: Image.Image) -> np.ndarray:
    resized = image.resize(IMAGE_SIZE, resample=Image.Resampling.BILINEAR)
    pixels = np.asarray(resized, dtype=np.float32) / 255.0
    tensor = np.transpose(pixels, (2, 0, 1))[np.newaxis, ...]
    return np.ascontiguousarray((tensor - MEAN) / STD, dtype=np.float32)


class OralDiseaseClassifier:
    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self._lock = Lock()
        self._session: ort.InferenceSession | None = None

    @property
    def is_loaded(self) -> bool:
        return self._session is not None

    def model_file_status(self) -> dict[str, object]:
        return {"exists": self.model_path.is_file(), "loaded": self.is_loaded}

    def load(self) -> None:
        if self._session is not None:
            return
        with self._lock:
            if self._session is not None:
                return
            if not self.model_path.is_file():
                raise ModelLoadError("ONNX 模型文件尚未准备")
            if sha256_file(self.model_path) != MODEL_SHA256:
                raise ModelLoadError("ONNX 模型文件完整性校验失败")

            options = ort.SessionOptions()
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
            try:
                session = ort.InferenceSession(
                    str(self.model_path),
                    sess_options=options,
                    providers=["CPUExecutionProvider"],
                )
            except Exception as exc:
                raise ModelLoadError("无法加载 ONNX 模型") from exc

            inputs = session.get_inputs()
            outputs = session.get_outputs()
            if len(inputs) != 1 or inputs[0].name != "image" or inputs[0].shape[-3:] != [3, 224, 224]:
                raise ModelLoadError("ONNX 输入结构与 teethsee 配置不一致")
            if len(outputs) != 1 or outputs[0].name != "logits" or outputs[0].shape[-1] != len(CLASS_NAMES):
                raise ModelLoadError("ONNX 输出结构与 teethsee 配置不一致")
            self._session = session

    def predict(self, image: Image.Image, limit: int = 6) -> list[Prediction]:
        self.load()
        if self._session is None:
            raise ModelLoadError("模型未能加载")
        tensor = _preprocess(image)
        with self._lock:
            try:
                logits = self._session.run(["logits"], {"image": tensor})[0][0]
            except Exception as exc:
                raise ModelLoadError("模型推理失败") from exc
        probabilities = _softmax(np.asarray(logits, dtype=np.float32))
        order = np.argsort(probabilities)[::-1][:limit]
        return [Prediction(CLASS_NAMES[int(index)], float(probabilities[index])) for index in order]
