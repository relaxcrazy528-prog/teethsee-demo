import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomTabs } from "./src/components/BottomTabs";
import { ArchiveScreen } from "./src/screens/ArchiveScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { AppProvider, useApp } from "./src/state/AppContext";
import { colors } from "./src/theme";

function AppShell() {
  const { activeTab, language, setActiveTab } = useApp();
  const Screen = {
    home: HomeScreen,
    archive: ArchiveScreen,
    scan: ScanScreen,
    calendar: CalendarScreen,
    profile: ProfileScreen,
  }[activeTab];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <Screen />
        <BottomTabs active={activeTab} language={language} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  app: { flex: 1, backgroundColor: colors.canvas },
});
