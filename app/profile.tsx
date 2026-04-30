import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readGuestProfileLocal, writeGuestProfileLocal } from '@/lib/guestProfileLocal';
import { getHotelWhiteLabelOrDefault } from '@/lib/hotelWhiteLabel';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { ensureAnonymousSession, getHotelEntry, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';
import {
  persistUserProfileIdentity,
  refreshClientAuthSession,
  shallowAuthMetadataForUpdate,
  updateAuthUserMetadataFields,
} from '@/services/userProfile';

/** Vercel deployment that serves `/api/avatar-upload` (server-side storage upload, bypasses RLS). */
const DEFAULT_PRODUCTION_AVATAR_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

/**
 * When set, the client posts to `${base}/api/avatar-upload` (must have SUPABASE_SERVICE_ROLE_KEY on Vercel).
 * Web production uses `window.location.origin` unless overridden. Native production uses the default Vercel origin.
 */
function getAvatarApiBaseUrl(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) return null;
  if (Platform.OS === 'web' && !isLocalWebHost() && typeof window !== 'undefined') {
    return window.location.origin;
  }
  if (Platform.OS !== 'web') {
    return DEFAULT_PRODUCTION_AVATAR_API_ORIGIN;
  }
  return null;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length === 0) return '';
  const btoaFn = globalThis as { btoa?: (s: string) => string };
  if (typeof btoaFn.btoa === 'function') {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
    return btoaFn.btoa(s);
  }
  const b64s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = u8.length;
  let o = '';
  for (let i = 0; i < len; i += 3) {
    const a = u8[i]!;
    const b = i + 1 < len ? u8[i + 1]! : 0;
    const c = i + 2 < len ? u8[i + 2]! : 0;
    o += b64s[a >> 2] + b64s[((a & 3) << 4) | (b >> 4)] + (i + 1 < len ? b64s[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < len ? b64s[c & 63] : '=');
  }
  return o;
}

function avatarCacheKey(userId: string): string {
  return `@bandits_profile_avatar_url_v1:${userId}`;
}

async function readCachedAvatarUrl(userId: string): Promise<string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(avatarCacheKey(userId)) || '';
    } catch {
      return '';
    }
  }
  try {
    return (await AsyncStorage.getItem(avatarCacheKey(userId))) || '';
  } catch {
    return '';
  }
}

function writeCachedAvatarUrl(userId: string, url: string | null): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const key = avatarCacheKey(userId);
      if (url && url.trim()) window.localStorage.setItem(key, url.trim());
      else window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  const key = avatarCacheKey(userId);
  if (url && url.trim()) {
    void AsyncStorage.setItem(key, url.trim());
  } else {
    void AsyncStorage.removeItem(key);
  }
}

function initialsFromUser(email: string | null | undefined, userId?: string | null): string {
  if (email) {
    const part = email.split('@')[0] || email;
    return part.slice(0, 2).toUpperCase();
  }
  if (userId && userId.length >= 2) return userId.replace(/-/g, '').slice(0, 2).toUpperCase();
  return '?';
}

function joinedDateLabel(createdAt?: string): string {
  if (!createdAt) return 'Recently joined';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Recently joined';
  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}

function isGuestAccessUser(user: { app_metadata?: Record<string, unknown>; email?: string | null } | null): boolean {
  if (!user) return true;
  if (!String(user.email ?? '').trim()) return true;
  const a = user.app_metadata;
  if (a?.provider === 'anonymous' || a?.is_anonymous === true) return true;
  return false;
}

function defaultVibeFromProfile(city: string | null | undefined, meta: Record<string, unknown> | undefined): string {
  const raw = typeof meta?.vibe_line === 'string' ? meta.vibe_line.trim() : '';
  if (raw) return raw;
  const c = (city && String(city).trim()) || '';
  if (c) return `Curious traveler · ${c}`;
  return 'Curious traveler / City explorer';
}

