import { HeaderBackButton } from '@react-navigation/elements';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { BackHandler, Platform } from 'react-native';

import { navigateAppBack } from '@/lib/appNavigation';
import { perfTraceNavigationPress } from '@/lib/perfTiming';

/** Reliable back: stack history first, then expo-router, then safe fallback. */
export function useAppBackNavigation(fallback: Href): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    perfTraceNavigationPress('back', () => {
      navigateAppBack(router, fallback, navigation);
    });
  }, [navigation, router, fallback]);
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

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack]),
  );

  return useMemo(
    () => ({
      headerShown,
      title,
      headerBackTitle: 'Back',
      headerBackTitleVisible: true,
      headerBackVisible: false,
      headerStyle,
      headerTintColor,
      headerLeft: () => (
        <HeaderBackButton
          canGoBack
          disabled={false}
          label="Back"
          labelVisible={Platform.OS === 'ios'}
          tintColor={headerTintColor ?? '#0a7ea4'}
          onPress={handleBack}
        />
      ),
      headerRight,
    }),
    [fallback, handleBack, headerRight, headerShown, headerStyle, headerTintColor, title],
  );
}
