import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, space, useTheme } from '@/lib/theme';

// ---------- Text ----------
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyMedium' | 'bodyBold' | 'small' | 'label' | 'mono' | 'monoLarge';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 52, lineHeight: 50, letterSpacing: -1 },
  h1: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 26 },
  h3: { fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 16, letterSpacing: 2.4, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 16, letterSpacing: 1 },
  monoLarge: { fontFamily: fonts.mono, fontSize: 22, lineHeight: 26, letterSpacing: 0.5 },
};

type Color = 'ink' | 'inkStrong' | 'muted' | 'faint' | 'accent' | 'signal' | 'accentInk' | 'danger' | 'gold';

export function Text({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: Color }) {
  const t = useTheme();
  return <RNText style={[variants[variant], { color: t[color ?? 'ink'] }, style]} {...rest} />;
}

// ---------- Screen ----------
export function Screen({
  children,
  scroll = true,
  padded = true,
  glow = false,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: space.xl } : null;
  const glowEl = glow ? <Glow /> : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }, pad, style]}>
        {glowEl}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {glowEl}
      <ScrollView
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 }, pad, contentStyle]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

// ---------- Glow ----------
// Concentric low-alpha discs fake a radial gradient without a native gradient dependency.
export function Glow({ top = -220, left = -140 }: { top?: number; left?: number }) {
  const t = useTheme();
  const rings = [
    { size: 620, a: 0.05 },
    { size: 500, a: 0.06 },
    { size: 380, a: 0.07 },
    { size: 260, a: 0.08 },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left, width: 620, height: 620, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r) => (
        <View key={r.size} style={{ position: 'absolute', width: r.size, height: r.size, borderRadius: r.size / 2, backgroundColor: t.accent, opacity: r.a }} />
      ))}
    </View>
  );
}

// ---------- Layout helpers ----------
export function Row({ style, gap = space.sm, ...rest }: ViewProps & { gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} {...rest} />;
}

export function Stack({ style, gap = space.md, ...rest }: ViewProps & { gap?: number }) {
  return <View style={[{ gap }, style]} {...rest} />;
}

export function Spacer({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.lineStrong }} />;
}

// ---------- Card ----------
// rail: a glowing color bar on the left edge. raised: the hero treatment with depth.
export function Card({ style, rail, raised, children, ...rest }: ViewProps & { rail?: string; raised?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? t.surfaceAlt : t.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: raised ? t.lineStrong : t.line,
          padding: space.lg,
          overflow: 'hidden',
        },
        raised
          ? { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12 }
          : null,
        style,
      ]}
      {...rest}>
      {rail ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: space.lg,
            bottom: space.lg,
            width: 4,
            borderRadius: 2,
            backgroundColor: rail,
            shadowColor: rail,
            shadowOpacity: 0.9,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

// ---------- Button ----------
export function Button({
  title,
  kind = 'primary',
  size = 'md',
  loading,
  disabled,
  onPress,
  style,
  icon,
  ...rest
}: PressableProps & {
  title: string;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal';
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  const bg =
    kind === 'primary' ? t.accent : kind === 'signal' ? t.signal : kind === 'danger' ? t.danger : kind === 'secondary' ? t.surfaceAlt : 'transparent';
  const fg = kind === 'primary' || kind === 'signal' ? t.accentInk : kind === 'danger' ? '#1A0B0A' : kind === 'secondary' ? t.ink : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: size === 'sm' ? 10 : 14,
          paddingHorizontal: size === 'sm' ? space.lg : space.xl,
          flexDirection: 'row',
          gap: space.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: t.line,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          minHeight: size === 'sm' ? 40 : 48,
        },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <RNText style={{ fontFamily: fonts.bodyBold, fontSize: size === 'sm' ? 14 : 15, color: fg }}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

// ---------- Chip ----------
export function Chip({
  label,
  tone = 'neutral',
  selected,
  onPress,
  dot,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'signal' | 'gold' | 'solid';
  selected?: boolean;
  onPress?: () => void;
  dot?: string;
}) {
  const t = useTheme();
  const bg = selected || tone === 'solid' ? t.accent : tone === 'accent' ? t.accentSoft : tone === 'signal' ? t.signalSoft : tone === 'gold' ? t.goldSoft : t.surfaceAlt;
  const fg = selected || tone === 'solid' ? t.accentInk : tone === 'accent' ? t.accent : tone === 'signal' ? t.signal : tone === 'gold' ? t.gold : t.ink;
  const body = (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: tone === 'neutral' || selected || tone === 'solid' ? radius.pill : radius.sm,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderWidth: tone === 'neutral' && !selected ? 1 : 0,
        borderColor: t.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
      }}>
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      <RNText
        style={{
          fontFamily: tone === 'neutral' || selected || tone === 'solid' ? fonts.bodyBold : fonts.bodyBold,
          fontSize: tone === 'neutral' || selected || tone === 'solid' ? 13 : 12,
          letterSpacing: tone === 'neutral' || selected || tone === 'solid' ? 0 : 0.6,
          textTransform: tone === 'neutral' || selected || tone === 'solid' ? 'none' : 'uppercase',
          color: fg,
        }}>
        {label}
      </RNText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {body}
    </Pressable>
  );
}

// ---------- Input ----------
export function Input({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" color="faint">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.faint}
        style={[
          {
            fontFamily: fonts.body,
            fontSize: 17,
            color: t.ink,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.line,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: 13,
            minHeight: 48,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

// ---------- ListRow ----------
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  leading,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  leading?: React.ReactNode;
  onPress?: () => void;
}) {
  const t = useTheme();
  const inner = (
    <Row style={{ paddingVertical: 14, gap: space.md, minHeight: 56 }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Text color="faint">›</Text> : null)}
    </Row>
  );
  const border = { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.lineStrong };
  if (!onPress) return <View style={border}>{inner}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, border]}>
      {inner}
    </Pressable>
  );
}

// ---------- Avatar (initials) ----------
export function Avatar({ name, color, size = 36, ring }: { name: string; color?: string; size?: number; ring?: string }) {
  const t = useTheme();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? t.surfaceAlt,
        borderWidth: ring ? 2 : 1,
        borderColor: ring ?? t.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <RNText style={{ fontFamily: fonts.displayBold, fontSize: size * 0.42, color: color ? '#0F1620' : t.ink }}>{initials || '?'}</RNText>
    </View>
  );
}

// ---------- Empty state ----------
export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Card raised style={{ alignItems: 'flex-start', gap: space.sm }}>
      <Text variant="h2">{title}</Text>
      {body ? <Text color="muted">{body}</Text> : null}
      {action ? <View style={{ marginTop: space.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </Card>
  );
}

// ---------- Section header ----------
export function SectionHeader({ title, right, top = space.xl }: { title: string; right?: React.ReactNode; top?: number }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: top, marginBottom: space.md, minHeight: 32 }}>
      <Text variant="label" color="faint">
        {title}
      </Text>
      {right}
    </Row>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

// ---------- Segmented tabs ----------
export function Segments<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; badge?: number }[] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: t.line }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: on ? t.surfaceRaised : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: on ? t.inkStrong : t.muted }}>{it.label}</RNText>
            {it.badge ? (
              <View style={{ backgroundColor: t.signal, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: t.accentInk }}>{it.badge}</RNText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Back link ----------
export function BackLink({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ paddingVertical: space.sm, opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' })}>
      <Text variant="bodyBold" color="accent">
        ‹ {label}
      </Text>
    </Pressable>
  );
}