/** Only source for profile strip: hardcoded inspirational copy (no API, no “alert” fallbacks). */
const PROFILE_INSPIRATION_LINES: readonly string[] = [
  'Good morning. Your city is waiting.',
  'Move softly. Notice everything.',
  'Tonight belongs to the curious.',
  'A better story starts outside.',
  'Trust your instinct today.',
  "The locals know something you don't.",
  'Stay elegant. Stay awake.',
  'Walk slow. Find more.',
  'Some doors open only tonight.',
  'Your next memory is nearby.',
] as const;

const INSPIRATION_ROTATE_MS = 4000;

function ProfileInspirationStrip() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const line = useMemo(
    () =>
      PROFILE_INSPIRATION_LINES[index % PROFILE_INSPIRATION_LINES.length] ?? PROFILE_INSPIRATION_LINES[0]!,
    [index],
  );

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIndex((i) => (i + 1) % PROFILE_INSPIRATION_LINES.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, INSPIRATION_ROTATE_MS);
    return () => clearInterval(id);
  }, [opacity]);

  return (
    <View
      testID="profile-inspiration-strip"
      style={styles.inspirationStrip}
      accessibilityLabel={`A note: ${line}`}
    >
      <View style={styles.inspirationStripTopGold} />
      <View style={styles.inspirationStripInner}>
        <Text style={styles.inspirationKicker} numberOfLines={1}>
          A moment
        </Text>
        <Animated.Text style={[styles.inspirationLine, { opacity }]} numberOfLines={3}>
          {line}
        </Animated.Text>
      </View>
      <View style={styles.inspirationStripDivider} />
    </View>
  );
}

function ProfileBackHeaderButton() {
  const router = useRouter();
  const onBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/menu' as never);
    }
  }, [router]);
  return (
    <Pressable
      onPress={onBack}
      hitSlop={14}
      style={({ pressed }) => [styles.navBackButton, pressed && { opacity: 0.7 }]}
      testID="profile-back-button"
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.navBackText}>← Back</Text>
    </Pressable>
  );
}

