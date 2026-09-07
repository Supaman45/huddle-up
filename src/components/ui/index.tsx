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
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyMedium' | 'bodyBold' | 'small' | 'label' | 'mono';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  h2: { fontFamily: fonts.displayMedium, fontSize: 24, lineHeight: 26 },
  h3: { fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 14 },
};

export function Text({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: 'ink' | 'muted' | 'accent' | 'signal' | 'accentInk' | 'danger' | 'gold' }) {
  const t = useTheme();
  return <RNText style={[variants[variant], { color: t[color ?? 'ink'] }, style]} {...rest} />;
}

// ---------- Screen ----------
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: space.lg } : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }, pad, style]}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: t.bg }, style]}
      contentContainerStyle={[{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 96 }, pad, contentStyle]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
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
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

// ---------- Card ----------
export function Card({ style, accent, ...rest }: ViewProps & { accent?: string }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          padding: space.lg,
          overflow: 'hidden',
        },
        accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null,
        style,
      ]}
      {...rest}
    />
  );
}

// ---------- Button ----------
export function Button({
  title,
  kind = 'primary',
  loading,
  disabled,
  onPress,
  style,
  ...rest
}: PressableProps & { title: string; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : kind === 'secondary' ? t.surface : 'transparent';
  const fg = kind === 'primary' ? t.accentInk : kind === 'danger' ? '#fff' : kind === 'secondary' ? t.ink : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: t.line,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: fg }}>{title}</RNText>
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
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'signal' | 'gold';
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accentSoft : tone === 'signal' ? t.signalSoft : tone === 'gold' ? t.goldSoft : t.surfaceAlt;
  const fg = tone === 'accent' ? t.accent : tone === 'signal' ? t.signal : tone === 'gold' ? t.gold : t.muted;
  const body = (
    <View
      style={{
        backgroundColor: selected ? t.accent : bg,
        borderRadius: radius.pill,
        paddingVertical: 5,
        paddingHorizontal: 10,
      }}>
      <RNText style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.4, color: selected ? t.accentInk : fg }}>{label}</RNText>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable>;
}

// ---------- Input ----------
export function Input({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label" color="muted">{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
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
    <Row style={{ paddingVertical: 12, gap: space.md }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Text color="muted">›</Text> : null)}
    </Row>
  );
  if (!onPress) return <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }}>{inner}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.line }]}>
      {inner}
    </Pressable>
  );
}

// ---------- Avatar (initials) ----------
export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
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
        backgroundColor: color ?? t.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <RNText style={{ fontFamily: fonts.displayMedium, fontSize: size * 0.42, color: color ? '#fff' : t.accent }}>{initials || '?'}</RNText>
    </View>
  );
}

// ---------- Empty state ----------
export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.sm }}>
      <Text variant="h3">{title}</Text>
      {body ? (
        <Text variant="small" color="muted">
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </Card>
  );
}

// ---------- Section header ----------
export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <Text variant="label" color="muted">
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
