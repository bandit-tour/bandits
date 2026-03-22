import { Stack } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function BandiTeamScreen() {
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!city.trim() || !location.trim() || !title.trim() || !description.trim()) {
      setError('City, location, title and description are required.');
      setFeedback(null);
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const { error: insertError } = await supabase.from('scam_alerts').insert({
        city: city.trim(),
        location: location.trim(),
        title: title.trim(),
        description: description.trim(),
      });
      if (insertError) throw insertError;

      setCity('');
      setLocation('');
      setTitle('');
      setDescription('');
      setFeedback('Submitted successfully. Thanks for helping protect the city.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'bandiTEAM' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Text style={styles.screenTitle}>Report a scam alert</Text>
            <Text style={styles.screenSubtitle}>
              Help the community stay informed. Share something suspicious, unsafe, or important others should know.
            </Text>

            <Text style={styles.contextText}>
              This will be shared with the bandit team and used to alert other travelers and locals.
            </Text>

            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="City"
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Street / area"
            />

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Short warning title"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened"
              multiline
            />

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!feedback && <Text style={styles.success}>{feedback}</Text>}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitText}>
                {loading ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
    marginBottom: 12,
  },
  contextText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#FFF',
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: '#D92C2C',
    marginTop: 10,
    fontSize: 12,
  },
  success: {
    color: '#1B7F3A',
    marginTop: 10,
    fontSize: 12,
  },
});
