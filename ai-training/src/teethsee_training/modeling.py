from __future__ import annotations

from torchvision.models.detection import (
    FasterRCNN_MobileNet_V3_Large_320_FPN_Weights,
    FasterRCNN_ResNet50_FPN_V2_Weights,
    fasterrcnn_mobilenet_v3_large_320_fpn,
    fasterrcnn_resnet50_fpn_v2,
)
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor


ARCHITECTURES = (
    "fasterrcnn_resnet50_fpn_v2",
    "fasterrcnn_mobilenet_v3_large_320_fpn",
)


def build_model(architecture: str, num_classes: int = 3, pretrained: bool = True):
    if architecture == "fasterrcnn_resnet50_fpn_v2":
        weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT if pretrained else None
        model = fasterrcnn_resnet50_fpn_v2(weights=weights, weights_backbone=None)
    elif architecture == "fasterrcnn_mobilenet_v3_large_320_fpn":
        weights = FasterRCNN_MobileNet_V3_Large_320_FPN_Weights.DEFAULT if pretrained else None
        model = fasterrcnn_mobilenet_v3_large_320_fpn(weights=weights, weights_backbone=None)
    else:
        raise ValueError(f"不支持的模型架构：{architecture}")
    input_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(input_features, num_classes)
    return model
