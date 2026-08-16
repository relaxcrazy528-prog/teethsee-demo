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
- `backend/`：正在开发的真实数据服务，包含牙齿档案、时间线、私有照片、消息和医院接入接口；尚未接入公开演示。

## 验证

```bash
node smoke-test.mjs
```

当前版本是离线演示：AI 报告为确定性的模拟结果，不是真实医学诊断。

真实数据服务的设计与验证方法见 [`backend/README.md`](backend/README.md)。为保证现有在线演示稳定，后端在完成正式身份登录和部署配置前保持隔离。
