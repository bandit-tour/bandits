import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BaseModal from './BaseModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileModal({ visible, onClose }: ProfileModalProps) {
  const router = useRouter();

  return (
    <BaseModal visible={visible} onClose={onClose} height={220}>
      <View style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              onClose();
              router.push('/settings');
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="gearshape.fill" size={22} color="#0a7ea4" />
            <Text style={styles.settingsText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDCE5',
    backgroundColor: '#F3FBFE',
    minWidth: 150,
  },
  settingsText: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#0a7ea4',
  },
});