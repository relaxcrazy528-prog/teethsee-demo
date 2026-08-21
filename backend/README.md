# teethsee 数据服务（v0.2）

本目录是与公开静态演示隔离的真实数据底座。根目录 `index.html` 与现有 GitHub Pages 地址不会因这里的开发而改变。

## 已实现

- 用户身份映射与个人设置；
- 个人牙齿档案，以及按 FDI 国际牙位编号建立的 32 颗恒牙主档；
- 拍摄、清洁、咨询、就医、治疗、复诊、备注及医院导入事件；
- 按时间、牙齿和事件类型查询长期时间线；
- 私有 PNG 照片上传、授权读取与可恢复软删除；
- 用户与机构之间的限时授权；
- 医师/机构消息；
- 医院外部记录幂等导入；
- 写操作审计日志；
- 跨用户和跨机构的服务端权限检查。
- Sites 身份与标准 OIDC 双模式认证；
- 对读取、写入、图片、消息和医院导入接口进行账号/IP 限流。

## 存储

- `migrations/0001_initial.sql`：D1/SQLite 数据结构；
- `DB`：结构化数据绑定；
- `PHOTOS`：私有对象存储绑定，照片不生成公开 URL。

上传端应先用 Canvas 或原生图像 API 将照片重新编码为 PNG，以移除 EXIF。服务端会再次检查文件签名、尺寸、体积和常见元数据块，单张上限为 8MB。

删除照片采用软删除：用户界面立即不可见，文件保留到后续清理任务处理，避免误删后无法恢复。

## 身份边界

`AUTH_MODE=sites` 时，身份适配器只信任 Sites 运行时注入的 `oai-authenticated-user-*` 请求头，`worker.mjs` 不得作为允许客户端自行设置这些请求头的裸 Worker 对外发布。

正式部署使用 `AUTH_MODE=oidc`，并配置可信的 `OIDC_ISSUER`、`OIDC_JWKS_URL` 和 `OIDC_AUDIENCE`。后端会校验 JWT 签名、算法、发行方、受众、签发时间和过期时间，不自行实现密码系统。浏览器端应通过服务端会话/BFF 使用 HttpOnly Cookie，不把令牌写入 localStorage；iOS 客户端可以使用系统安全存储管理短期令牌。

`AUTH_MODE=hybrid` 只用于处在 Sites 可信代理之后的过渡阶段。直接暴露的 API 不应启用该模式。

## API 摘要

- `GET/PATCH /v1/me`
- `GET/POST /v1/profiles`
- `GET /v1/profiles/:id`
- `GET /v1/profiles/:id/timeline`
- `PUT /v1/profiles/:id/teeth/:fdi`
- `POST /v1/profiles/:id/events`
- `GET/POST /v1/profiles/:id/messages`
- `POST/DELETE /v1/profiles/:id/shares[/:organizationId]`
- `GET /v1/events/:id`
- `POST /v1/events/:id/photos`
- `GET/DELETE /v1/photos/:id`
- `GET /v1/organizations`
- `POST /v1/organizations/:id/imports`

## 本地验证

安装锁定依赖并验证：

```bash
cd backend
npm ci
npm run verify
```

本阶段不会接入真实 AI，也不会改变当前公开演示。下一阶段在确定正式身份服务和部署环境后，再接入网页端。
