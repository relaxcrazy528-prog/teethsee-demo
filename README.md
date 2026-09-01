# teethsee

teethsee 是带摄像头的智能可视冲牙器演示系统，提供实时口腔画面、照片归档、模拟 AI 初筛报告、牙齿长期记录、日历回顾和咨询流程。

## 在线演示

[打开 teethsee 在线演示](https://relaxcrazy528-prog.github.io/teethsee-demo/)

备用地址：[https://csgeekr.com/teethsee](https://csgeekr.com/teethsee)

## 本地使用

直接用浏览器打开根目录的 `index.html`。USB 摄像头功能需要浏览器支持媒体设备接口并授予相机权限。

## 文件结构

- `index.html`：完整网页与交互逻辑。
- `assets/`：本地演示图片素材。
- `smoke-test.mjs`：功能、安全与中英文覆盖检查。
- `mobile/`：iOS/Android 共用的 React Native + Expo 手机 App。
- `backend/`：正在开发的真实数据服务，包含牙齿档案、时间线、私有照片、消息和医院接入接口；尚未接入公开演示。

## 验证

```bash
node smoke-test.mjs
```

公开网页当前仍是离线演示：AI 报告为确定性的模拟结果。仓库中的 `ai-service/` 已开始独立开发真实离线图片分类，不会改变现有 GitHub Pages 演示地址。

## AI 图片识别研发

`ai-service/` 提供本地运行的第一阶段真实模型验证：安全读取 PNG/JPEG 口腔照片，调用开源 ResNet50 六分类模型并输出结构化初步观察。模型权重不会提交到 GitHub，安装、下载、能力边界和使用方式见 [`ai-service/README.md`](ai-service/README.md)。

`ai-training/` 提供针对牙医标注图片的患者级数据审计、脱敏复制、龋齿目标检测训练、独立评估与 ONNX 导出程序，详见 [`ai-training/README.md`](ai-training/README.md)。原始口腔照片、训练清单和模型权重均不会提交到 GitHub。

真实数据服务的设计与验证方法见 [`backend/README.md`](backend/README.md)。为保证现有在线演示稳定，后端在完成正式身份登录和部署配置前保持隔离。
