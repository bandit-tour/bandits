import { Platform, type TextStyle } from 'react-native';

/**
 * Pilot Desk / CDesk / operator surfaces: Android often hides typed text when `color`
 * is omitted or inherited oddly from theme. Always merge these into TextInput `style` + props.
 */
export const OPERATOR_TEXT_COLOR = '#0F172A';
export const OPERATOR_PLACEHOLDER_COLOR = '#64748B';

export const operatorSurfaceTextInputStyle: TextStyle = {
  color: OPERATOR_TEXT_COLOR,
};

/** Spread onto TextInput after local styles. */
export const operatorSurfaceTextInputProps = {
  placeholderTextColor: OPERATOR_PLACEHOLDER_COLOR,
  selectionColor: '#0a7ea4',
  ...(Platform.OS === 'android' ? { underlineColorAndroid: 'transparent' as const } : {}),
};
