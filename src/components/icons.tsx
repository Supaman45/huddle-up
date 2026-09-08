import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: ColorValue;
  strokeWidth?: number;
}

function base({ size = 22, strokeWidth = 2 }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}

export function CarIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M3 13l2-5h14l2 5" />
      <Rect x="2" y="13" width="20" height="6" rx="2" />
      <Circle cx="7" cy="19" r="1.5" />
      <Circle cx="17" cy="19" r="1.5" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Rect x="3" y="4" width="18" height="17" rx="3" />
      <Path d="M3 9h18M8 2v4M16 2v4" />
    </Svg>
  );
}

export function BallIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3a14 14 0 0 0 0 18M12 3a14 14 0 0 1 0 18M3 12h18" />
    </Svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function PersonIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Circle cx="9" cy="8" r="3.4" />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Path d="M16 5.6a3.4 3.4 0 0 1 0 6.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </Svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Circle cx="12" cy="12" r="3.2" />
      <Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </Svg>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M4 5h16v11H9l-5 4z" />
    </Svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
      <Circle cx="12" cy="10" r="2.2" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <Circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function SendIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M4 12l16-8-6 16-2.5-6.5z" />
    </Svg>
  );
}

export function SnackIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M4 10h16l-1.5 9H5.5z" />
      <Path d="M8 10a4 4 0 0 1 8 0" />
    </Svg>
  );
}

export function ShareIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M12 3v12M7 8l5-5 5 5" />
      <Path d="M5 13v7h14v-7" />
    </Svg>
  );
}

export function SyncIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M20 12a8 8 0 0 1-14.4 4.8M4 12A8 8 0 0 1 18.4 7.2" />
      <Path d="M18 3v4.5h-4.5M6 21v-4.5h4.5" />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <Path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

export function PencilIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    </Svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...base(p)} stroke={p.color}>
      <Path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <Path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <Path d="M12 14v3M9 20h6" />
    </Svg>
  );
}
