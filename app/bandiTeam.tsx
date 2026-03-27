import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { getUniqueCities } from '@/app/services/bandits';
import { getUniqueNeighborhoods } from '@/app/services/events';
import { submitScamAlert } from '@/services/scamAlerts';
import { supabase } from '@/lib/supabase';

const NONE = '__none__';

export default function BandiTeamScreen() {
  const [city, setCity] = useState(NONE);
  const [neighborhood, setNeighborhood] = useState(NONE);
  const [locationExtra, setLocationExtra] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);

  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [areaMenuOpen, setAreaMenuOpen] = useState(false);

  const neighborhoodRows = useMemo(() => {
    const rows: { value: string; label: string }[] = [];
    if (neighborhoods.length === 0) {
      rows.push({ value: NONE, label: 'No areas — use field below' });
    } else {
      rows.push({ value: NONE, label: 'Select area' });
      neighborhoods.forEach((n) => rows.push({ value: n, label: n }));
    }
    return rows;
  }, [neighborhoods]);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setCanSubmit(!!user);
      if (!user) setError('Sign in is required to submit reports.');
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getUniqueCities();
        if (!cancelled) setCities(list.length > 0 ? list : ['Athens']);
      } catch {
        if (!cancelled) setCities(['Athens']);
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNeighborhoods = useCallback(async (selectedCity: string) => {
    if (!selectedCity || selectedCity === NONE) {
      setNeighborhoods([]);
      setNeighborhood(NONE);
      return;
    }
    try {
      const list = await getUniqueNeighborhoods(selectedCity);
      setNeighborhoods(list);
      setNeighborhood(NONE);
    } catch {
      setNeighborhoods([]);
    }
  }, []);

  useEffect(() => {
    if (city && city !== NONE) {
      void loadNeighborhoods(city);
    }
  }, [city, loadNeighborhoods]);

  const pickImage = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const buildLocationString = (): string => {
    const parts: string[] = [];
    if (neighborhood && neighborhood !== NONE) parts.push(neighborhood);
    if (locationExtra.trim()) parts.push(locationExtra.trim());
    return parts.join(' · ');
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Sign in is required to submit reports.');
      setFeedback(null);
      return;
    }
    const loc = buildLocationString();
    if (!city || city === NONE || !loc) {
      setError('Select city, choose an area (or add detail below), and fill title and description.');
      setFeedback(null);
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      setFeedback(null);
      return;
    }

    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      await submitScamAlert({
        city,
        location: loc,
        title: title.trim(),
        description: description.trim(),
        imageUri: imageUri ?? undefined,
      });

      setTitle('');
      setDescription('');
      setImageUri(null);
      setLocationExtra('');
      setNeighborhood(NONE);
      setFeedback('Report saved. The bandiTEAM will review it.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.trim()) setError(msg.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'bandiTEAM' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={styles.container}>
            <Text style={styles.screenTitle}>Report a scam alert</Text>
            <Text style={styles.screenSubtitle}>
              Help the community stay informed. Share something suspicious, unsafe, or important others should know.
            </Text>

            <Text style={styles.contextText}>
              Reports are stored in Supabase for bandiTEAM review. Sign in is required to submit.
            </Text>

            <Text style={styles.label}>City</Text>
            {listsLoading ? (
              <ActivityIndicator style={{ marginVertical: 8 }} />
            ) : (
              <>
                <Pressable
                  style={styles.pickerWrap}
                  onPress={() => setCityMenuOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select city"
                >
                  <Text style={styles.pickerDisplay}>{city === NONE ? 'Select city' : city}</Text>
                  <Text style={styles.pickerChevron}>▼</Text>
                </Pressable>
                <Modal
                  visible={cityMenuOpen}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setCityMenuOpen(false)}
                >
                  <View style={styles.modalRoot}>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={() => setCityMenuOpen(false)}
                      accessibilityLabel="Dismiss"
                    />
                    <View style={styles.modalSheet}>
                      <Text style={styles.modalTitle}>Select city</Text>
                      <FlatList
                        data={cities}
                        keyExtractor={(item) => item}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.modalRow}
                            onPress={() => {
                              setCity(item);
                              setCityMenuOpen(false);
                            }}
                          >
                            <Text style={styles.modalRowText}>{item}</Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  </View>
                </Modal>
              </>
            )}

            <Text style={styles.label}>Area / neighborhood</Text>
            <Pressable
              style={[styles.pickerWrap, (!city || city === NONE) && styles.pickerWrapDisabled]}
              onPress={() => {
                if (!city || city === NONE) return;
                setAreaMenuOpen(true);
              }}
              disabled={!city || city === NONE}
              accessibilityRole="button"
              accessibilityLabel="Select area or neighborhood"
            >
              <Text style={styles.pickerDisplay}>
                {neighborhood === NONE
                  ? neighborhoods.length
                    ? 'Select area'
                    : 'No areas — use field below'
                  : neighborhood}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </Pressable>
            <Modal
              visible={areaMenuOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setAreaMenuOpen(false)}
            >
              <View style={styles.modalRoot}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setAreaMenuOpen(false)}
                  accessibilityLabel="Dismiss"
                />
                <View style={styles.modalSheet}>
                  <Text style={styles.modalTitle}>Area / neighborhood</Text>
                  <FlatList
                    data={neighborhoodRows}
                    keyExtractor={(item) => item.value + item.label}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalRow}
                        onPress={() => {
                          setNeighborhood(item.value);
                          setAreaMenuOpen(false);
                        }}
                      >
                        <Text style={styles.modalRowText}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>

            <Text style={styles.label}>Location detail (street, venue…)</Text>
            <TextInput
              style={styles.input}
              value={locationExtra}
              onChangeText={setLocationExtra}
              placeholder="Required if no area is listed above"
            />

            <Text style={styles.label}>Attach photo (optional)</Text>
            <Pressable style={styles.attachRow} onPress={() => void pickImage()} accessibilityRole="button">
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.thumb} />
              ) : (
                <Text style={styles.attachText}>Choose image</Text>
              )}
            </Pressable>
            {!!imageUri && (
              <TouchableOpacity onPress={() => setImageUri(null)}>
                <Text style={styles.removePhoto}>Remove image</Text>
              </TouchableOpacity>
            )}

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
              style={[styles.submitButton, (loading || !canSubmit) && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
            >
              <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit'}</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
  },
  pickerWrapDisabled: {
    opacity: 0.5,
  },
  pickerDisplay: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  pickerChevron: {
    fontSize: 10,
    color: '#666',
    marginLeft: 8,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '70%',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E1E1E1',
  },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  modalRowText: {
    fontSize: 15,
    color: '#222',
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
  attachRow: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  attachText: {
    fontSize: 14,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  removePhoto: {
    fontSize: 12,
    color: '#D92C2C',
    marginTop: 6,
    marginBottom: 4,
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
