import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Input, Row, Text } from '@/components/ui';
import { fonts, radius, space, useTheme } from '@/lib/theme';

// One control, three platforms: native pickers on iOS and Android, HTML date/time inputs on web.
// dateOnly drops the time half, for things measured in whole days such as away dates.
export function DateTimeField({
  label,
  value,
  onChange,
  dateOnly = false,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  dateOnly?: boolean;
}) {
  const t = useTheme();
  const [show, setShow] = useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'web') {
    const dateStr = format(value, 'yyyy-MM-dd');
    const timeStr = format(value, 'HH:mm');
    return (
      <View style={{ gap: 6 }}>
        <Text variant="label" color="faint">
          {label}
        </Text>
        <Row>
          <View style={{ flex: 1.4 }}>
            <Input
              value={dateStr}
              onChangeText={(v) => {
                const d = new Date(`${v}T${timeStr}`);
                if (!Number.isNaN(d.getTime())) onChange(d);
              }}
              // @ts-expect-error web-only attribute passes through to the DOM input
              type="date"
            />
          </View>
          {dateOnly ? null : (
            <View style={{ flex: 1 }}>
              <Input
                value={timeStr}
                onChangeText={(v) => {
                  const d = new Date(`${dateStr}T${v}`);
                  if (!Number.isNaN(d.getTime())) onChange(d);
                }}
                // @ts-expect-error web-only attribute passes through to the DOM input
                type="time"
              />
            </View>
          )}
        </Row>
      </View>
    );
  }

  function onPick(e: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShow(null);
    if (e.type === 'set' && d) onChange(d);
  }

  const box = (text: string, mode: 'date' | 'time', flex: number) => (
    <Pressable
      onPress={() => setShow(show === mode ? null : mode)}
      style={{
        flex,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: show === mode ? t.accent : t.line,
        borderRadius: radius.md,
        paddingHorizontal: space.lg,
        paddingVertical: 13,
        minHeight: 48,
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17 }}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="faint">
        {label}
      </Text>
      <Row>
        {box(format(value, 'EEE, MMM d'), 'date', 1.4)}
        {dateOnly ? null : box(format(value, 'h:mm a'), 'time', 1)}
      </Row>
      {show ? (
        <View style={{ backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.line, marginTop: 4, overflow: 'hidden' }}>
          <DateTimePicker
            value={value}
            mode={show}
            display={Platform.OS === 'ios' ? (show === 'date' ? 'inline' : 'spinner') : 'default'}
            onChange={onPick}
            minuteInterval={5}
            themeVariant="dark"
            accentColor={t.accent}
          />
        </View>
      ) : null}
    </View>
  );
}
