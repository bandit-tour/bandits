// Fallback for using MaterialIcons on Android and web.

import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialName = ComponentProps<typeof MaterialIcons>['name'];
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'star.fill': 'star',
  star: 'star-outline',
  'heart.fill': 'favorite',
  heart: 'favorite-outline',
  /** Main bottom nav + modals */
  'person.2.fill': 'people',
  'bubble.left.and.bubble.right.fill': 'chat',
  'tray.full.fill': 'inbox',
  'exclamationmark.triangle.fill': 'warning',
  'line.3.horizontal': 'menu',
  'gearshape.fill': 'settings',
  'person.circle': 'account-circle',
  'person.2.circle': 'groups',
  'person.2.circle.fill': 'groups',
} as const satisfies Record<string, MaterialName>;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const resolved = MAPPING[name];
  return <MaterialIcons color={color} size={size} name={resolved ?? 'help-outline'} style={style} />;
}
