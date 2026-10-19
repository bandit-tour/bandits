import React from 'react';
import { Platform } from 'react-native';

// Import platform-specific components
import PlatformMapViewNative from './LeafletMapView.native';
import PlatformMapViewWeb from './LeafletMapView.web';

import type { Database } from '@/lib/database.types';

type EventRow = Database['public']['Tables']['event']['Row'];

interface MapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onMapReady: () => void;
  onError: (error: any) => void;
  onRegionChange: (region: any) => void;
  children?: React.ReactNode;
  miniMode?: boolean;
  banditId?: string;
  /** Rows already loaded by Explore — avoids duplicate fetch / timeout. */
  seedEvents?: EventRow[];
  /** Render these rows only (City Guide / Vibe), including an empty set. */
  preferSeed?: boolean;
  /** Map only, inside a parent of fixed height. Photo cards stay on the screen. */
  embedded?: boolean;
  selectedEventId?: string | null;
  onSelectEvent?: (event: EventRow) => void;
  /** Stop numbers for a Vibe Route. Keys are event ids. */
  markerLabels?: Record<string, string>;
  /** Draw the ordered path through numbered stops that already have coordinates. */
  showRouteLine?: boolean;
  initialCamera?: { latitude: number; longitude: number; zoom: number } | null;
}

// Export the appropriate component based on platform
const PlatformMapView = Platform.OS === 'web' ? PlatformMapViewWeb : PlatformMapViewNative;

const LeafletMapView = (props: MapViewProps) => {
  return <PlatformMapView {...props} />;
};

export default LeafletMapView;

// Export Marker component for compatibility
export { LeafletMarker as Marker } from './LeafletMapView.native';