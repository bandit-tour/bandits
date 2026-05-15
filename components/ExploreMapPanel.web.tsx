import LeafletMapView from '@/components/LeafletMapView';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import type { Database } from '@/lib/database.types';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type Event = Database['public']['Tables']['event']['Row'];

type Props = {
  events: Event[];
  banditId?: string;
  onOpenSpot: (eventId: string) => void;
  listBottomPad: number;
  isLiked: (eventId: string) => boolean;
  onLike: (eventId: string) => void;
  visible?: boolean;
};

/** Web: reuse Leaflet screen; events come from Explore cache (no duplicate timeout fetch). */
export default function ExploreMapPanelWeb({ banditId, events, visible = true }: Props) {
  if (!visible) return <View style={styles.root} />;
  return (
    <View style={styles.root}>
      <LeafletMapView
        banditId={banditId}
        seedEvents={events}
        initialRegion={ATHENS_CENTER}
        onMapReady={() => {}}
        onError={() => {}}
        onRegionChange={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
