import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HotelierScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Hotelier' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Hotelier</Text>
        <Text style={styles.body}>
          Business onboarding is in MVP mode. This screen is active so menu navigation no longer dead-ends.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
});
