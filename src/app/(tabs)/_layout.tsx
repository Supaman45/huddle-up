import { Tabs } from 'expo-router';
import { Platform, Text, type ColorValue } from 'react-native';

import { fonts, useTheme } from '@/lib/theme';

function Icon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color, fontFamily: fonts.displayMedium }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'This week', tabBarIcon: ({ color }) => <Icon glyph="▦" color={color} /> }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams', tabBarIcon: ({ color }) => <Icon glyph="◆" color={color} /> }} />
      <Tabs.Screen name="household" options={{ title: 'Household', tabBarIcon: ({ color }) => <Icon glyph="⌂" color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color }) => <Icon glyph="●" color={color} /> }} />
    </Tabs>
  );
}
