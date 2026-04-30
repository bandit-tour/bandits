import { router } from 'expo-router';
import React, { type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string };

/**
 * Catches render errors from child trees so a blank white screen is replaced
 * with a recovery affordance (especially on web PWA / cold start).
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error?.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[RootErrorBoundary]', error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      const detail = __DEV__ ? this.state.message : '';
      return (
        <View style={styles.fallback} accessibilityRole="alert">
          <Text style={styles.title}>{"Let's keep going"}</Text>
          <Text style={styles.body}>
            {__DEV__ && detail
              ? detail
              : 'Something interrupted this screen. You can return to the PLAY welcome without losing your session.'}
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => {
              this.setState({ hasError: false, message: '' });
              try {
                if (Platform.OS === 'web') {
                  router.replace('/hotel/play-theatrou' as never);
                  return;
                }
                router.replace('/bandits' as never);
              } catch {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.assign('/hotel/play-theatrou');
                }
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Return to PLAY welcome"
          >
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#0B0F18',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FAF8F3',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: 'rgba(240,236,228,0.85)',
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: 'rgba(90, 130, 142, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  btnText: { color: '#FAF8F3', fontWeight: '800', fontSize: 16 },
});
