import type { Language, TabKey } from "./types";

const copy = {
  "zh-CN": {
    tabs: { home: "首页", archive: "档案", scan: "扫描", calendar: "日历", profile: "我的" },
    greeting: "早上好，Emma",
    streak: "已连续使用 12 天",
    streakCopy: "继续保持——这周你已经连续冲牙 5 天了。",
    scanTeeth: "扫描我的牙齿",
    choosePhoto: "从相册选择",
    device: "智能冲牙器",
    disconnected: "Wi‑Fi 摄像头未连接",
    connect: "连接 Wi‑Fi",
    latestReport: "最新报告",
    archiveTitle: "你的牙齿变化记录",
    archiveEmpty: "还没有保存的观察记录",
    calendarTitle: "按日期查看历史",
    profileTitle: "Emma（本人）",
    scanEyebrow: "冲牙中",
    scanTitle: "继续冲牙就好",
    scanCopy: "连接 Wi‑Fi 摄像头后显示实时画面，也可以先从相册选择照片。",
    cameraWaiting: "等待 Wi‑Fi 摄像头画面",
    cameraModel: "摄像头型号",
    cameraPending: "真实视频协议尚未确认，当前不会显示模拟实时画面。",
    analyze: "AI 正在分析",
    analysisReady: "初步观察报告",
    save: "保存至档案",
    demo: "模拟结果",
  },
  en: {
    tabs: { home: "Home", archive: "Records", scan: "Scan", calendar: "Calendar", profile: "Me" },
    greeting: "Good morning, Emma",
    streak: "12-day streak",
    streakCopy: "Keep going — you have flossed 5 days this week.",
    scanTeeth: "Scan my teeth",
    choosePhoto: "Choose photo",
    device: "Smart water flosser",
    disconnected: "Wi-Fi camera disconnected",
    connect: "Connect Wi-Fi",
    latestReport: "Latest report",
    archiveTitle: "Your tooth history",
    archiveEmpty: "No saved observations yet",
    calendarTitle: "Review history by date",
    profileTitle: "Emma (You)",
    scanEyebrow: "Flossing",
    scanTitle: "Keep flossing",
    scanCopy: "Live video appears after the Wi-Fi camera connects. You can also choose a photo first.",
    cameraWaiting: "Waiting for Wi-Fi camera video",
    cameraModel: "Camera model",
    cameraPending: "The real video protocol is not confirmed. No simulated live video is shown.",
    analyze: "AI is analyzing",
    analysisReady: "Preliminary observation",
    save: "Save to records",
    demo: "Simulated result",
  },
} as const;

export function getCopy(language: Language) {
  return copy[language];
}

export function tabLabel(language: Language, tab: TabKey) {
  return getCopy(language).tabs[tab];
}
