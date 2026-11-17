import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard while it is open, else 0. The app draws
 * edge to edge, so Android no longer resizes the window for the keyboard and
 * KeyboardAvoidingView's frame arithmetic comes out short there; screens pad
 * their bottom by this height instead, on both platforms.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, (e) => {
        setHeight(e.endCoordinates.height);
      }),
      Keyboard.addListener(hide, () => {
        setHeight(0);
      }),
    ];
    return () => {
      for (const s of subs) s.remove();
    };
  }, []);
  return height;
}
