import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import { Button, Card, Eyebrow, Pill, SectionTitle } from "../components/ui";
import { analyzeDemoPhoto } from "../services/analysis";
import { WIFI_CAMERA_MODEL, wifiCamera } from "../services/wifiCamera";
import { useApp } from "../state/AppContext";
import { colors, radius, spacing } from "../theme";
import type { AnalysisResult } from "../types";

export function ScanScreen() {
  const { addRecord, camera, setActiveTab, setCamera, t } = useApp();
  const [imageUri, setImageUri] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(false);

  async function connectWifiCamera() {
    if (camera.status === "connected") {
      await wifiCamera.disconnect();
      setCamera({ status: "idle" });
      return;
    }
    setCamera({ status: "connecting" });
    const next = await wifiCamera.connect();
    setCamera(next);
    if (next.status === "protocol-required") {
      Alert.alert(
        "等待真实设备协议",
        "手机已经可以保留 Wi‑Fi 摄像头入口，但需要配套 App 名称、说明书或在线设备才能确认真实视频协议。系统不会用模拟画面冒充实时画面。",
      );
    }
  }

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要照片权限", "请在系统设置中允许 teethsee 读取你主动选择的照片。照片不会自动上传。" );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      exif: false,
      base64: false,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) {
      return;
    }
    if (!asset.uri.startsWith("file:") && !asset.uri.startsWith("content:")) {
      Alert.alert("无法读取照片", "只支持从本机相册安全选择的照片。" );
      return;
    }
    setImageUri(asset.uri);
    setAnalysis(null);
    setSaved(false);
  }

  async function analyze() {
    if (!imageUri || analyzing) {
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await analyzeDemoPhoto(imageUri);
      setAnalysis(result);
    } catch {
      Alert.alert("分析未完成", "当前照片无法处理，请重新选择 JPG 或 PNG 口腔照片。" );
    } finally {
      setAnalyzing(false);
    }
  }

  function saveRecord() {
    if (!analysis || !imageUri || saved) {
      return;
    }
    addRecord(analysis, imageUri);
    setSaved(true);
    Alert.alert("已保存", "照片与本次模拟报告已加入当前 App 会话档案。", [
      { text: "继续扫描" },
      { text: "查看档案", onPress: () => setActiveTab("archive") },
    ]);
  }

  const cameraConnected = camera.status === "connected";
  const cameraConnecting = camera.status === "connecting";

  return (
    <ScreenLayout title={t.scanTitle} subtitle={t.scanCopy}>
      <View style={styles.eyebrowRow}>
        <Eyebrow>{t.scanEyebrow}</Eyebrow>
        <Pill tone="slate">Wi‑Fi ONLY</Pill>
      </View>

      <Card style={styles.cameraCard}>
        <View style={styles.cameraHead}>
          <View style={styles.cameraCopy}>
            <Text style={styles.cameraTitle}>实时口腔画面</Text>
            <Text style={styles.cameraModel}>{t.cameraModel} · {WIFI_CAMERA_MODEL}</Text>
          </View>
          <View style={[styles.liveDot, cameraConnected && styles.liveDotOn]} />
        </View>
        <View style={styles.cameraStage}>
          {cameraConnected ? (
            <Image source={{ uri: camera.previewUri }} style={styles.cameraImage} resizeMode="contain" />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <View style={styles.lens}><View style={styles.lensInner} /></View>
              <Text style={styles.cameraWaiting}>{t.cameraWaiting}</Text>
              <Text style={styles.cameraHint}>{t.cameraPending}</Text>
            </View>
          )}
        </View>
        <Button
          block
          label={cameraConnecting ? "正在检查 Wi‑Fi 摄像头…" : cameraConnected ? "断开 Wi‑Fi" : t.connect}
          disabled={cameraConnecting}
          onPress={() => void connectWifiCamera()}
        />
      </Card>

      <Card>
        <SectionTitle title="拍摄与分析" action={<Pill tone="demo">{t.demo}</Pill>} />
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
        ) : (
          <View style={styles.emptyPhoto}>
            <Text style={styles.emptyPhotoTitle}>还没有选择照片</Text>
            <Text style={styles.emptyPhotoCopy}>仅处理你主动选择的这一张照片。</Text>
          </View>
        )}
        <View style={styles.actionRow}>
          <Button label={t.choosePhoto} variant="secondary" onPress={() => void choosePhoto()} />
          <Button label={analyzing ? t.analyze : "开始分析"} disabled={!imageUri || analyzing} onPress={() => void analyze()} />
        </View>
        {analyzing ? (
          <View style={styles.analyzing}>
            <ActivityIndicator color={colors.teal} />
            <View style={styles.analyzingCopy}>
              <Text style={styles.analyzingTitle}>{t.analyze}</Text>
              <Text style={styles.analyzingText}>检查清晰度与光线 → 定位可见区域 → 生成初步报告</Text>
            </View>
          </View>
        ) : null}
      </Card>

      {analysis ? (
        <Card style={styles.reportCard}>
          <SectionTitle title={t.analysisReady} action={<Pill tone="demo">{t.demo}</Pill>} />
          <Text style={styles.reportTitle}>{analysis.title}</Text>
          <Text style={styles.reportSummary}>{analysis.summary}</Text>
          <View style={styles.reportMetaRow}>
            <Pill tone="teal">{analysis.tooth} 号牙</Pill>
            <Pill tone="slate">{analysis.region}</Pill>
            <Pill tone="amber">可信度 {Math.round(analysis.confidence * 100)}%</Pill>
          </View>
          <Text style={styles.groupTitle}>可见依据</Text>
          {analysis.observations.map((item) => <Text key={item} style={styles.listItem}>• {item}</Text>)}
          <Text style={styles.groupTitle}>建议</Text>
          {analysis.suggestions.map((item) => <Text key={item} style={styles.listItem}>• {item}</Text>)}
          <Text style={styles.boundary}>当前为确定性模拟报告，尚未调用训练模型，也不构成最终牙科诊断。</Text>
          <Button block label={saved ? "已保存至档案" : t.save} disabled={saved} onPress={saveRecord} />
        </Card>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cameraCard: { backgroundColor: colors.mirror, borderColor: colors.mirror, gap: spacing.md },
  cameraHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cameraCopy: { flex: 1, gap: 4 },
  cameraTitle: { color: colors.surface, fontSize: 16, fontWeight: "800" },
  cameraModel: { color: "#9FB8B3", fontSize: 10 },
  liveDot: { width: 10, height: 10, borderRadius: radius.round, backgroundColor: "#6E8581" },
  liveDotOn: { backgroundColor: "#71DEC8" },
  cameraStage: { height: 300, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#091614" },
  cameraImage: { width: "100%", height: "100%" },
  cameraPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  lens: { width: 72, height: 72, borderRadius: radius.round, borderWidth: 2, borderColor: "#54716C", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  lensInner: { width: 30, height: 30, borderRadius: radius.round, backgroundColor: "#173C37" },
  cameraWaiting: { color: colors.surface, fontSize: 16, fontWeight: "800", textAlign: "center" },
  cameraHint: { color: "#91AAA5", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 },
  selectedImage: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.mirror },
  emptyPhoto: { height: 150, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: spacing.md },
  emptyPhotoTitle: { color: colors.ink, fontWeight: "800" },
  emptyPhotoCopy: { color: colors.inkSoft, fontSize: 12, marginTop: 5 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  analyzing: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.tealDim },
  analyzingCopy: { flex: 1, gap: 4 },
  analyzingTitle: { color: colors.tealDark, fontWeight: "800" },
  analyzingText: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  reportCard: { gap: spacing.sm },
  reportTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", lineHeight: 27 },
  reportSummary: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  reportMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  groupTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: spacing.sm },
  listItem: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  boundary: { color: colors.demo, fontSize: 11, lineHeight: 17, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.demoDim },
});
