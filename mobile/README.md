# teethsee Mobile

teethsee 的 iOS/Android 共用手机 App，使用 React Native + Expo + TypeScript。现有网页和 GitHub Pages 演示保持不变，手机端代码独立放在 `mobile/`。

## 当前首版

- 首页、档案、扫描、日历、我的五个主入口；
- 中文/英文切换；
- 从系统相册选择单张口腔照片；
- 确定性的模拟分析、结果标记和当前会话档案；
- 只保留 Wi‑Fi 摄像头入口，型号固定为 `HCSK-352013A-X1-230731`；
- Wi‑Fi 摄像头和真实 AI 模型都采用可替换适配器，不伪造已连接状态。

## 本地运行

依赖已安装并锁定到 Expo 57。当前电脑尚未安装完整 Xcode，因此可以先使用 Expo Go 真机预览；生成正式 iOS 安装包前需要安装完整 Xcode。

```bash
cd mobile
npm install
npm run typecheck
npm start
```

使用 Expo Go 扫描终端二维码，可在 Android 或 iPhone 上预览。正式 iOS 构建需要完整 Xcode，正式 Android 构建需要 Android Studio/SDK 或 EAS Build。

## 设备和模型接入点

- `src/services/wifiCamera.ts`：替换为厂商 Wi‑Fi 视频协议适配器；
- `src/services/analysis.ts`：替换为本地模型或后端推理 API；
- `src/state/AppContext.tsx`：后续接入加密本地数据库和真实账号档案。

当前口腔照片只保留在 App 会话中，不上传云端、不写入日志。正式用户数据存储上线前需要单独进行隐私、安全和权限审查。
