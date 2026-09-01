export type TabKey = "home" | "archive" | "scan" | "calendar" | "profile";
export type Language = "zh-CN" | "en";
export type RecordSource = "user" | "device" | "ai" | "dentist";

export type OralRecord = {
  id: string;
  title: string;
  summary: string;
  tooth: string;
  region: string;
  source: RecordSource;
  imageUri?: string;
  createdAt: string;
  confidence?: number;
};

export type AnalysisResult = {
  title: string;
  summary: string;
  tooth: string;
  region: string;
  confidence: number;
  observations: string[];
  suggestions: string[];
  simulated: true;
};

export type WifiCameraState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "protocol-required"; model: string }
  | { status: "connected"; model: string; previewUri: string }
  | { status: "error"; message: string };
