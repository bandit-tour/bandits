import { supabase } from '@/lib/supabase';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import ExploreIcon from '@/assets/icons/explore.svg';
import LocalBanditsIcon from '@/assets/icons/localBandits.svg';
import BottomNavigation from '@/components/BottomNavigation';
import { HapticTab } from '@/components/HapticTab';
import ProfileModal from '@/components/modals/ProfileModal';
import TakePartModal from '@/components/modals/TakePartModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const iconColor = 'white';
  const router = useRouter();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [takePartModalVisible, setTakePartModalVisible] = useState(false);

  // Check if user's email is verified before allowing access to tabs
  useEffect(() => {
    const checkEmailVerification = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !user.email_confirmed_at) {
          console.log('❌ User trying to access tabs without email verification');
          // Redirect back to auth screen
          router.replace('/');
        }
      } catch (e) {
        console.error('[TabLayout] getUser failed', e);
      }
    };

    checkEmailVerification();
  }, [router]);

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* <ModeHeader /> */}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarPosition: 'top',
        tabBarStyle: {
          borderTopWidth: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          height: 60,
          flexShrink: 0, // Prevent the tab bar from shrinking
        },
        // Ensure content area takes remaining space
        contentStyle: {
          flex: 1,
        },
      }}>
      <Tabs.Screen
        name="bandits"
        options={{
          title: 'local banDit',
            tabBarIcon: () => <LocalBanditsIcon width={28} height={28} fill={iconColor} />,
        }}
      />

      <Tabs.Screen
        name="mySpots"
        options={{
        title: 'My Spots',
          tabBarIcon: () => <IconSymbol name="heart" size={28} color="#000000" />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: () => <ExploreIcon width={28} height={28} fill={iconColor} />,
        }}
      />


    </Tabs>
    <BottomNavigation
      onProfilePress={() => setProfileModalVisible(true)}
      onTakePartPress={() => setTakePartModalVisible(true)}
    />

    <ProfileModal
      visible={profileModalVisible}
      onClose={() => setProfileModalVisible(false)}
    />

    <TakePartModal
      visible={takePartModalVisible}
      onClose={() => setTakePartModalVisible(false)}
    />
    </View>
  );
}
