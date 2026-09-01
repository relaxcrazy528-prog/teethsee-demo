import type { OralRecord } from "../types";

export const seedRecords: OralRecord[] = [
  {
    id: "seed-ai-16",
    title: "右上牙龈线附近可见黄褐色附着",
    summary: "16 号牙 · 中等可信度 · 模拟结果",
    tooth: "16",
    region: "牙龈边缘",
    source: "ai",
    createdAt: "2026-07-26T07:42:00+08:00",
    confidence: 0.73,
  },
  {
    id: "seed-dentist-16",
    title: "16 号牙复查建议",
    summary: "陈医生回复 · 建议补拍咬合面",
    tooth: "16",
    region: "咬合面",
    source: "dentist",
    createdAt: "2026-07-25T16:40:00+08:00",
  },
  {
    id: "seed-device-full",
    title: "完成一次可视清洁",
    summary: "冲牙器样机 · 设备记录",
    tooth: "全口",
    region: "全口",
    source: "device",
    createdAt: "2026-07-20T22:05:00+08:00",
  },
];
