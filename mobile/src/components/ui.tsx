import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../theme";

export function ToothLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.logo, compact && styles.logoCompact]} accessibilityLabel="teethsee">
      <View style={styles.logoCrown} />
      <View style={styles.logoRootLeft} />
      <View style={styles.logoRootRight} />
    </View>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Eyebrow({ children }: React.PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Pill({ children, tone = "teal" }: React.PropsWithChildren<{ tone?: "teal" | "amber" | "demo" | "slate" }>) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{children}</Text>
    </View>
  );
}

type ButtonProps = PressableProps & {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  block?: boolean;
};

export function Button({ label, variant = "primary", block = false, disabled, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        block && styles.buttonBlock,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      {...props}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.tealDim,
    position: "relative",
  },
  logoCompact: { width: 31, height: 31, borderRadius: 11 },
  logoCrown: {
    position: "absolute",
    top: "22%",
    left: "25%",
    width: "50%",
    height: "44%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.teal,
  },
  logoRootLeft: {
    position: "absolute",
    width: 5,
    height: 11,
    left: "35%",
    top: "55%",
    borderRadius: 5,
    backgroundColor: colors.teal,
    transform: [{ rotate: "12deg" }],
  },
  logoRootRight: {
    position: "absolute",
    width: 5,
    height: 11,
    right: "35%",
    top: "55%",
    borderRadius: 5,
    backgroundColor: colors.teal,
    transform: [{ rotate: "-12deg" }],
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  pill_teal: { backgroundColor: colors.tealDim },
  pill_amber: { backgroundColor: colors.amberDim },
  pill_demo: { backgroundColor: colors.demoDim },
  pill_slate: { backgroundColor: colors.slateDim },
  pillText: { fontSize: 10, fontWeight: "800" },
  pillText_teal: { color: colors.tealDark },
  pillText_amber: { color: "#8A5A13" },
  pillText_demo: { color: colors.demo },
  pillText_slate: { color: colors.slate },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    borderWidth: 1,
  },
  buttonBlock: { alignSelf: "stretch" },
  button_primary: { backgroundColor: colors.ink, borderColor: colors.ink },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  button_ghost: { backgroundColor: colors.tealDim, borderColor: colors.tealDim },
  buttonText: { fontSize: 14, fontWeight: "800" },
  buttonText_primary: { color: colors.surface },
  buttonText_secondary: { color: colors.ink },
  buttonText_ghost: { color: colors.tealDark },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.45 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitleText: { color: colors.ink, fontSize: 17, fontWeight: "800" },
});
