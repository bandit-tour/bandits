import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const INBOX_ACK_KEY = 'osBadge.inboxAckUnread';
const CHAT_ACK_KEY = 'osBadge.chatAckUnread';

/**
 * OS home-screen badge uses surface ack baselines: opening Notifications or Chat
 * clears that surface's contribution until new unread arrives (tab badges unchanged).
 */
export async function markInboxSurfaceOpened(currentInboxUnread: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(INBOX_ACK_KEY, String(Math.max(0, currentInboxUnread)));
}

export async function markChatSurfaceOpened(currentChatUnread: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(CHAT_ACK_KEY, String(Math.max(0, currentChatUnread)));
}

export async function computeOsAppBadgeCount(
  inboxUnread: number,
  chatUnread: number,
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const [inboxAckRaw, chatAckRaw] = await Promise.all([
    AsyncStorage.getItem(INBOX_ACK_KEY),
    AsyncStorage.getItem(CHAT_ACK_KEY),
  ]);
  const inboxAck = Math.max(0, parseInt(inboxAckRaw ?? '0', 10) || 0);
  const chatAck = Math.max(0, parseInt(chatAckRaw ?? '0', 10) || 0);
  const inboxPart = Math.max(0, inboxUnread - inboxAck);
  const chatPart = Math.max(0, chatUnread - chatAck);
  return Math.min(99, inboxPart + chatPart);
}

export async function clearOsSurfaceAcks(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([AsyncStorage.removeItem(INBOX_ACK_KEY), AsyncStorage.removeItem(CHAT_ACK_KEY)]);
}
