import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

/** Reliable back: never show the parent route name "(tabs)" on iOS. */
export function useAppBackNavigation(fallback: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallback);
  }, [router, fallback]);
}

type AppBackScreenOptionsArgs = {
  title?: string;
  fallback: Href;
  headerShown?: boolean;
  headerRight?: NativeStackNavigationOptions['headerRight'];
  headerStyle?: NativeStackNavigationOptions['headerStyle'];
  headerTintColor?: string;
};

export function useAppBackScreenOptions({
  title = '',
  fallback,
  headerShown = true,
  headerRight,
  headerStyle,
  headerTintColor,
}: AppBackScreenOptionsArgs): NativeStackNavigationOptions {
  const handleBack = useAppBackNavigation(fallback);

  return useMemo(
    () => ({
      headerShown,
      title,
      headerBackTitle: 'Back',
      headerBackTitleVisible: true,
      headerBackVisible: false,
      headerStyle,
      headerTintColor,
      headerLeft: (props) => (
        <HeaderBackButton
          {...props}
          label="Back"
          labelVisible={Platform.OS === 'ios'}
          onPress={handleBack}
        />
      ),
      headerRight,
    }),
    [fallback, handleBack, headerRight, headerShown, headerStyle, headerTintColor, title],
  );
}
