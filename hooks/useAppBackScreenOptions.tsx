import { HeaderBackButton } from '@react-navigation/elements';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { goToAppHome, goToPlayMenu, navigateAppBack } from '@/lib/appNavigation';
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

function HeaderEscapeShortcuts() {
  const router = useRouter();
  return (
    <View style={styles.escapeHeaderRow}>
      <Pressable
        onPress={() => goToPlayMenu(router)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go to Menu"
      >
        <Text style={styles.escapeHeaderText}>Menu</Text>
      </Pressable>
      <Pressable
        onPress={() => goToAppHome(router)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go Home"
      >
        <Text style={styles.escapeHeaderText}>Home</Text>
      </Pressable>
    </View>
  );
}

type AppBackScreenOptionsArgs = {
  title?: string;
  fallback: Href;
  headerShown?: boolean;
  /** Menu + Home shortcuts in header (stack screens outside bottom tabs). */
  escapeShortcuts?: boolean;
  headerRight?: NativeStackNavigationOptions['headerRight'];
  headerStyle?: NativeStackNavigationOptions['headerStyle'];
  headerTintColor?: string;
};

export function useAppBackScreenOptions({
  title = '',
  fallback,
  headerShown = true,
  escapeShortcuts = false,
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

  const mergedHeaderRight = useMemo((): NativeStackNavigationOptions['headerRight'] => {
    if (!escapeShortcuts && !headerRight) return undefined;
    if (!escapeShortcuts) return headerRight;
    if (!headerRight) return () => <HeaderEscapeShortcuts />;
    return (props) => (
      <View style={styles.headerRightMerge}>
        {typeof headerRight === 'function' ? headerRight(props) : headerRight}
        <HeaderEscapeShortcuts />
      </View>
    );
  }, [escapeShortcuts, headerRight]);

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
      headerRight: mergedHeaderRight,
    }),
    [fallback, handleBack, headerShown, headerStyle, headerTintColor, mergedHeaderRight, title],
  );
}

const styles = StyleSheet.create({
  escapeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: Platform.OS === 'ios' ? 4 : 8,
  },
  escapeHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  headerRightMerge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
