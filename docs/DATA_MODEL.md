# 领域与数据模型

版本：0.1  
状态：阶段 0 已确认

## 1. 建模原则

- 牙齿身份与牙齿状态分离；
- 原始证据与推演结果分离；
- 用户、设备、AI、医院四类来源分离；
- 更正通过新版本表达，不静默覆盖；
- 删除证据时同步处理依赖结果；
- 每个长期记录都能回答“谁、何时、哪颗牙、什么事件、依据什么”。

## 2. 领域关系

```text
User
├── MouthProfile
│   ├── DentalObject
│   │   ├── DentalObjectVersion
│   │   └── ToothRegion
│   ├── ObservationSession
│   ├── CleaningSession
│   └── DentalCase
│       ├── DentalEvent
│       ├── EvidenceAsset
│       ├── UserRecord
│       ├── DeviceRecord
│       ├── AIAnalysisJob
│       │   ├── AIRecord
│       │   ├── FindingAnnotation
│       │   └── ComparisonSeries
│       ├── HospitalRecord
│       ├── ConversationThread
│       │   └── ConversationMessage
│       ├── ShareGrant
│       ├── EventStatusHistory
│       └── AuditEntry
└── ReminderPreference
    └── ReminderOccurrence
```

## 3. 核心实体

### 3.1 User

代表个人档案拥有者。

关键字段：

- `id`
- `createdAt`
- `status`
- `locale`
- `timezone`

### 3.2 MouthProfile

代表用户的长期口腔画像。

关键字段：

- `id`
- `userId`
- `createdAt`
- `updatedAt`
- `profileVersion`

### 3.3 DentalObject

代表长期稳定的牙齿对象，而不是某次状态。

类型：

- 天然牙；
- 缺牙位置；
- 种植体；
- 其他修复体。

关键字段：

- `id`
- `mouthProfileId`
- `objectType`
- `positionCode`
- `displayName`
- `lifecycleStatus`
- `replacesObjectId`
- `replacedByObjectId`

天然牙拔除后原对象保留为历史；新种植体建立新对象并通过替代关系连接。

### 3.4 DentalObjectVersion

描述同一牙齿对象在某个时间段内的状态。

关键字段：

- `id`
- `dentalObjectId`
- `validFrom`
- `validTo`
- `stateType`
- `sourceType`
- `supersedesVersionId`

### 3.5 ToothRegion

描述牙齿上可观察和比较的区域。

关键字段：

- `id`
- `dentalObjectId`
- `regionType`
- `displayName`

区域名称需要同时支持内部稳定编码和用户易懂名称。

### 3.6 DentalCase

代表一件持续处理的牙齿问题，是照片、AI 报告、咨询、补拍和复查的稳定容器。

关键字段：

- `id`
- `userId`
- `primaryDentalObjectId`
- `relatedDentalObjectIds`
- `regionIds`
- `title`
- `status`
- `openedAt`
- `closedAt`
- `reopenedFromCaseId`
- `createdBySource`

### 3.7 ObservationSession

代表一次设备连接和连续观察过程，可在同一次使用中拍摄多张照片、观察多颗牙齿。

关键字段：

- `id`
- `userId`
- `deviceId`
- `startedAt`
- `endedAt`
- `connectionStatus`
- `streamQuality`
- `interruptedAt`
- `recoveredAt`

一次观察会话可以创建或追加多个 `DentalCase`，但设备连接本身不自动代表完成清洁。

### 3.8 CleaningSession

代表一次用户确认完成的清洁记录，可覆盖全口或指定区域。

关键字段：

- `id`
- `userId`
- `observationSessionId`
- `scopeType`
- `startedAt`
- `completedAt`
- `completionSource`
- `status`
- `correctedAt`

提醒模块只读取有效且已完成的 `CleaningSession`，不能从“连接设备”或“拍照”推断完成清洁。

### 3.9 DentalEvent

代表 `DentalCase` 内的一条时间线活动，也可代表不属于问题事件的独立清洁或习惯记录。

