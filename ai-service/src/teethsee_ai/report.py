from __future__ import annotations

from .images import ImageQuality
from .model import MODEL_ID, MODEL_REVISION, Prediction


LABELS_ZH = {
    "Calculus": "疑似牙结石表现",
    "Caries": "疑似龋齿表现",
    "Gingivitis": "疑似牙龈炎症表现",
    "Ulcers": "疑似口腔溃疡表现",
    "Tooth Discoloration": "疑似牙齿着色表现",
    "Hypodontia": "疑似牙齿缺失表现",
}


def build_report(
    predictions: list[Prediction],
    quality: ImageQuality,
    min_confidence: float,
) -> dict[str, object]:
    if not predictions:
        raise ValueError("至少需要一个模型预测结果")
    top = predictions[0]
    uncertain = not quality.acceptable or top.probability < min_confidence
    title = "暂时无法形成可靠观察" if uncertain else LABELS_ZH[top.label]

    if not quality.acceptable:
        summary = "图片质量没有达到本次模型分析条件，建议重新拍摄后再分析。"
    elif top.probability < min_confidence:
        summary = "模型没有形成足够集中的类别判断，建议补拍不同角度或提高画面清晰度。"
    else:
        summary = f"图像特征更接近“{LABELS_ZH[top.label]}”，需要结合具体牙位和其他角度继续确认。"

    return {
        "status": "uncertain" if uncertain else "screening_result",
        "title": title,
        "summary": summary,
        "top_prediction": {
            "label": top.label,
            "label_zh": LABELS_ZH[top.label],
            "probability": round(top.probability, 6),
        },
        "predictions": [
            {
                "label": item.label,
                "label_zh": LABELS_ZH[item.label],
                "probability": round(item.probability, 6),
            }
            for item in predictions
        ],
        "quality": quality.as_dict(),
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "task": "image_classification",
            "calibrated_for_teethsee_camera": False,
        },
        "limitations": [
            "当前模型仅进行整张图片分类，尚未定位具体牙齿或异常区域。",
            "模型没有健康和食物残留类别，不能用于评价清洁程度。",
            "结果尚未使用 teethsee 摄像头数据完成独立校准。",
        ],
    }

