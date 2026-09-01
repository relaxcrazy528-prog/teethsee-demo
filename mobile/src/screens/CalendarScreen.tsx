import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import { Card, Pill, SectionTitle } from "../components/ui";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme";

export function CalendarScreen() {
  const { records, t } = useApp();
  return (
    <ScreenLayout title={t.calendarTitle} subtitle="按时间、事件和来源回顾自己的长期牙齿状态。">
      <Card>
        <SectionTitle title="2026 年 7 月" action={<Pill tone="slate">月视图</Pill>} />
        <View style={styles.calendarGrid}>
          {Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            const event = day === 20 || day === 25 || day === 26;
            return (
              <View key={day} style={[styles.day, event && styles.eventDay]}>
                <Text style={[styles.dayText, event && styles.eventDayText]}>{day}</Text>
                {event ? <View style={styles.eventDot} /> : null}
              </View>
            );
          })}
        </View>
      </Card>
      <Card>
        <SectionTitle title="本月事件" action={<Pill tone="teal">{records.length}</Pill>} />
        {records.map((record) => (
          <View key={record.id} style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineCopy}>
              <Text style={styles.timelineTitle}>{record.title}</Text>
              <Text style={styles.timelineMeta}>{new Date(record.createdAt).toLocaleDateString("zh-CN")} · {record.tooth} 号牙</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { width: "12.5%", aspectRatio: 1, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  eventDay: { backgroundColor: colors.tealDim },
  dayText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  eventDayText: { color: colors.tealDark },
  eventDot: { width: 4, height: 4, borderRadius: radius.round, backgroundColor: colors.teal, marginTop: 2 },
  timelineRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  timelineDot: { width: 9, height: 9, borderRadius: radius.round, marginTop: 5, backgroundColor: colors.teal },
  timelineCopy: { flex: 1, gap: 4 },
  timelineTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  timelineMeta: { color: colors.inkSoft, fontSize: 12 },
});