事件类型：

- 拍摄；
- 清洁；
- AI 图片报告；
- 用户确认；
- 医生咨询；
- 就医；
- 治疗；
- 复诊；
- 习惯小结。

关键字段：

- `id`
- `userId`
- `caseId`
- `observationSessionId`
- `cleaningSessionId`
- `eventType`
- `occurredAt`
- `recordedAt`
- `status`
- `parentEventId`
- `createdBySource`

## 4. 牙齿问题事件

牙齿问题事件使用 `DentalCase` 表达，内部每次拍摄、报告、咨询和复查使用 `DentalEvent` 追加到时间线。

用户可见状态：

- 准备中；
- AI 报告已完成；
- 等待医生；
- 医生已回复；
- 待复查；
- 已结束。

系统状态可更细，但不得直接暴露给用户。

状态变化规则：

- 不允许跳过必要证据直接生成医生回复；
- 医生要求补拍时仍属于原事件；
- 事件结束后可因复查重新打开；
- 重新打开保留原完成时间和新状态历史；
- 重复发送不得创建第二个业务事件。

### EventStatusHistory

每次状态变化追加一条记录，不覆盖历史。

关键字段：

- `id`
- `caseId`
- `fromStatus`
- `toStatus`
- `changedAt`
- `changedBySource`
- `reason`

### AuditEntry

记录分享、查看、回复、删除、更正和重新分析等关键动作。

关键字段：

- `id`
- `userId`
- `caseId`
- `actorType`
- `actorId`
- `actionType`
- `targetType`
- `targetId`
- `occurredAt`
- `result`

## 5. 证据与记录

### 5.1 EvidenceAsset

代表照片、视频或文档。

关键字段：

- `id`
- `ownerUserId`
- `caseId`
- `eventId`
- `assetType`
- `capturedAt`
- `deviceId`
- `storageRef`
- `thumbnailRef`
- `contentHash`
- `qualityStatus`
- `deletedAt`

原始文件名不作为存储名或业务身份。

### 5.2 UserRecord

内容：

- 用户问题；
- 感受；
- 备注；
- 对 AI 结果的确认、否定或“看不清”。

用户可以修改或删除个人内容。

### 5.3 DeviceRecord

内容：

- 拍摄时间；
- 样机标识；
- 视频或照片元数据；
- 设备使用记录；
- 连接和拍摄状态。

设备记录描述采集事实，不包含 AI 结论。

### 5.4 AIRecord

内容：

- 图片质量；
- 牙齿与区域定位；
- 疑似食物残留；
- 可见变化；
- 历史对比；
- 疾病初筛判断；
- 建议。

关键字段：

- `modelId`
- `modelVersion`
- `inputEvidenceIds`
- `outputSchemaVersion`
- `screeningCategory`
- `screeningConfidence`
- `visibleEvidence`
- `confidence`
- `limitations`
- `userFeedback`
- `supersedesAIRecordId`

新模型生成新记录，不覆盖旧记录。

### 5.4.1 AIAnalysisJob

代表一次可重试的分析任务，负责区分“分析中、失败”和“已经产生报告”。

关键字段：

- `id`
- `caseId`
- `inputEvidenceIds`
- `status`
- `requestedAt`
- `startedAt`
- `finishedAt`
- `failureCode`
- `retryOfJobId`
- `idempotencyKey`

任务重试不能重复创建业务报告；成功结果通过 `AIRecord` 单独保存和版本化。

### 5.4.2 FindingAnnotation

保存每个可见发现的位置和证据，而不是只保存一段报告文字。

关键字段：

- `id`
- `aiRecordId`
- `evidenceId`
- `findingType`
- `dentalObjectId`
- `regionId`
- `normalizedGeometry`
- `confidence`
- `visibleEvidence`

`normalizedGeometry` 使用相对图片尺寸的坐标，避免缩略图和原图尺寸变化导致标注漂移。

### 5.4.3 ComparisonSeries

