import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/** Native only — web uses `LocalFriendBottleHero.web.tsx` (static image, no video hooks). */
const LOCAL_FRIEND_BOTTLE_SOURCE = require('@/assets/images/local-friend-bottle.mov');

type LocalFriendBottleHeroProps = {
  height?: number;
};

export function LocalFriendBottleHero({ height = 280 }: LocalFriendBottleHeroProps) {
  const player = useVideoPlayer(LOCAL_FRIEND_BOTTLE_SOURCE);

  React.useEffect(() => {
    try {
      player.loop = true;
      player.muted = true;
      player.play();
    } catch {
      // Keep UI stable if video cannot start.
    }
  }, [player]);

  return (
    <View style={[styles.wrap, { height }]}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B0F18',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
