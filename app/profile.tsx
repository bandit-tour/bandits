import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return '?';
  const part = email.split('@')[0] || email;
  return part.slice(0, 2).toUpperCase();
}

function joinedDateLabel(createdAt?: string): string {
  if (!createdAt) return 'Recently joined';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Recently joined';
  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [joinedLabel, setJoinedLabel] = useState<string>('Recently joined');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEmail('');
      setDisplayName('Guest');
      setAvatarUrl(null);
      setJoinedLabel('Sign in to personalize your profile');
      return;
    }
    setEmail(user.email ?? '');
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name =
      (typeof meta?.full_name === 'string' && meta.full_name) ||
      (typeof meta?.name === 'string' && meta.name) ||
      (user.email ? user.email.split('@')[0] : 'Traveler');
    setDisplayName(name);
    const url = typeof meta?.avatar_url === 'string' ? meta.avatar_url : null;
    setAvatarUrl(url?.trim() || null);
    setJoinedLabel(joinedDateLabel(user.created_at));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAvatarFromPicker = async (fromCamera: boolean) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Sign in required', 'Please sign in to upload a profile photo.');
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

      const ext = asset.uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const objectPath = `profile_avatars/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('banditsassets4')
        .upload(objectPath, arrayBuffer, {
          contentType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('banditsassets4').getPublicUrl(objectPath);
      const publicUrl = publicData.publicUrl;
      if (!publicUrl) throw new Error('Could not resolve avatar URL.');

      const mergedMeta = {
        ...(user.user_metadata ?? {}),
        avatar_url: publicUrl,
      };
      const { error: updateError } = await supabase.auth.updateUser({
        data: mergedMeta,
      });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
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

  const onUploadAvatar = async () => {
    if (uploadingAvatar) return;
    await uploadAvatarFromPicker(false);
  };

  const onTakeAvatarPhoto = async () => {
    if (uploadingAvatar) return;
    await uploadAvatarFromPicker(true);
  };

  const onRemoveAvatar = async () => {
    if (uploadingAvatar) return;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert('Sign in required', 'Please sign in to update your profile photo.');
      return;
    }
    try {
      setUploadingAvatar(true);
      const mergedMeta = {
        ...(user.user_metadata ?? {}),
        avatar_url: null,
      };
      const { error: updateError } = await supabase.auth.updateUser({
        data: mergedMeta,
      });
      if (updateError) throw updateError;
      setAvatarUrl(null);
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
      <Stack.Screen options={{ headerShown: true, title: 'Profile' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      >
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initialsFromEmail(email)}</Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={onTakeAvatarPhoto}
            style={({ pressed }) => [
              styles.uploadButton,
              pressed && styles.uploadButtonPressed,
              uploadingAvatar && styles.uploadButtonDisabled,
            ]}
            disabled={uploadingAvatar}
          >
            <Text style={styles.uploadButtonText}>
              {uploadingAvatar ? 'Uploading photo...' : 'Take photo'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onUploadAvatar}
            style={({ pressed }) => [
              styles.uploadButtonSecondary,
              pressed && styles.uploadButtonPressed,
              uploadingAvatar && styles.uploadButtonDisabled,
            ]}
            disabled={uploadingAvatar}
          >
            <Text style={styles.uploadButtonSecondaryText}>Upload from library</Text>
          </Pressable>
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
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email || 'Sign in to sync your account'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.sectionBody}>
            This is your guest identity for PLAY city access.
          </Text>
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
          <Text style={styles.sectionTitle}>PLAY Guest Access</Text>
          <Text style={styles.sectionBody}>
            - Local banDits recommendations by neighborhood{'\n'}
            - City routes with map context and live spots{'\n'}
            - Local Friend requests and replies in Inbox
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EEE',
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
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
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
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
