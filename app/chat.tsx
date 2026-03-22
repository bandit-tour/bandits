import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ChatScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Chat' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Chat is coming soon</Text>
        <Text style={styles.body}>
          Messaging is not live yet, but this is now a real screen and no longer a popup.
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
});
