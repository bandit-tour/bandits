/**
 * Lifecycle inbox notices — persistent in-app only.
 * Written for genuine preference or state changes. Not a parallel notifications DB.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const LIFECYCLE_NOTICES_KEY = "@bandits_lifecycle_notices_v1";

export type LifecycleNotice = {
  id: string;
  userId: string;
  title: string;
  message: string;
  href: string;
  at: string;
  read: boolean;
};

type FileShape = { notices: LifecycleNotice[] };

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

export async function listLifecycleNotices(userId: string): Promise<LifecycleNotice[]> {
  const file = await readFile();
  return file.notices.filter((n) => n.userId === userId);
}

/** Idempotent by id — same id never doubles the inbox. */
export async function recordLifecycleNotice(input: {
  id: string;
  userId: string;
  title: string;
  message: string;
  href: string;
}): Promise<{ created: boolean }> {
  const file = await readFile();
  if (file.notices.some((n) => n.id === input.id && n.userId === input.userId)) {
    return { created: false };
  }
  const notice: LifecycleNotice = {
    id: input.id,
    userId: input.userId,
    title: input.title,
    message: input.message,
    href: input.href,
    at: new Date().toISOString(),
    read: false,
  };
  await writeFile({ notices: [notice, ...file.notices].slice(0, 40) });
  return { created: true };
}
