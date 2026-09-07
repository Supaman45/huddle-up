import { addDays, format, isSameDay, isToday, isTomorrow, startOfDay, startOfWeek } from 'date-fns';

export function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMM d');
}

export function timeLabel(d: Date): string {
  return format(d, 'h:mm a').replace(':00', '');
}

export function rangeLabel(start: Date, end: Date | null): string {
  if (!end) return timeLabel(start);
  return `${timeLabel(start)} to ${timeLabel(end)}`;
}

export function groupByDay<T>(items: T[], getDate: (t: T) => Date): { day: Date; items: T[] }[] {
  const groups: { day: Date; items: T[] }[] = [];
  for (const item of items) {
    const d = startOfDay(getDate(item));
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.day, d)) last.items.push(item);
    else groups.push({ day: d, items: [item] });
  }
  return groups;
}

export function thisWeekRange(): { from: Date; to: Date } {
  const from = startOfDay(new Date());
  return { from, to: addDays(from, 14) };
}

export function weekStart(d = new Date()): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}
