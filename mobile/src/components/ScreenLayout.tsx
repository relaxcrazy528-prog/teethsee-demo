import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";
import { ToothLogo } from "./ui";

export function ScreenLayout({
  title,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandRow}>
        <ToothLogo compact />
        <Text style={styles.brand}>teethsee</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 120 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: spacing.lg },
  brand: { color: colors.ink, fontSize: 19, fontWeight: "900", letterSpacing: -0.4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 6 },
  body: { marginTop: spacing.lg, gap: spacing.md },
});