代表同牙同区域的多时点线性对比。

关键字段：

- `id`
- `caseId`
- `dentalObjectId`
- `regionId`
- `evidenceIds`
- `comparabilityStatus`
- `comparableArea`
- `limitations`
- `createdAt`
- `modelVersion`

### 5.5 HospitalRecord

内容：

- 医生回复；
- 医院授权摘要；
- 就医、治疗和复诊事件；
- 医院更正。

关键字段：

- `organizationId`
- `practitionerId`
- `externalRecordId`
- `sourceVersion`
- `verifiedAt`
- `supersedesHospitalRecordId`

个人端不能修改医院原文，只能添加个人备注。

## 6. 对话模型

### ConversationThread

每个对话线程必须属于一个 `DentalCase`。

关键字段：

- `id`
- `caseId`
- `channelType`
- `status`
- `createdAt`
- `closedAt`

`channelType`：

- AI；
- 医生；
- AI 转医生。

### ConversationMessage

关键字段：

- `id`
- `threadId`
- `senderType`
- `senderId`
- `sentAt`
- `messageType`
- `textContent`
- `evidenceIds`
- `replyToMessageId`
- `deliveryStatus`

同一线程可包含不同来源消息，但每条消息必须独立标记发送方。

## 7. 分享与授权

### ShareGrant

关键字段：

- `id`
- `userId`
- `caseId`
- `recipientOrganizationId`
- `purpose`
- `includedEvidenceIds`
- `includedRecordIds`
- `createdAt`
- `expiresAt`
- `revokedAt`
- `status`

默认只分享当前事件和用户主动选择的同牙历史。

## 8. 清洁提醒模型

### ReminderPreference

代表用户主动设置的提醒规则。

关键字段：

- `id`
- `userId`
- `enabled`
- `scheduleType`
- `maxInterval`
- `preferredTimes`
- `preferredWeekdays`
- `quietHours`
- `snoozeUntil`
- `pausedUntil`
- `timezone`
- `updatedAt`

### ReminderOccurrence

代表一次计划或已处理的提醒。

关键字段：

- `id`
- `userId`
- `preferenceId`
- `basedOnCleaningSessionId`
- `scheduledAt`
- `deliveredAt`
- `resolution`
- `resolvedAt`

`resolution` 可为：

- 已完成清洁；
- 已补记；
- 稍后提醒；
- 跳过本次；
- 已暂停；
- 未送达。

计算规则：

- 只把状态有效的清洁完成事件作为基准；
- 仅拍照、查看、连接设备不更新基准时间；
- 清洁记录删除、更正或补记后重新计算；
- 时区变化时保留用户意图，避免重复发送；
- 相同提醒窗口只能存在一个待处理提醒；
- 提醒记录不得生成 AI 或医院结论。

## 9. 日历投影

日历不是独立数据源，而是 `DentalEvent` 的查看方式；属于同一 `DentalCase` 的活动在详情页合并成连续过程。

日历条目包含：

- 事件主图标；
- 来源角标；
- 确认或修订状态；
- 主要牙齿；
- 事件时间；
- 当前状态；
- 未读或待处理提示。

同一事件中的每条消息不单独创建日历事件。

## 10. 删除与失效关系

```text
删除照片
→ EvidenceAsset 标记删除并移除内容
→ 依赖该照片的 AIRecord 进入“证据失效”
→ 历史对比不再使用该照片
→ 对话保留必要的文本结构，但明确证据已删除
```

个人数据删除与医院原始记录处理需要分开。

## 11. 必须保持的约束

- 所有记录都有 `userId` 或可验证的用户归属；
- 每次读取和修改均校验资源归属；
- 牙齿身份不确定时不得自动合并；
- AI 记录不得变成医院确认记录；
- 医院记录不得被个人端覆盖；
- 分享范围必须可预览；
- 日历条目必须能回到原始牙齿问题事件和对应时间线活动；
- 所有更正、模型变化和状态变化可追溯。
