import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
} from 'react-native';

import { getNotificationsBackendStatus, sendLocalFriendMessage } from '@/services/localFriend';

export default function LocalFriendScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendReason, setBackendReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await getNotificationsBackendStatus();
        if (!active) return;
        setBackendReady(status.enabled);
        setBackendReason(status.enabled ? null : status.reason || 'Messaging is unavailable right now.');
      } catch {
        if (!active) return;
        setBackendReady(false);
        setBackendReason('Messaging is unavailable right now.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !backendReady) return;

    const payload = message.trim();
    setSending(true);
    setSuccess(null);
    setError(null);

    try {
      await sendLocalFriendMessage(payload);
      setMessage('');
      setSuccess('Message sent. A local friend will get back to you.');
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message ?? '')
            : '';
      if (msg.trim()) setError(msg.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Local Friend' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoBar}>
            <Image
              source={require('@/assets/icons/banditLocalpng.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.title}>Send something into the city</Text>
            <Text style={styles.subtitle}>
              This isn’t chat. It’s more like a note in a bottle that drifts through locals and banDits.
            </Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>What do you want to throw out there?</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Ask for a vibe, a corner, a kind of night..."
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || !message.trim() || !backendReady) && styles.sendButtonDisabled,
              ]}
              disabled={sending || !message.trim() || !backendReady}
              onPress={handleSend}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.sendText}>Release</Text>
              )}
            </TouchableOpacity>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!success && <Text style={styles.successText}>{success}</Text>}
            {!backendReady && !!backendReason && <Text style={styles.errorText}>{backendReason}</Text>}
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => {
              router.replace('/bandits');
            }}
          >
            <Text style={styles.exitButtonText}>Back to banDits</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  logoBar: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  logo: {
    width: 96,
    height: 28,
  },
  copyBlock: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    padding: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  input: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#000',
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
  sendText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#D92C2C',
  },
  successText: {
    marginTop: 8,
    fontSize: 12,
    color: '#0A7D32',
    fontWeight: '600',
  },
  exitButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exitButtonText: {
    fontSize: 13,
    color: '#555',
    textDecorationLine: 'underline',
  },
});

