import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard from the bottom edge (0 when hidden).
 * More reliable than KeyboardAvoidingView inside modals / tab stacks on installed iOS builds.
 */
export function useKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const onShow = (event: { endCoordinates?: { height?: number } }) => {
      setInset(Math.max(0, Number(event.endCoordinates?.height ?? 0)));
    };
    const onHide = () => setInset(0);

    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
    ];
    // Installed iOS modals sometimes only emit DidShow — listen to both.
    if (Platform.OS === 'ios') {
      subs.push(Keyboard.addListener('keyboardDidShow', onShow));
      subs.push(Keyboard.addListener('keyboardDidHide', onHide));
    }
    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, []);

  return inset;
}
