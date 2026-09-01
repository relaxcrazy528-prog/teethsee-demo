import React from "react";
import { StyleSheet, Text } from "react-native";
import { RecordRow } from "../components/RecordRow";
import { ScreenLayout } from "../components/ScreenLayout";
import { Card, Pill, SectionTitle } from "../components/ui";
import { useApp } from "../state/AppContext";
import { colors } from "../theme";

export function ArchiveScreen() {
  const { records, t } = useApp();
  return (
    <ScreenLayout title={t.archiveTitle} subtitle="按牙齿查看照片、清洁、就医、治疗和复诊记录。">
      <Card>
        <SectionTitle title="全部记录" action={<Pill tone="teal">{records.length} 条</Pill>} />
        {records.length ? records.map((record) => <RecordRow key={record.id} record={record} />) : <Text style={styles.empty}>{t.archiveEmpty}</Text>}
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.inkSoft, paddingVertical: 24, textAlign: "center" },
});
