import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tabLabel } from "../i18n";
import { colors, radius } from "../theme";
import type { Language, TabKey } from "../types";

const tabs: Array<{ key: TabKey; icon: string }> = [
  { key: "home", icon: "⌂" },
  { key: "archive", icon: "▦" },
  { key: "scan", icon: "+" },
  { key: "calendar", icon: "□" },
  { key: "profile", icon: "○" },
];

export function BottomTabs({
  active,
  language,
  onChange,
}: {
  active: TabKey;
  language: Language;
  onChange(tab: TabKey): void;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const primary = tab.key === "scan";
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <View style={[styles.icon, primary && styles.primaryIcon, selected && !primary && styles.selectedIcon]}>
              <Text style={[styles.iconText, (primary || selected) && styles.selectedIconText]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{tabLabel(language, tab.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 86,
    paddingBottom: 18,
    paddingTop: 8,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  icon: { width: 30, height: 30, borderRadius: radius.round, alignItems: "center", justifyContent: "center" },
  primaryIcon: { width: 44, height: 44, marginTop: -18, backgroundColor: colors.ink },
  selectedIcon: { backgroundColor: colors.tealDim },
  iconText: { color: colors.inkSoft, fontSize: 18, fontWeight: "900" },
  selectedIconText: { color: colors.surface },
  label: { color: colors.inkFaint, fontSize: 10, fontWeight: "700" },
  selectedLabel: { color: colors.ink },
});
