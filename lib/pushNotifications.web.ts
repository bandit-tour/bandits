/** Web has no OS push/badge — in-app tab badges only. */
export async function initPushNotifications(): Promise<void> {}

export async function registerPushTokenIfPossible(): Promise<void> {}

export async function unregisterPushToken(): Promise<void> {}

export async function syncOsAppIconBadge(_inboxUnread: number, _chatUnread: number): Promise<void> {}

export function addPushNotificationListeners(
  _onNavigate: (data: Record<string, string>) => void,
): () => void {
  return () => undefined;
}
