import React from 'react';
import { View, StyleSheet } from 'react-native';
import BaseModal from './BaseModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface TakePartModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TakePartModal({ visible, onClose }: TakePartModalProps) {
  const colorScheme = useColorScheme();

  return (
    <BaseModal visible={visible} onClose={onClose} height={300}>
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol
            name="person.2.circle.fill"
            size={60}
            color={Colors[colorScheme ?? 'light'].tabIconDefault}
          />
          <ThemedText type="title" style={styles.title}>Take Part</ThemedText>
          <ThemedText style={styles.subtitle}>Community & events</ThemedText>
        </View>

        <ThemedView style={[
          styles.content,
          { backgroundColor: Colors[colorScheme ?? 'light'].background }
        ]}>
          <ThemedText style={styles.placeholder}>
            Participate in local events, challenges, and connect with other explorers — check back as we
            add more ways to join in.
          </ThemedText>
        </ThemedView>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
  },
  placeholder: {
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
});