import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { BallIcon, CalendarIcon, HomeIcon, PersonIcon } from '@/components/icons';
import { fonts, useTheme } from '@/lib/theme';

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
      <Tabs.Screen name="index" options={{ title: 'Week', tabBarIcon: ({ color }) => <CalendarIcon color={color} /> }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams', tabBarIcon: ({ color }) => <BallIcon color={color} /> }} />
      <Tabs.Screen name="household" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color }) => <PersonIcon color={color} /> }} />
    </Tabs>
  );
}
