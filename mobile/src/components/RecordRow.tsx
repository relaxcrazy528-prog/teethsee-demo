import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { OralRecord, RecordSource } from "../types";
import { Pill } from "./ui";

const sourceLabel: Record<RecordSource, string> = {
  user: "我的记录",
  device: "设备记录",
  ai: "AI 报告",
  dentist: "医院确认",
};

const sourceTone: Record<RecordSource, "teal" | "amber" | "demo" | "slate"> = {
  user: "amber",
  device: "slate",
  ai: "teal",
  dentist: "demo",
};

export function RecordRow({ record }: { record: OralRecord }) {
  return (
    <View style={styles.row}>
      {record.imageUri ? (
        <Image source={{ uri: record.imageUri }} style={styles.image} />
      ) : (
        <View style={styles.icon}>
          <Text style={styles.iconText}>{record.tooth}</Text>
        </View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{record.title}</Text>
        <Text style={styles.meta} numberOfLines={2}>{record.summary}</Text>
        <Pill tone={sourceTone[record.source]}>{sourceLabel[record.source]}</Pill>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  image: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.mirror },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealDim,
  },
  iconText: { color: colors.tealDark, fontWeight: "900", fontSize: 13 },
  copy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  meta: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
});
