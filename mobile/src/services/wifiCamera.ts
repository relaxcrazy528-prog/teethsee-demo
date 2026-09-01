import type { WifiCameraState } from "../types";

export const WIFI_CAMERA_MODEL = "HCSK-352013A-X1-230731";

export type WifiCameraAdapter = {
  connect(): Promise<WifiCameraState>;
  disconnect(): Promise<void>;
};

class ProtocolPendingAdapter implements WifiCameraAdapter {
  async connect(): Promise<WifiCameraState> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { status: "protocol-required", model: WIFI_CAMERA_MODEL };
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

// 设备厂商协议确认后，仅替换这个适配器；页面和档案流程不需要重写。
export const wifiCamera: WifiCameraAdapter = new ProtocolPendingAdapter();
