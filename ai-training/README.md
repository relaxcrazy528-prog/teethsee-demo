# teethsee 龋齿检测训练程序（v0.1）

本模块针对 `Dataset2` 的 Labelme 标注训练口内照片龋齿目标检测模型。训练使用云端 Linux GPU；Intel Mac 只负责数据审计和 ONNX 推理。

## 数据结论

- 数据来源与本地目录结构匹配公开数据集 [Annotated intraoral image dataset for dental caries detection](https://doi.org/10.5281/zenodo.14827784)；
- `D`：恒牙可见龋坏；`d`：乳牙可见龋坏；
- 标注框覆盖有可见龋坏的牙齿，不是每一颗牙；
- 本地副本有 6,265 张 JPEG，其中 2,245 个 Labelme 文件；18 个标注找不到对应图片，27 个仅含异常标签，最终使用 2,200 张；
- 原 COCO 划分存在患者跨集合泄漏，训练程序不会使用它；
- `M/m` 和 `line` 不属于论文定义的有效标签；仅含这些异常标签的图片会被隔离，不能冒充健康负样本；
- 没有 Labelme 文件的图片不会擅自作为健康负样本；已有空 Labelme 文件可作为确认无框样本；
- 760 张本地图片含 EXIF。上传云端前应运行脱敏复制命令，原图不会被修改。

聚合审计结果见 [`reports/dataset2-audit.json`](reports/dataset2-audit.json)。

## 1. 本地准备患者级清单

从 `ai-service` 已安装的 Python 环境运行，不需要 PyTorch：

```bash
cd ai-service
PYTHONPATH=../ai-training/src uv run python -m teethsee_training.prepare \
  --dataset-root '/Users/zoe/Desktop/黑客松/Dataset2' \
  --output-dir ../ai-training/manifests/dataset2
```

程序会生成：

- `manifest.jsonl`：训练、验证、测试清单；
- `dataset-audit.json`：类别、坏标注、患者分组与划分统计；
- `dataset-metadata.json`：标签与数据来源信息。

清单只保存相对路径和不可逆分组 ID，不保存原始患者编号。

## 2. 创建无 EXIF 的训练副本

```bash
PYTHONPATH=../ai-training/src uv run python -m teethsee_training.sanitize \
  --dataset-root '/Users/zoe/Desktop/黑客松/Dataset2' \
  --manifest ../ai-training/manifests/dataset2/manifest.jsonl \
  --output-dir ../ai-training/sanitized-data/dataset2
```

输出使用随机化样本 ID 作为文件名，不包含原始患者编号。目标目录必须为空，程序不会覆盖已有文件。

## 3. 云端训练

在 Linux GPU 机器上：

```bash
cd ai-training
uv sync --frozen
uv run python -m teethsee_training.train \
  --dataset-root /private/dataset2-sanitized \
  --manifest /private/dataset2-sanitized/manifest.jsonl \
  --architecture fasterrcnn_resnet50_fpn_v2 \
  --output-dir outputs/caries-resnet50-v1
```

可选模型：

- `fasterrcnn_resnet50_fpn_v2`：服务器高精度基线；
- `fasterrcnn_mobilenet_v3_large_320_fpn`：轻量 CPU 基线。

训练输出：

- `best.safetensors`：纯张量权重，不使用可执行 pickle；
- `model-config.json`：模型、标签、阈值和数据指纹；
- `metrics.jsonl`：每轮训练损失和患者级验证指标；
- `test-metrics.json`：只在最终模型确定后运行一次的测试集结果。

## 4. 导出 ONNX

```bash
uv sync --frozen --group export
uv run python -m teethsee_training.export_onnx \
  --weights outputs/caries-resnet50-v1/best.safetensors \
  --config outputs/caries-resnet50-v1/model-config.json \
  --output outputs/caries-resnet50-v1/model.onnx
```

## 重要边界

- 本数据只覆盖 10–24 岁、单一手机采集来源；不能直接代表冲牙器摄像头和其他年龄人群；
- 训练后必须使用 teethsee 摄像头独立测试集做外部验证；
- 公开数据的本地副本没有携带明确许可证文件，商业部署前需确认数据使用条款；
- 当前程序输出“疑似可见龋坏区域”，不输出牙结石、牙龈炎或清洁程度。
