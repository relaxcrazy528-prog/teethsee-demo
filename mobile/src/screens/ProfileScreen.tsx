import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import { Card, Pill, SectionTitle } from "../components/ui";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme";

export function ProfileScreen() {
  const { language, setLanguage, t } = useApp();
  return (
    <ScreenLayout title={t.profileTitle} subtitle="每位家庭成员都有独立的牙齿地图和历史记录。">
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>E</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>Emma</Text>
          <Text style={styles.profileMeta}>最近扫描：今天</Text>
        </View>
        <Pill tone="teal">当前使用</Pill>
      </Card>
      <Card>
        <SectionTitle title="语言 / Language" />
        <View style={styles.languageRow}>
          {(["zh-CN", "en"] as const).map((item) => {
            const active = language === item;
            return (
              <Pressable key={item} onPress={() => setLanguage(item)} style={[styles.languageButton, active && styles.languageButtonActive]}>
                <Text style={[styles.languageText, active && styles.languageTextActive]}>{item === "zh-CN" ? "中文" : "English"}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card>
        <SectionTitle title="数据与设备" />
        <Setting title="照片与报告" detail="首版仅保留在当前 App 会话；正式档案将接入加密本地存储和私有云端。" />
        <Setting title="Wi‑Fi 摄像头" detail="仅支持 HCSK-352013A-X1-230731；协议确认后启用真实预览。" />
        <Setting title="AI 模型" detail="当前为模拟报告；训练模型将在 App 与服务器接口完成后接入。" />
      </Card>
    </ScreenLayout>
  );
}

function Setting({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.setting}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: radius.round, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber },
  avatarText: { color: colors.surface, fontSize: 22, fontWeight: "900" },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  profileMeta: { color: colors.inkSoft, fontSize: 12 },
  languageRow: { flexDirection: "row", gap: spacing.sm },
  languageButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.round },
  languageButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  languageText: { color: colors.inkSoft, fontWeight: "800" },
  languageTextActive: { color: colors.surface },
  setting: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 },
  settingTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  settingDetail: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
});
