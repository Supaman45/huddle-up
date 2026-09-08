import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { Pressable, View } from 'react-native';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Row, Text } from '@/components/ui';
import { fonts, radius, space, useTheme } from '@/lib/theme';
import type { Athlete, MyEvent } from '@/lib/types';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// A month at a glance: one dot per event, in the kid's color, three dots max per day.
export function MonthGrid({
  month,
  onMonthChange,
  selected,
  onSelect,
  events,
  athletes,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  events: MyEvent[];
  athletes: Athlete[];
}) {
  const t = useTheme();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  function dotsFor(day: Date): string[] {
    const onDay = events.filter((e) => isSameDay(new Date(e.starts_at), day) && !e.cancelled);
    const colors: string[] = [];
    for (const e of onDay) {
      const kid = athletes.find((a) => e.athlete_ids.includes(a.id));
      const c = e.my_ride_status === 'needs_ride' || e.open_requests > 0 ? t.signal : kid?.color ?? e.team_color;
      if (!colors.includes(c)) colors.push(c);
      if (colors.length >= 3) break;
    }
    return colors;
  }

  return (
    <View style={{ backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.line, padding: space.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Pressable onPress={() => onMonthChange(addMonths(month, -1))} hitSlop={12} style={{ padding: 6 }} accessibilityLabel="Previous month">
          <ChevronLeftIcon color={t.muted} size={20} />
        </Pressable>
        <Text variant="h3">{format(month, 'MMMM yyyy')}</Text>
        <Pressable onPress={() => onMonthChange(addMonths(month, 1))} hitSlop={12} style={{ padding: 6 }} accessibilityLabel="Next month">
          <ChevronRightIcon color={t.muted} size={20} />
        </Pressable>
      </Row>

      <Row gap={0} style={{ marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="label" color="faint" style={{ letterSpacing: 0 }}>
              {d}
            </Text>
          </View>
        ))}
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const dots = dotsFor(day);
          const isSel = isSameDay(day, selected);
          const dim = !isSameMonth(day, month);
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => onSelect(day)}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSel ? t.accent : 'transparent',
                  borderWidth: isToday(day) && !isSel ? 1 : 0,
                  borderColor: t.accent,
                }}>
                <Text
                  style={{
                    fontFamily: isSel || isToday(day) ? fonts.bodyBold : fonts.body,
                    fontSize: 15,
                    color: isSel ? t.accentInk : dim ? t.faint : t.ink,
                  }}>
                  {format(day, 'd')}
                </Text>
              </View>
              <Row gap={3} style={{ height: 6, marginTop: 2 }}>
                {dots.map((c, i) => (
                  <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? t.accentInk : c }} />
                ))}
              </Row>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
