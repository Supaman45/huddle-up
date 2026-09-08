import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * A stable Animated.Value for the life of a component.
 *
 * `useRef(new Animated.Value(x)).current` is the familiar spelling, but it allocates a new
 * Animated.Value on every render and reads a ref during render, which React's rules of hooks
 * now flag. Lazy state gives the same stability with none of that: the initializer runs once.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
