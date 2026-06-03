import { addDismissedNotificationId } from '@/lib/dismissedThreads';
import { removeStoredDemoNotification } from '@/lib/demoMode';
import { removeNearbyStoredNotification } from '@/lib/nearbyAlertsStorage';
import { deleteNotificationThread } from '@/lib/threadDelete';

export type InboxDismissTarget = {
  id: string;
  fromServer: boolean;
  referenceType: string | null;
  wasUnread?: boolean;
};

/** Remove one inbox row for the signed-in traveler (server, demo, or nearby). */
export async function dismissInboxNotification(target: InboxDismissTarget): Promise<void> {
  const id = String(target.id || '').trim();
  if (!id) return;

  if (target.referenceType === 'nearby_route') {
    await removeNearbyStoredNotification(id);
    await addDismissedNotificationId(id);
    return;
  }

  if (!target.fromServer) {
    await removeStoredDemoNotification(id);
    await addDismissedNotificationId(id);
    return;
  }

  try {
    await deleteNotificationThread(id);
  } catch {
    /* still hide locally if server delete fails */
  }
  await addDismissedNotificationId(id);
}

export async function dismissInboxNotifications(targets: InboxDismissTarget[]): Promise<void> {
  for (const t of targets) {
    await dismissInboxNotification(t);
  }
}
