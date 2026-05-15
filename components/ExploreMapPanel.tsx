import { Platform } from 'react-native';

import ExploreMapPanelNative from './ExploreMapPanel.native';
import ExploreMapPanelWeb from './ExploreMapPanel.web';

export default Platform.OS === 'web' ? ExploreMapPanelWeb : ExploreMapPanelNative;
