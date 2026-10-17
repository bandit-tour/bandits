/**
 * Lifecycle inbox notices — persistent in-app only.
 * Same inbox as Settings preferences. Not a second notification system.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { noteMarketingSent, readNoticePrefs } from "@/lib/notifications/prefs";
import { decideDelivery, type NotificationClass } from "@/lib/notifications/policy";

export const LIFECYCLE_NOTICES_KEY = "@bandits_lifecycle_notices_v1";

export type LifecycleNotice = {
  id: string;
  userId: string;
  title: string;
  message: string;
  href: string;
  at: string;
  read: boolean;
  notificationClass: NotificationClass;
  type?: string;
};

type FileShape = { notices: LifecycleNotice[] };

const CLASS_RANK: Record<NotificationClass, number> = { service: 0, social: 1, marketing: 2 };

async function readFile(): Promise<FileShape> {
  try {
    const raw =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.localStorage.getItem(LIFECYCLE_NOTICES_KEY)
        : await AsyncStorage.getItem(LIFECYCLE_NOTICES_KEY);
    if (!raw) return { notices: [] };
    const parsed = JSON.parse(raw) as FileShape;
    return { notices: Array.isArray(parsed.notices) ? parsed.notices : [] };
  } catch {
    return { notices: [] };
  }
}

async function writeFile(file: FileShape): Promise<void> {
  const raw = JSON.stringify(file);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(LIFECYCLE_NOTICES_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(LIFECYCLE_NOTICES_KEY, raw);
}

function normalize(notice: LifecycleNotice): LifecycleNotice {
  const notificationClass = decideDelivery({
    notificationClass: notice.notificationClass,
    type: notice.type,
    title: notice.title,
    message: notice.message,
    prefs: {
      serviceEnabled: true,
      socialEnabled: true,
      marketingEnabled: true,
      quietStartHour: 0,
      quietEndHour: 0,
      marketingSentAt: [],
    },
    lifecycleRelevant: true,
    alreadyDelivered: true,
  }).notificationClass;
  return { ...notice, notificationClass };
}

export async function listLifecycleNotices(userId: string): Promise<LifecycleNotice[]> {
  const file = await readFile();
  return file.notices.filter((n) => n.userId === userId).map(normalize);
}

/** Applies the saved category preferences. Service is not capped by marketing rules. */
export async function listVisibleLifecycleNotices(userId: string): Promise<LifecycleNotice[]> {
  const [rows, prefs] = await Promise.all([listLifecycleNotices(userId), readNoticePrefs()]);
  return rows
    .filter((n) => {
      if (!n.href || !n.href.startsWith("/")) return false;
      return decideDelivery({
        notificationClass: n.notificationClass,
        type: n.type,
        title: n.title,
        message: n.message,
        prefs,
        alreadyDelivered: true,
        lifecycleRelevant: true,
      }).allow;
    })
    .sort((a, b) => CLASS_RANK[a.notificationClass] - CLASS_RANK[b.notificationClass]);
}

/**
 * Idempotent by id. Refuses the write when the category rules say no.
 * Omitted class is classified from the title and type, and unknown copy stays marketing.
 */
export async function recordLifecycleNotice(input: {
  id: string;
  userId: string;
  title: string;
  message: string;
  href: string;
  notificationClass?: NotificationClass;
  type?: string;
  lifecycleRelevant?: boolean;
  explicitConsent?: boolean;
}): Promise<{ created: boolean; reason: string }> {
  const href = String(input.href || "").trim();
  if (!href.startsWith("/")) return { created: false, reason: "missing_destination" };
  const prefs = await readNoticePrefs();
  const decision = decideDelivery({
    notificationClass: input.notificationClass,
    type: input.type,
    title: input.title,
    message: input.message,
    prefs,
    lifecycleRelevant: input.lifecycleRelevant,
    explicitConsent: input.explicitConsent,
  });
  if (!decision.allow) return { created: false, reason: decision.reason };

  const file = await readFile();
  if (file.notices.some((n) => n.id === input.id && n.userId === input.userId)) {
    return { created: false, reason: "duplicate" };
  }
  const notice: LifecycleNotice = {
    id: input.id,
    userId: input.userId,
    title: input.title,
    message: input.message,
    href,
    at: new Date().toISOString(),
    read: false,
    notificationClass: decision.notificationClass,
    type: input.type,
  };
  await writeFile({ notices: [notice, ...file.notices].slice(0, 40) });
  if (decision.notificationClass === "marketing") await noteMarketingSent(notice.at);
  return { created: true, reason: decision.reason };
}
