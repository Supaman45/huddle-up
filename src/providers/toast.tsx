import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, XIcon } from '@/components/icons';
import { useAnimatedValue } from '@/lib/animation';
import { fonts, radius, space, useTheme } from '@/lib/theme';

type Tone = 'success' | 'signal' | 'error';
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
  action?: { label: string; onPress: () => void };
}

const Ctx = createContext<{ show: (text: string, opts?: { tone?: Tone; action?: ToastMsg['action'] }) => void } | null>(null);

// One toast at a time, bottom of the screen above the tab bar, 2.4 s, tap to dismiss.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const y = useAnimatedValue(80);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const hide = useCallback(() => {
    Animated.timing(y, { toValue: 80, duration: 180, useNativeDriver: true }).start(() => setToast(null));
  }, [y]);

  const show = useCallback(
    (text: string, opts?: { tone?: Tone; action?: ToastMsg['action'] }) => {
      if (timer.current) clearTimeout(timer.current);
      const tone = opts?.tone ?? 'success';
      setToast({ id: Date.now(), text, tone, action: opts?.action });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      y.setValue(80);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
      timer.current = setTimeout(hide, opts?.action ? 4000 : 2400);
    },
    [hide, y],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);
  const bg = toast?.tone === 'error' ? t.danger : toast?.tone === 'signal' ? t.signal : t.accent;

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 92, transform: [{ translateY: y }] }]}>
          <Pressable onPress={hide} style={[styles.toast, { backgroundColor: bg }]}>
            {toast.tone === 'error' ? <XIcon color={t.accentInk} size={18} /> : <CheckIcon color={t.accentInk} size={18} />}
            <Text style={[styles.text, { color: t.accentInk }]} numberOfLines={2}>
              {toast.text}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  toast.action?.onPress();
                  hide();
                }}
                style={styles.action}>
                <Text style={[styles.actionText, { color: t.accentInk }]}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v.show;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 15, flexShrink: 1 },
  action: { marginLeft: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.15)' },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
});
