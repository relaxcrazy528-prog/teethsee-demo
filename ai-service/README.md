# teethsee AI 图片识别服务（v0.1）

这是与公开静态演示和用户数据服务隔离的本地 AI 验证模块。它使用开源 ResNet50 权重，对一张口内照片输出六类概率：牙结石、龋齿、牙龈炎、溃疡、牙齿着色和先天缺牙。

长期训练、推理和 Agent 分层方案见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

当前开发机是 Intel Mac。较新的 PyTorch 已不再提供该平台安装包，而最后兼容版本存在已知安全问题，因此正式推理已改为 ONNX Runtime。PyTorch 只在隔离的一次性转换步骤中使用，不属于服务运行依赖。

## 当前能力边界

- 这是图像级分类，暂时不能标出具体牙齿或病变区域；
- 模型没有“健康”和“食物残留”类别，不能评价牙齿是否干净；
- 低置信度、低质量和未知分布图片会返回“无法确定”；
- 来源模型公布的测试指标尚未经过 teethsee 独立复核；
- 本模块用于研发验证，不能作为最终临床确诊依据。

模型来源：[nsr51324/Oral_Diseases_Image_Classification](https://huggingface.co/nsr51324/Oral_Diseases_Image_Classification)。模型仓库标注 MIT；其训练数据另有使用条款，进入商业产品前需要单独完成数据来源与许可审查。

## 安装与下载

```bash
cd ai-service
uv sync --frozen
uv run python scripts/download_model.py
```

下载脚本只访问固定的 Hugging Face 文件地址，并验证官方仓库公布的 SHA-256。下载到的是原始转换源文件，服务运行使用经过校验的 `models/oral-diseases-resnet50.onnx`。模型文件保存在 `models/`，不会提交到 GitHub，也不会在本仓库重新分发第三方权重。

当前研发电脑已经完成 ONNX 转换和结果一致性验证。新的开发环境需要在隔离的 Linux 转换环境中，把固定版本的源权重导出为 ONNX opset 17；转换流程将在部署阶段做成独立构建任务，不能把旧版 Intel Mac PyTorch 放回服务依赖。

## 命令行验证

```bash
uv run python -m teethsee_ai.cli /绝对路径/口腔照片.jpg
```

## 启动本地接口

```bash
uv run python -m teethsee_ai.server --host 127.0.0.1 --port 8788
```

接口：

- `GET /health`：服务进程状态；
- `GET /ready`：模型是否已经下载并可以加载；
- `POST /v1/analyze`：请求体直接发送 PNG 或 JPEG 二进制，单张上限 8MB。

本地请求示例：

```bash
curl --fail --silent \
  -H 'Content-Type: image/jpeg' \
  --data-binary '@/绝对路径/口腔照片.jpg' \
  http://127.0.0.1:8788/v1/analyze
```

服务强制只监听本机回环地址。若后续需要网页访问，通过 `TEETHSEE_AI_ALLOWED_ORIGINS` 设置明确的网页来源白名单，不接受通配符。正式远程部署需要在它前面增加认证、HTTPS 和网关限流，不能直接暴露这个本地研发接口。

## 验证

```bash
uv run pytest
```
