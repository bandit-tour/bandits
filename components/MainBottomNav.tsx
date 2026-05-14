import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type BottomTabKey = 'home' | 'localFriend' | 'chat' | 'alerts' | 'notifications' | 'menu';

interface MainBottomNavProps {
  activeTab: BottomTabKey;
  onHome: () => void;
  onLocalFriend: () => void;
  onChat: () => void;
  onAlerts: () => void;
  onNotifications: () => void;
  onMenu: () => void;
  inboxBadgeCount?: number;
  chatBadgeCount?: number;
}

export default function MainBottomNav({
  activeTab,
  onHome,
  onLocalFriend,
  onChat,
  onAlerts,
  onNotifications,
  onMenu,
  inboxBadgeCount = 0,
  chatBadgeCount = 0,
}: MainBottomNavProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8);

  const getColor = (key: BottomTabKey) =>
    activeTab === key ? theme.tint : theme.text;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.tabIconDefault,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <NavButton
        label="Home"
        iconName="house.fill"
        color={getColor('home')}
        onPress={onHome}
      />

      <NavButton
        label="Local Friend"
        iconName="person.2.fill"
        color={getColor('localFriend')}
        onPress={onLocalFriend}
      />

      <NavButton
        label="Chat"
        iconName="bubble.left.and.bubble.right.fill"
        color={getColor('chat')}
        onPress={onChat}
        badgeCount={chatBadgeCount}
      />

      <NavButton
        label="Alerts"
        iconName="exclamationmark.triangle.fill"
        color={getColor('alerts')}
        onPress={onAlerts}
      />

      <NavButton
        label="Notifications"
        iconName="bell.badge.fill"
        color={getColor('notifications')}
        onPress={onNotifications}
        badgeCount={inboxBadgeCount}
      />

      <NavButton
        label="Menu"
        iconName="line.3.horizontal"
        color={getColor('menu')}
        onPress={onMenu}
      />
    </View>
  );
}

interface NavButtonProps {
  label: string;
  iconName: string;
  color: string;
  onPress: () => void;
  badgeCount?: number;
}

function NavButton({ label, iconName, color, onPress, badgeCount = 0 }: NavButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <View style={styles.iconWrapper}>
        <IconSymbol name={iconName as any} size={24} color={color} />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    minHeight: 64,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minWidth: 0,
  },
  iconWrapper: {
    position: 'relative',
  },
  buttonText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
});

