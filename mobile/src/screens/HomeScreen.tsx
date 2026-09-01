import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { RecordRow } from "../components/RecordRow";
import { ScreenLayout } from "../components/ScreenLayout";
import { Button, Card, Eyebrow, Pill, SectionTitle } from "../components/ui";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme";

export function HomeScreen() {
  const { camera, records, setActiveTab, t } = useApp();
  const cameraConnected = camera.status === "connected";

  return (
    <ScreenLayout title={t.streak} subtitle={t.streakCopy}>
      <View style={styles.actions}>
        <Button label={t.scanTeeth} onPress={() => setActiveTab("scan")} />
        <Button label={t.choosePhoto} variant="secondary" onPress={() => setActiveTab("scan")} />
      </View>

      <Card style={styles.streakCard}>
        <Eyebrow>{t.greeting}</Eyebrow>
        <View style={styles.weekRow}>
          {[62, 45, 74, 51, 80, 18, 28].map((height, index) => (
            <View key={`${height}-${index}`} style={styles.day}>
              <View style={[styles.bar, { height }, index < 5 && styles.barDone, index === 6 && styles.barToday]} />
              <Text style={styles.dayText}>{["一", "二", "三", "四", "五", "六", "日"][index]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.deviceHead}>
          <View style={styles.deviceCopy}>
            <Eyebrow>{t.device}</Eyebrow>
            <Text style={styles.deviceTitle}>HCSK-352013A-X1-230731</Text>
            <Text style={styles.deviceStatus}>{cameraConnected ? "Wi‑Fi 实时画面已连接" : t.disconnected}</Text>
          </View>
          <View style={[styles.deviceDot, cameraConnected && styles.deviceDotOn]} />
        </View>
        <Button block label={t.connect} variant="ghost" onPress={() => setActiveTab("scan")} />
      </Card>

      <Card>
        <SectionTitle title="你的牙齿地图" action={<Pill tone="amber">2 处待观察</Pill>} />
        <View style={styles.toothMap}>
          {Array.from({ length: 32 }, (_, index) => (
            <View key={index} style={[styles.tooth, (index === 5 || index === 21) && styles.toothWatch]} />
          ))}
        </View>
        <Text style={styles.mapMeta}>建档覆盖 23 / 32 · 长期身份持续建立中</Text>
      </Card>

      <Card>
        <SectionTitle title={t.latestReport} action={<Pill tone="demo">DEMO DATA</Pill>} />
        {records.slice(0, 3).map((record) => <RecordRow key={record.id} record={record} />)}
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  streakCard: { backgroundColor: colors.ink },
  weekRow: { height: 110, flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: spacing.md },
  day: { flex: 1, alignItems: "center", gap: 7 },
  bar: { width: "100%", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)" },
  barDone: { backgroundColor: colors.teal },
  barToday: { backgroundColor: colors.amber },
  dayText: { color: "#B9CBC7", fontSize: 10, fontWeight: "700" },
  deviceHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  deviceCopy: { flex: 1, gap: 5 },
  deviceTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  deviceStatus: { color: colors.inkSoft, fontSize: 12 },
  deviceDot: { width: 10, height: 10, borderRadius: radius.round, backgroundColor: colors.inkFaint },
  deviceDotOn: { backgroundColor: colors.teal },
  toothMap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: spacing.md },
  tooth: { width: "9.3%", aspectRatio: 0.74, borderRadius: 7, backgroundColor: colors.tealDim, borderWidth: 1, borderColor: colors.line },
  toothWatch: { backgroundColor: colors.coralDim, borderColor: colors.coral },
  mapMeta: { color: colors.inkSoft, fontSize: 12 },
});