async function uploadAvatarBytes(params: {
  userId: string;
  bytes: ArrayBuffer;
  ext: 'png' | 'jpg';
  contentType: 'image/png' | 'image/jpeg';
}): Promise<{ publicUrl: string; bucket: 'profile_avatars' }> {
  const { userId, bytes, ext, contentType } = params;
  const bucket = 'profile_avatars' as const;
  const apiBase = getAvatarApiBaseUrl();
  if (apiBase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not signed in');
    }
    const image = arrayBufferToBase64(bytes);
    let res: Response | null = null;
    try {
      res = await fetch(`${apiBase}/api/avatar-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ext, image }),
      });
    } catch {
      res = null;
    }
    if (res) {
      const j = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string };
      if (res.ok && j.publicUrl) {
        return { publicUrl: String(j.publicUrl).trim(), bucket };
      }
      if (res.status === 401) {
        throw new Error((j.error && String(j.error)) || 'Not authorized');
      }
      if (res.status === 400 || res.status === 413) {
        throw new Error((j.error && String(j.error)) || 'Avatar upload failed');
      }
      // 404 / 5xx / 503: fall through to direct storage (e.g. API not configured, or RLS already fixed)
    }
  }

  const objectPath = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    throw uploadError;
  }
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = publicData.publicUrl;
  if (publicUrl && publicUrl.trim()) {
    return { publicUrl: publicUrl.trim(), bucket };
  }
  throw new Error(`Could not resolve public URL for bucket ${bucket}.`);
}

async function ensureClientSessionForStorage(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return;
  await supabase.auth.signInAnonymously();
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [draftEmail, setDraftEmail] = useState('');
  const [profileCity, setProfileCity] = useState('Athens');
  const [draftName, setDraftName] = useState('');
  const [draftVibe, setDraftVibe] = useState('');
  const [userMetadataForSave, setUserMetadataForSave] = useState<Record<string, unknown>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [joinedLabel, setJoinedLabel] = useState<string>('Recently joined');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileIdentity, setProfileIdentity] = useState(
    () => getHotelWhiteLabelOrDefault(null).profileGuestIdentity,
  );
  const [profileAccessTitle, setProfileAccessTitle] = useState(
    () => getHotelWhiteLabelOrDefault(null).profileAccessTitle,
  );
  const [profileAccessBullets, setProfileAccessBullets] = useState(
    () => getHotelWhiteLabelOrDefault(null).profileAccessBullets,
  );
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [listRefreshing, setListRefreshing] = useState(false);

  const load = useCallback(async () => {
    await ensureAnonymousSession();
    await syncPilotHotelProfileIfNeeded();
    const entry = await getHotelEntry();
    const wl = getHotelWhiteLabelOrDefault(entry?.slug ?? null);
    setProfileIdentity(wl.profileGuestIdentity);
    setProfileAccessTitle(wl.profileAccessTitle);
    setProfileAccessBullets(wl.profileAccessBullets);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLocalUserId(null);
      setEmail('');
      setProfileCity('Athens');
      setDraftName('Traveler');
      setDraftEmail('');
      setDraftVibe('');
      setUserMetadataForSave({});
      setIsGuest(true);
      setAvatarUrl(null);
      setJoinedLabel('Set up your traveler profile on this page');
      return;
    }
    const guest = isGuestAccessUser(user);
    setIsGuest(guest);
    setLocalUserId(user.id);
    const resolvedEmail =
      (typeof user.email === 'string' && user.email.trim()) ||
      (typeof (user.user_metadata as Record<string, unknown> | undefined)?.profile_email === 'string' &&
        String((user.user_metadata as Record<string, unknown>).profile_email).trim()) ||
      '';
    setEmail(resolvedEmail);
    setDraftEmail(resolvedEmail);
    setUserMetadataForSave({ ...((user.user_metadata ?? {}) as Record<string, unknown>) });
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const { data: profileRow, error: profileReadErr } = await supabase
      .from('user_profile')
      .select('name, avatar_url, city')
      .eq('id', user.id)
      .maybeSingle();
    if (profileReadErr && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[profile] user_profile read', profileReadErr.message);
    }
    const name =
      (typeof profileRow?.name === 'string' && profileRow.name.trim()) ||
      (typeof meta?.full_name === 'string' && String(meta.full_name).trim()) ||
      (typeof meta?.name === 'string' && String(meta.name).trim()) ||
      (user.email ? user.email.split('@')[0] : 'Traveler');
    const cityVal =
      (typeof (profileRow as { city?: string } | null)?.city === 'string' &&
        String((profileRow as { city?: string }).city).trim()) ||
      (typeof meta?.city === 'string' && String(meta.city).trim()) ||
      'Athens';
    setProfileCity(cityVal);
    const vLine = defaultVibeFromProfile((profileRow as { city?: string } | null)?.city, meta);
    setDraftName(name);
    setDraftVibe(typeof meta?.vibe_line === 'string' && String(meta.vibe_line).trim() ? String(meta.vibe_line).trim() : vLine);
    const cached = await readCachedAvatarUrl(user.id);
    const url =
      (typeof profileRow?.avatar_url === 'string' && profileRow.avatar_url.trim()) ||
      (typeof meta?.avatar_url === 'string' && String(meta.avatar_url).trim()) ||
      cached ||
      '';
    if (url) {
      const sep = url.includes('?') ? '&' : '?';
      setAvatarUrl(`${url}${sep}v=${Date.now()}`);
    } else {
      setAvatarUrl(null);
    }
    if (guest) {
      const local = await readGuestProfileLocal();
      if (local.name.trim()) setDraftName(local.name.trim());
      if (local.email.trim()) setDraftEmail(local.email.trim());
      if (local.vibe.trim()) setDraftVibe(local.vibe.trim());
      if (local.avatarUrl.trim() && !url) {
        const sep = local.avatarUrl.includes('?') ? '&' : '?';
        setAvatarUrl(`${local.avatarUrl.trim()}${sep}v=${Date.now()}`);
      }
    }
    setJoinedLabel(joinedDateLabel(user.created_at));
  }, []);

  const onPullRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      await load();
    } finally {
      setListRefreshing(false);
    }
  }, [load]);

  const profileRefreshControl = usePremiumRefreshControl(listRefreshing, onPullRefresh);

  const persistAvatarUrl = useCallback(
    async (user: { id: string; user_metadata?: import('@supabase/supabase-js').UserMetadata }, publicUrl: string) => {
      const sep0 = publicUrl.includes('?') ? '&' : '?';
      setAvatarUrl(`${publicUrl}${sep0}v=${Date.now()}`);
      writeCachedAvatarUrl(user.id, publicUrl);
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { error: uErr } = await supabase.auth.updateUser({
        data: shallowAuthMetadataForUpdate(meta, { avatar_url: publicUrl }),
      });
      if (uErr) {
        const r = await updateAuthUserMetadataFields(user.id, { avatar_url: publicUrl });
        if (!r.ok) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[profile] auth metadata', r.message);
          }
        }
      }
      const metaName =
        (typeof meta.name === 'string' && meta.name) ||
        (typeof meta.full_name === 'string' && meta.full_name) ||
        'Traveler';
      const { error: upErr } = await supabase.from('user_profile').upsert(
        {
          id: user.id,
          name: metaName,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id', defaultToNull: false } as { onConflict: string; defaultToNull?: boolean },
      );
      if (upErr && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[profile] user_profile', upErr.message);
      }
      await refreshClientAuthSession();
      await load();
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const uploadAvatarFromPicker = async (fromCamera: boolean) => {
    await ensureAnonymousSession();
    await ensureClientSessionForStorage();
    await syncPilotHotelProfileIfNeeded();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Session required', 'Could not start a guest session. Try again in a moment.');
      return;
    }

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload your profile image.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      setUploadingAvatar(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const nameLower = (asset.fileName ?? '').toLowerCase();
      const mime = (asset.mimeType ?? '').toLowerCase();
      const uriLower = asset.uri.toLowerCase();
      const ext: 'png' | 'jpg' =
        mime.includes('png') || nameLower.endsWith('.png') || uriLower.includes('.png') ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const { publicUrl } = await uploadAvatarBytes({
        userId: user.id,
        bytes: arrayBuffer,
        ext,
        contentType,
      });
      await persistAvatarUrl(user, publicUrl);
      Alert.alert('Profile updated', 'Your profile photo was updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not upload profile photo.';
      const policyHint =
        message.toLowerCase().includes('row-level') || message.toLowerCase().includes('policy');
      Alert.alert(
        'Upload failed',
        policyHint
          ? `${message}\n\nStorage policy may be blocking writes for this user.`
          : message,
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadAvatarFromWebFile = useCallback(async (file: File) => {
    await ensureAnonymousSession();
    await ensureClientSessionForStorage();
    await syncPilotHotelProfileIfNeeded();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Session required', 'Could not start a guest session. Try again in a moment.');
      return;
    }
    try {
      setUploadingAvatar(true);
      const lower = file.name.toLowerCase();
      const ext = lower.endsWith('.png') ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const arrayBuffer = await file.arrayBuffer();
      const { publicUrl } = await uploadAvatarBytes({
        userId: user.id,
        bytes: arrayBuffer,
        ext,
        contentType,
      });
      await persistAvatarUrl(user, publicUrl);
      Alert.alert('Profile updated', 'Your profile photo was updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not upload profile photo.';
      Alert.alert('Upload failed', message);
    } finally {
      setUploadingAvatar(false);
    }
  }, [persistAvatarUrl]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = webFileInputRef.current;
    if (!input) return;
    const onNativeChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (file) void uploadAvatarFromWebFile(file);
      if (target) target.value = '';
    };
    input.addEventListener('change', onNativeChange);
    return () => {
      input.removeEventListener('change', onNativeChange);
    };
  }, [uploadAvatarFromWebFile]);

  const onUploadAvatar = async () => {
    if (uploadingAvatar) return;
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }
    await uploadAvatarFromPicker(false);
  };

  const onTakeAvatarPhoto = async () => {
    if (uploadingAvatar) return;
    await uploadAvatarFromPicker(true);
  };

  const onSaveProfile = useCallback(async () => {
    if (savingProfile) return;
    await ensureAnonymousSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Session required', 'We could not start a guest session. Reopen the app and try again.');
      return;
    }
    setSavingProfile(true);
    try {
      const normalizedEmail = draftEmail.trim().toLowerCase();
      if (normalizedEmail) {
        const currentEmail = String(user.email ?? '').trim().toLowerCase();
        if (!isGuest && currentEmail && normalizedEmail !== currentEmail) {
          const { error: emailErr } = await supabase.auth.updateUser({ email: normalizedEmail });
          if (emailErr) {
            Alert.alert('Could not update email', emailErr.message);
            return;
          }
        }
        const mergedMeta = shallowAuthMetadataForUpdate(
          (user.user_metadata ?? {}) as Record<string, unknown>,
          { profile_email: normalizedEmail },
        );
        const { error: metaErr } = await supabase.auth.updateUser({ data: mergedMeta });
        if (metaErr) {
          const fallbackMeta = await updateAuthUserMetadataFields(user.id, { profile_email: normalizedEmail });
          if (!fallbackMeta.ok) {
            Alert.alert('Could not save', fallbackMeta.message);
            return;
          }
        }
      }
      const r = await persistUserProfileIdentity({
        userId: user.id,
        displayName: draftName,
        city: profileCity,
        vibeLine: draftVibe,
        userMetadata: userMetadataForSave,
      });
      if (!r.ok) {
        Alert.alert('Could not save', r.message);
        return;
      }
      const snapUrl = (avatarUrl && avatarUrl.split('?')[0]) || '';
      await writeGuestProfileLocal({
        name: draftName.trim(),
        email: normalizedEmail,
        vibe: draftVibe.trim(),
        avatarUrl: snapUrl,
      });
      await refreshClientAuthSession();
      await load();
      setEmail(normalizedEmail || String(user.email ?? ''));
      Alert.alert('Saved', 'Your profile was updated.');
    } finally {
      setSavingProfile(false);
    }
  }, [savingProfile, draftEmail, isGuest, draftName, profileCity, draftVibe, userMetadataForSave, load, avatarUrl]);

  const onRemoveAvatar = async () => {
    if (uploadingAvatar) return;
    await ensureAnonymousSession();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Session required', 'Could not start a guest session. Try again in a moment.');
      return;
    }
    try {
      setUploadingAvatar(true);
      const mergedMeta = {
        ...(user.user_metadata ?? {}),
        avatar_url: null,
      };
      const { error: updateError } = await supabase.auth.updateUser({ data: mergedMeta });
      if (updateError) {
        const metaRes = await updateAuthUserMetadataFields(user.id, { avatar_url: null });
        if (!metaRes.ok) throw new Error(metaRes.message);
      }
      await supabase.from('user_profile').upsert(
        [
          {
            id: user.id,
            avatar_url: null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'id', defaultToNull: false } as { onConflict: string; defaultToNull?: boolean },
      );
      await refreshClientAuthSession();
      setAvatarUrl(null);
      writeCachedAvatarUrl(user.id, null);
      Alert.alert('Profile updated', 'Your profile photo was removed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not remove profile photo.';
      Alert.alert('Update failed', message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Profile',
          headerBackVisible: false,
          headerLeft: () => <ProfileBackHeaderButton />,
          headerStyle: { backgroundColor: '#FFFCF7' },
          headerTintColor: '#1a1816',
          headerShadowVisible: true,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={profileRefreshControl}
      >
        <ProfileInspirationStrip />
        <View style={styles.heroCard}>
          <View style={styles.hero}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <View testID="profile-avatar-image" style={styles.avatar} accessibilityLabel="Profile photo">
                  <ExpoImage
                    source={{ uri: avatarUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    key={avatarUrl}
                    cachePolicy="none"
                  />
                </View>
              ) : (
                <View testID="profile-avatar-fallback" style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initialsFromUser(email, localUserId)}</Text>
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={onTakeAvatarPhoto}
                style={({ pressed }) => [
                  styles.uploadButton,
                  pressed && styles.uploadButtonPressed,
                  uploadingAvatar && styles.uploadButtonDisabled,
                ]}
                disabled={uploadingAvatar}
                testID="profile-take-photo"
              >
                <Text style={styles.uploadButtonText}>
                  {uploadingAvatar ? 'Uploading photo...' : 'Take photo'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onUploadAvatar}
              style={({ pressed }) => [
                styles.uploadButtonSecondary,
                pressed && styles.uploadButtonPressed,
                uploadingAvatar && styles.uploadButtonDisabled,
              ]}
              disabled={uploadingAvatar}
              testID="profile-upload-library"
            >
              <Text style={styles.uploadButtonSecondaryText}>Upload from library</Text>
            </Pressable>
            {Platform.OS === 'web' ? (
              <input
                ref={webFileInputRef}
                data-testid="profile-avatar-file"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
              />
            ) : null}
            {avatarUrl ? (
              <Pressable
                onPress={onRemoveAvatar}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.uploadButtonPressed,
                  uploadingAvatar && styles.uploadButtonDisabled,
                ]}
                disabled={uploadingAvatar}
              >
                <Text style={styles.removeButtonText}>Remove photo</Text>
              </Pressable>
            ) : null}
            <Text style={styles.headerName} numberOfLines={1}>
              {draftName.trim() || 'Traveler'}
            </Text>
            {draftVibe.trim() ? (
              <Text style={styles.headerVibe} numberOfLines={2}>
                {draftVibe.trim()}
              </Text>
            ) : null}
            {draftEmail.trim() ? (
              <Text style={styles.headerEmail} numberOfLines={1}>
                {draftEmail.trim()}
              </Text>
            ) : (
              <Text style={styles.guestUnderAvatar} numberOfLines={2}>
                Add your email to personalize this profile
              </Text>
            )}
          </View>
        </View>

        <View style={styles.profileEditCard}>
          <Text style={styles.editCardKicker}>Your account</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Your name"
            placeholderTextColor="rgba(90, 82, 72, 0.45)"
            style={styles.fieldInput}
            editable={!savingProfile}
            autoCorrect
            testID="profile-input-name"
          />
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={draftEmail}
            onChangeText={setDraftEmail}
            placeholder="you@example.com"
            placeholderTextColor="rgba(90, 82, 72, 0.45)"
            style={styles.fieldInput}
            editable={!savingProfile}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="profile-input-email"
          />
          <Text style={styles.fieldLabel}>Vibe</Text>
          <TextInput
            value={draftVibe}
            onChangeText={setDraftVibe}
            placeholder="A short line that captures your style"
            placeholderTextColor="rgba(90, 82, 72, 0.45)"
            style={[styles.fieldInput, styles.vibeFieldInput]}
            multiline
            textAlignVertical="top"
            editable={!savingProfile}
            testID="profile-input-vibe"
          />
          <Pressable
            onPress={() => void onSaveProfile()}
            style={({ pressed }) => [
              styles.saveProfileButton,
              pressed && styles.saveProfileButtonPressed,
              savingProfile && styles.saveProfileButtonDisabled,
            ]}
            disabled={savingProfile}
            testID="profile-save"
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFCF7" />
            ) : (
              <Text style={styles.saveProfileButtonText}>Save Profile</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.sectionBody}>{profileIdentity}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Snapshot</Text>
          <Text style={styles.sectionBody}>
            {joinedLabel}
            {'\n'}
            Inbox, follow list, and requests are tied to this profile.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{profileAccessTitle}</Text>
          <Text style={styles.sectionBody}>{profileAccessBullets}</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#EFE9E0' },
  content: { paddingHorizontal: 20, paddingTop: 0 },
  inspirationStrip: {
    marginLeft: -20,
    marginRight: -20,
    marginBottom: 20,
    backgroundColor: 'rgba(8, 7, 5, 0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212, 175, 100, 0.4)',
    ...Platform.select({
      web: { backdropFilter: 'blur(14px)' } as object,
      default: {},
    }),
  },
  inspirationStripTopGold: {
    height: 2,
    width: '100%',
    backgroundColor: 'rgba(200, 165, 100, 0.5)',
  },
  inspirationStripInner: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  navBackButton: {
    paddingVertical: 6,
    paddingRight: 12,
    marginLeft: Platform.OS === 'ios' ? 4 : 0,
  },
  navBackText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1816',
    letterSpacing: 0.2,
  },
  inspirationKicker: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(220, 190, 125, 0.95)',
    letterSpacing: 2.6,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  inspirationLine: {
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic' as const,
    color: 'rgba(255, 252, 245, 0.98)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
    letterSpacing: 0.15,
  },
  inspirationStripDivider: {
    alignSelf: 'center',
    width: '42%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200, 175, 120, 0.2)',
  },
  heroCard: {
    width: '100%' as const,
    backgroundColor: '#FFFCF7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 180, 130, 0.35)',
    borderTopWidth: 3,
    borderTopColor: 'rgba(180, 145, 80, 0.45)',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 18,
    marginBottom: 12,
    shadowColor: '#1a1008',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  hero: { alignItems: 'center', marginBottom: 4 },
  avatarWrap: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEE',
    borderWidth: 3,
    borderColor: 'rgba(200, 175, 120, 0.5)',
    overflow: 'hidden',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1816',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(200, 175, 120, 0.45)',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  uploadButton: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  uploadButtonSecondary: {
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  uploadButtonPressed: {
    opacity: 0.9,
  },
  uploadButtonDisabled: {
    opacity: 0.65,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  uploadButtonSecondaryText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: '#D23B3B',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  removeButtonText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  guestUnderAvatar: {
    fontSize: 14,
    color: 'rgba(55, 48, 40, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    maxWidth: 300,
  },
  headerName: {
    fontSize: 23,
    fontWeight: '800',
    color: '#12100E',
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
  },
  headerVibe: {
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(55, 48, 40, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
    maxWidth: 320,
  },
  headerEmail: {
    fontSize: 14,
    color: '#5C534A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 2,
  },
  profileEditCard: {
    width: '100%' as const,
    backgroundColor: '#FFFCF7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 180, 130, 0.35)',
    borderTopWidth: 3,
    borderTopColor: 'rgba(180, 145, 80, 0.5)',
    padding: 20,
    marginBottom: 14,
    shadowColor: '#1a1008',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  editCardKicker: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(120, 100, 70, 0.9)',
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1816',
    marginBottom: 6,
  },
  fieldInput: {
    width: '100%' as const,
    borderWidth: 1,
    borderColor: 'rgba(200, 180, 130, 0.45)',
    backgroundColor: '#FFFCF7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#12100E',
    marginBottom: 16,
  },
  vibeFieldInput: {
    minHeight: 88,
    lineHeight: 22,
  },
  saveProfileButton: {
    marginTop: 4,
    backgroundColor: '#1a1816',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 175, 120, 0.4)',
  },
  saveProfileButtonPressed: { opacity: 0.9 },
  saveProfileButtonDisabled: { opacity: 0.5 },
  saveProfileButtonText: { color: '#FFFCF7', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  section: {
    marginBottom: 14,
    padding: 18,
    backgroundColor: '#FFFCF7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 180, 130, 0.2)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
});
