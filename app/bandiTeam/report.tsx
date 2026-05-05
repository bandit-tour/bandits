/**
 * Dedicated **report form** only — opened from hub “Report alert”, alerts feed CTAs, etc.
 * Does not show the alerts list (avoids routing loops).
 */
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { getUniqueCities } from '@/app/services/bandits';
import { getUniqueNeighborhoods } from '@/app/services/events';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { submitScamAlert, userFacingScamSubmitError } from '@/services/scamAlerts';
import { supabase } from '@/lib/supabase';

const NONE = '__none__';
const BOTTLE_VIDEO_SOURCE = require('@/assets/images/local-friend-bottle.mov');

const SUCCESS_SUBCOPY =
  'Thank you. Your report helps keep trust and safe — the bandiTEAM will review it.';
const CTA_DELAY_MS = 4000;

type SubmitSuccessOverlayProps = {
  visible: boolean;
  onBackToHome: () => void;
};

/**
 * After successful submit: real `local-friend-bottle.mov`, looped + muted, rounded on dark; CTA after ~4s.
 * Same asset on iOS, Android, and web (expo-video).
 */
function ReportSubmitSuccessOverlay({ visible, onBackToHome }: SubmitSuccessOverlayProps) {
  const player = useVideoPlayer(BOTTLE_VIDEO_SOURCE);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowCta(false);
      try {
        contentOpacity.setValue(0);
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    setShowCta(false);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
    }).start();

    const run = () => {
      try {
        player.loop = true;
        player.muted = true;
        if ('currentTime' in player && typeof (player as { currentTime?: number }).currentTime === 'number') {
          (player as { currentTime: number }).currentTime = 0;
        }
        void player.play();
      } catch {
        /* still show copy + CTA */
      }
    };
    run();

    const ctaTimer = setTimeout(() => setShowCta(true), CTA_DELAY_MS);
    return () => {
      clearTimeout(ctaTimer);
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [visible, player, contentOpacity]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onBackToHome}>
      <View style={styles.successModalRoot} testID="banditeam-report-success-overlay">
        <Animated.View style={{ flex: 1, width: '100%', opacity: contentOpacity }}>
          <ScrollView
            contentContainerStyle={styles.successScrollContent}
            style={styles.successScroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.successTextBlock}>
              <Text style={styles.successOverlayTitle}>Report received</Text>
              <Text style={styles.successOverlaySub}>{SUCCESS_SUBCOPY}</Text>
            </View>

            <View style={styles.bottleVideoShell}>
              <VideoView
                player={player}
                style={styles.bottleVideo}
                nativeControls={false}
                contentFit="cover"
                contentPosition="center"
                allowsFullscreen={false}
                allowsPictureInPicture={false}
              />
            </View>

            {showCta ? (
              <Pressable
                onPress={onBackToHome}
                style={({ pressed }) => [styles.backHomeButton, pressed && { opacity: 0.9 }]}
                testID="banditeam-success-back-home"
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
              >
                <Text style={styles.backHomeButtonText}>Back to Home</Text>
              </Pressable>
            ) : (
              <View style={styles.backHomePlaceholder} />
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function BandiTeamReportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const [city, setCity] = useState(NONE);
  const [neighborhood, setNeighborhood] = useState(NONE);
  const [locationExtra, setLocationExtra] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(true);

  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [areaMenuOpen, setAreaMenuOpen] = useState(false);
  const [showSubmitTransition, setShowSubmitTransition] = useState(false);

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
    const hydrateAuth = async () => {
      await ensureAnonymousSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setCanSubmit(!!session?.user);
    };
    void hydrateAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setCanSubmit(!!session?.user);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadCities = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (silent) setListRefreshing(true);
      else setListsLoading(true);
      const list = await getUniqueCities();
      setCities(list.length > 0 ? list : ['Athens']);
    } catch {
      setCities(['Athens']);
    } finally {
      if (!silent) setListsLoading(false);
      if (silent) setListRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCities();
  }, [loadCities]);

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

  const onRefreshFormLists = useCallback(async () => {
    await loadCities({ silent: true });
    if (city && city !== NONE) {
      await loadNeighborhoods(city);
    }
  }, [loadCities, loadNeighborhoods, city]);
  const reportListRefresh = usePremiumRefreshControl(listRefreshing, onRefreshFormLists);

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
    await ensureAnonymousSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Could not start a guest session. Try again in a moment.');
      return;
    }
    setCanSubmit(true);
    const loc = buildLocationString();
    if (!city || city === NONE || !loc) {
      setError('Select city, choose an area (or add detail below), and fill title and description.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setLoading(true);
    setError(null);
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
      setShowSubmitTransition(true);
    } catch (e: unknown) {
      setError(userFacingScamSubmitError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ReportSubmitSuccessOverlay
        visible={showSubmitTransition}
        onBackToHome={() => {
          setShowSubmitTransition(false);
          router.replace('/bandits' as never);
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.formScrollContent,
            isDesktopWeb && styles.formScrollContentDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          testID="banditeam-report-form-scroll"
          refreshControl={reportListRefresh}
        >
          <View style={styles.inner}>
            <Text style={styles.screenTitle}>Report a scam alert</Text>
            <Text style={styles.screenSubtitle}>
              We treat every report seriously. It is reviewed in confidence, and you help protect other travelers.
            </Text>

            <View style={[styles.twoCol, isDesktopWeb && styles.twoColDesktop]}>
              <View style={styles.twoColItem}>
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
              </View>

              <View style={styles.twoColItem}>
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
              </View>
            </View>
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

            <TouchableOpacity
              testID="banditeam-report-submit"
              style={[styles.submitButton, (loading || !canSubmit) && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
            >
              <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },
  formScrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },
  formScrollContentDesktop: {
    paddingHorizontal: 24,
  },
  twoCol: {
    width: '100%',
  },
  twoColDesktop: {
    flexDirection: 'row',
    gap: 12,
  },
  twoColItem: {
    flex: 1,
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
    marginBottom: 20,
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
  successModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
  },
  successScroll: {
    flex: 1,
    maxWidth: 480,
    width: '100%' as const,
    alignSelf: 'center',
  },
  successScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 20,
  },
  successTextBlock: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
    maxWidth: 400,
  },
  successOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successOverlaySub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  bottleVideoShell: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 16 / 9,
    maxHeight: 360,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B0F18',
  },
  bottleVideo: {
    width: '100%',
    height: '100%',
    minHeight: 200,
  },
  backHomePlaceholder: {
    height: 52,
    marginTop: 8,
  },
  backHomeButton: {
    marginTop: 20,
    backgroundColor: '#F5F0E8',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  backHomeButtonText: {
    color: '#12100E',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
