import { useIsFocused } from '@react-navigation/native';
import { Platform } from 'react-native';

/**
 * Whether this screen should load data / mount heavy UI (e.g. map WebView).
 * Web: route components are active when rendered (no native focus stack).
 * Native: uses React Navigation focus.
 */
export function useScreenFocused(): boolean {
  const navFocused = useIsFocused();
  if (Platform.OS === 'web') return true;
  return navFocused;
}
