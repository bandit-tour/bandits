import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Link } from 'expo-router';

type Props = {
  error: Error;
  /** Expo Router: retry the failed route. */
  retry: () => void;
};

/**
 * Catches render errors in the route tree. Async/network failures should be
 * handled in data loaders; this avoids a “blank” crash for recoverable issues.
 */
export function ErrorBoundary({ error, retry }: Props) {
  const detail = __DEV__ && error?.message ? error.message : '';
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>We hit a connection snag</Text>
      <Text style={styles.sub}>
        Your session and local picks are still here. Check your network, or try again.
      </Text>
      {__DEV__ && detail ? (
        <Text style={styles.dev} accessibilityRole="alert">
          {detail}
        </Text>
      ) : null}
      <Pressable onPress={retry} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
      {__DEV__ ? (
        <Link href="/" style={styles.link} accessibilityRole="link">
          <Text style={styles.linkText}>Back to home</Text>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f6f6f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 20,
  },
  dev: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 16,
    color: '#0a0a0a',
    textDecorationLine: 'underline',
  },
});
