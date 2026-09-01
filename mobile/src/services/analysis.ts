import type { AnalysisResult } from "../types";

export async function analyzeDemoPhoto(imageUri: string): Promise<AnalysisResult> {
  if (!imageUri.startsWith("file:") && !imageUri.startsWith("content:")) {
    throw new Error("UNSUPPORTED_IMAGE_SOURCE");
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  return {
    title: "发现一处需要留意的可见区域",
    summary: "右下后牙表面可见颜色与周围不同的区域，建议补拍更清晰角度并持续观察。",
    tooth: "46",
    region: "咬合面",
    confidence: 0.72,
    observations: ["局部颜色与邻近牙面不同", "当前照片清晰度满足演示分析"],
    suggestions: ["换一个角度补拍", "如有疼痛或持续不适，咨询牙医"],
    simulated: true,
  };
}
