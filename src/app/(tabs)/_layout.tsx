import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { BallIcon, GearIcon, HomeIcon, UsersIcon } from '@/components/icons';
import { fonts, useTheme } from '@/lib/theme';

// Home is the schedule: the screen a parent opens ten times a week.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: {
          backgroundColor: 'rgba(15,22,32,0.96)',
          borderTopColor: t.line,
          height: Platform.OS === 'ios' ? 86 : 68,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontFamily: fonts.displayBold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2 },
        sceneStyle: { backgroundColor: t.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams', tabBarIcon: ({ color }) => <BallIcon color={color} /> }} />
      <Tabs.Screen name="household" options={{ title: 'Family', tabBarIcon: ({ color }) => <UsersIcon color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Settings', tabBarIcon: ({ color }) => <GearIcon color={color} /> }} />
    </Tabs>
  );
}
