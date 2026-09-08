import { formatDistanceToNowStrict } from 'date-fns';
import { View } from 'react-native';

import { Row, Text } from '@/components/ui';
import { radius, space, useTheme } from '@/lib/theme';

/**
 * Shown when the last fetch failed and the screen is rendering what it saw before.
 * It says WHEN, because "20 minutes ago" is something a parent can judge and "offline"
 * is not.
 */
export function OfflineNote({ at }: { at: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        marginTop: space.md,
        backgroundColor: t.signalSoft,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.signal,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}>
      <Row gap={space.sm}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.signal }} />
        <Text variant="small" color="signal" style={{ flex: 1 }}>
          No connection. Showing the schedule as of {formatDistanceToNowStrict(at)} ago.
        </Text>
      </Row>
    </View>
  );
}
