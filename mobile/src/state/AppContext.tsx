import React, { createContext, useContext, useMemo, useState } from "react";
import { seedRecords } from "../data/demo";
import { getCopy } from "../i18n";
import type { AnalysisResult, Language, OralRecord, TabKey, WifiCameraState } from "../types";

type AppContextValue = {
  activeTab: TabKey;
  setActiveTab(tab: TabKey): void;
  language: Language;
  setLanguage(language: Language): void;
  t: ReturnType<typeof getCopy>;
  records: OralRecord[];
  addRecord(result: AnalysisResult, imageUri: string): void;
  camera: WifiCameraState;
  setCamera(state: WifiCameraState): void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: React.PropsWithChildren) {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [language, setLanguage] = useState<Language>("zh-CN");
  const [records, setRecords] = useState<OralRecord[]>(seedRecords);
  const [camera, setCamera] = useState<WifiCameraState>({ status: "idle" });

  const value = useMemo<AppContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      language,
      setLanguage,
      t: getCopy(language),
      records,
      addRecord(result, imageUri) {
        const now = new Date();
        setRecords((current) => [
          {
            id: `local-${now.getTime()}`,
            title: result.title,
            summary: result.summary,
            tooth: result.tooth,
            region: result.region,
            source: "ai",
            imageUri,
            createdAt: now.toISOString(),
            confidence: result.confidence,
          },
          ...current,
        ]);
      },
      camera,
      setCamera,
    }),
    [activeTab, camera, language, records],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return value;
}
