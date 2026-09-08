import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';
import { SessionProvider, useSession } from '@/providers/session';
import { ToastProvider } from '@/providers/toast';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { ready, session, household } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    if (!ready) return;
    const top = segments[0] as string | undefined;
    const inAuth = top === '(auth)';
    const inJoin = top === 'join'; // deep links to /join/CODE are allowed to render, they redirect themselves
    if (!session && !inAuth && !inJoin) {
      router.replace('/(auth)/sign-in');
    } else if (session && !household && top !== 'onboarding' && !inJoin) {
      router.replace('/onboarding');
    } else if (session && household && (inAuth || top === 'onboarding')) {
      router.replace('/(tabs)');
    }
  }, [ready, session, household, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="event/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="team/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="team/chat" options={{ presentation: 'card' }} />
      <Stack.Screen name="team/join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="athlete/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Gate />
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
