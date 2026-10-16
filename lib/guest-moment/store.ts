import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { dayKeyUtc, pickInspiration } from "@/lib/guest-moment/inspiration";
import type {
  BottleScanSession,
  GuestMoment,
  MomentHistoryEntry,
  MomentSender,
} from "@/lib/guest-moment/types";

const MY_MOMENT_KEY = "@bandits_guest_moment_today_v1";
const POOL_KEY = "@bandits_guest_moment_pool_v1";
const HISTORY_KEY = "@bandits_guest_moment_history_v1";
const SESSION_KEY = "@bandits_bottle_scan_session_v1";
const THREADS_KEY = "@bandits_guest_moment_threads_v1";

async function getRaw(key: string): Promise<string> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }
  try {
    return (await AsyncStorage.getItem(key)) || "";
  } catch {
    return "";
  }
}

async function setRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "G";
}

/** Seed pool so Mode A works before other guests publish. */
const DEMO_POOL: GuestMoment[] = [
  {
    id: "demo_moment_elia",
    text: "You don’t always need a plan. Sometimes you need a street you’ve never walked before.",
    dayKey: dayKeyUtc(),
    updatedAt: new Date().toISOString(),
    bottleEligible: true,
    sender: {
      id: "demo_guest_elia",
      displayName: "Elia",
      city: "Athens",
      stayHint: "Staying near Psyrri",
      avatarInitials: "E",
      kind: "demo",
    },
  },
  {
    id: "demo_moment_maya",
    text: "Keep one empty hour. That’s where the trip happens.",
    dayKey: dayKeyUtc(),
    updatedAt: new Date().toISOString(),
    bottleEligible: true,
    sender: {
      id: "demo_guest_maya",
      displayName: "Maya",
      city: "Athens",
      stayHint: "PLAY Theatrou · Room 312",
      avatarInitials: "M",
      kind: "demo",
    },
  },
  {
    id: "demo_moment_nikos",
    text: "Ask a local where they go on their night off.",
    dayKey: dayKeyUtc(),
    updatedAt: new Date().toISOString(),
    bottleEligible: true,
    sender: {
      id: "demo_guest_nikos",
      displayName: "Nikos",
      city: "Athens",
      stayHint: "Two streets from Monastiraki",
      avatarInitials: "N",
      kind: "demo",
    },
  },
];

export async function ensureMomentPool(): Promise<GuestMoment[]> {
  const raw = await getRaw(POOL_KEY);
  if (!raw.trim()) {
    await setRaw(POOL_KEY, JSON.stringify(DEMO_POOL));
    return [...DEMO_POOL];
  }
  try {
    const parsed = JSON.parse(raw) as GuestMoment[];
    if (!Array.isArray(parsed) || !parsed.length) {
      await setRaw(POOL_KEY, JSON.stringify(DEMO_POOL));
      return [...DEMO_POOL];
    }
    return parsed;
  } catch {
    await setRaw(POOL_KEY, JSON.stringify(DEMO_POOL));
    return [...DEMO_POOL];
  }
}

export async function getMyMomentToday(self?: MomentSender): Promise<GuestMoment> {
  const today = dayKeyUtc();
  const raw = await getRaw(MY_MOMENT_KEY);
  if (raw.trim()) {
    try {
      const m = JSON.parse(raw) as GuestMoment;
      if (m && m.dayKey === today && String(m.text || "").trim()) {
        return m;
      }
    } catch {
      /* fall through */
    }
  }
  const insp = pickInspiration(`seed:${today}`);
  const sender: MomentSender = self || {
    id: "self",
    displayName: "You",
    city: "Athens",
    stayHint: "PLAY Theatrou",
    avatarInitials: "Y",
    kind: "guest",
  };
  const created: GuestMoment = {
    id: newId("moment"),
    text: insp.line,
    dayKey: today,
    updatedAt: new Date().toISOString(),
    /** Private by default — Bottle discovery requires explicit opt-in. */
    bottleEligible: false,
    sender,
  };
  await setRaw(MY_MOMENT_KEY, JSON.stringify(created));
  await upsertPoolMoment(created);
  return created;
}

export async function saveMyMoment(patch: {
  text: string;
  bottleEligible?: boolean;
  sender?: MomentSender;
}): Promise<GuestMoment> {
  const cur = await getMyMomentToday(patch.sender);
  const next: GuestMoment = {
    ...cur,
    id: cur.dayKey === dayKeyUtc() ? cur.id : newId("moment"),
    text: String(patch.text || "").trim().slice(0, 280),
    dayKey: dayKeyUtc(),
    updatedAt: new Date().toISOString(),
    bottleEligible: patch.bottleEligible === true,
    sender: patch.sender || cur.sender,
  };
  if (!next.text) throw new Error("Moment text is required.");
  await setRaw(MY_MOMENT_KEY, JSON.stringify(next));
  await upsertPoolMoment(next);

  /** Durable sync — Supabase first, Orchestra workspace bridge second. */
  try {
    const { publishMomentRemote } = await import("@/lib/guest-moment/remote");
    const remote = await publishMomentRemote({
      text: next.text,
      bottleEligible: next.bottleEligible,
      sender: next.sender,
    });
    if (remote?.id) {
      const synced = { ...next, id: remote.id, updatedAt: remote.updatedAt || next.updatedAt };
      await setRaw(MY_MOMENT_KEY, JSON.stringify(synced));
      await upsertPoolMoment(synced);
      return synced;
    }
  } catch {
    /* local persist remains; remote sync best-effort */
  }

  return next;
}

async function upsertPoolMoment(moment: GuestMoment): Promise<void> {
  const pool = await ensureMomentPool();
  const without = pool.filter((m) => m.sender.id !== moment.sender.id && m.id !== moment.id);
  if (moment.bottleEligible && moment.sender.id !== "self") {
    without.unshift(moment);
  } else if (moment.bottleEligible) {
    /** Self moments enter pool under a published identity for discovery demos. */
    const published: GuestMoment = {
      ...moment,
      sender: {
        ...moment.sender,
        id: moment.sender.id === "self" ? `guest_${moment.id}` : moment.sender.id,
        displayName:
          moment.sender.displayName === "You" ? "A traveler" : moment.sender.displayName,
        kind: "guest",
      },
    };
    without.unshift(published);
  }
  await setRaw(POOL_KEY, JSON.stringify(without.slice(0, 40)));
}

export async function pickEligibleGuestMoment(
  excludeSenderId?: string,
  excludeMomentIds?: string[],
): Promise<GuestMoment | null> {
  const excluded = new Set(
    (excludeMomentIds || []).map((x) => String(x || "").trim()).filter(Boolean),
  );

  /** Prefer durable remote Moments (Supabase / Orchestra). */
  try {
    const { pickEligibleMomentRemote } = await import("@/lib/guest-moment/remote");
    const remote = await pickEligibleMomentRemote(excludeSenderId);
    if (remote && !excluded.has(remote.id)) return remote;
  } catch {
    /* fall through to local pool */
  }

  const pool = await ensureMomentPool();
  const today = dayKeyUtc();
  /** Prefer real guest Moments over demo seed when any guest-published exist. */
  const guestPublished = pool.filter(
    (m) =>
      m.bottleEligible &&
      m.sender.kind === "guest" &&
      String(m.text || "").trim().length >= 8 &&
      m.dayKey === today &&
      (!excludeSenderId || m.sender.id !== excludeSenderId) &&
      !excluded.has(m.id),
  );
  const eligible = guestPublished.length
    ? guestPublished
    : pool.filter(
        (m) =>
          m.bottleEligible &&
          String(m.text || "").trim().length >= 8 &&
          (m.dayKey === today || m.sender.kind === "demo") &&
          (!excludeSenderId || m.sender.id !== excludeSenderId) &&
          !excluded.has(m.id),
      );
  if (!eligible.length) return null;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx]!;
}

export async function saveBottleScanSession(session: BottleScanSession): Promise<void> {
  await setRaw(SESSION_KEY, JSON.stringify(session));
}

export async function getBottleScanSession(): Promise<BottleScanSession | null> {
  const raw = await getRaw(SESSION_KEY);
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as BottleScanSession;
  } catch {
    return null;
  }
}

export async function revealBottleScanSender(): Promise<BottleScanSession | null> {
  const session = await getBottleScanSession();
  if (!session) return null;
  const next = { ...session, revealed: true };
  await saveBottleScanSession(next);
  await recordMomentReceived({
    id: newId("hist"),
    quote: session.quote,
    mode: session.mode,
    receivedAt: session.createdAt,
    sender: session.sender,
    revealed: true,
    replied: Boolean(session.chatThreadId),
    chatThreadId: session.chatThreadId,
    momentId: session.momentId,
    floatId: session.floatId,
  });
  try {
    const { updateDiscoveryRevealRemote } = await import("@/lib/guest-moment/remote");
    await updateDiscoveryRevealRemote({
      momentId: session.momentId,
      chatThreadId: session.chatThreadId,
      revealed: true,
      replied: Boolean(session.chatThreadId),
      senderName: session.sender.displayName,
    });
    /** Upgrade inbox title once identity is known. */
    if (session.notificationId && /^[0-9a-f-]{36}$/i.test(session.notificationId)) {
      const { supabase } = await import("@/lib/supabase");
      await supabase
        .from("notifications")
        .update({ title: session.sender.displayName })
        .eq("id", session.notificationId);
    }
  } catch {
    /* best-effort */
  }
  return next;
}

/** Bind Reply → Chat thread onto the active bottle session + history. */
export async function attachChatThreadToSession(threadId: string): Promise<BottleScanSession | null> {
  const session = await getBottleScanSession();
  if (!session) return null;
  const next = { ...session, chatThreadId: threadId, revealed: true };
  await saveBottleScanSession(next);
  const hist = await getMomentHistory();
  const updated = hist.map((h) =>
    (session.momentId && h.momentId === session.momentId) ||
    (session.floatId && h.floatId === session.floatId) ||
    h.id === session.id
      ? { ...h, chatThreadId: threadId, revealed: true, replied: h.replied }
      : h,
  );
  await setRaw(HISTORY_KEY, JSON.stringify(updated));
  return next;
}

export async function getMomentHistory(): Promise<MomentHistoryEntry[]> {
  const raw = await getRaw(HISTORY_KEY);
  if (!raw.trim()) return [];
  try {
    const list = JSON.parse(raw) as MomentHistoryEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function recordMomentReceived(entry: MomentHistoryEntry): Promise<void> {
  const list = await getMomentHistory();
  const without = list.filter(
    (h) =>
      !(
        (entry.momentId && h.momentId === entry.momentId) ||
        (entry.floatId && h.floatId === entry.floatId) ||
        h.id === entry.id
      ),
  );
  without.unshift(entry);
  await setRaw(HISTORY_KEY, JSON.stringify(without.slice(0, 50)));
}

export type MomentChatMessage = {
  id: string;
  role: "user" | "peer";
  body: string;
  sentAt: string;
};

export type MomentChatThread = {
  id: string;
  peer: MomentSender;
  openingQuote: string;
  messages: MomentChatMessage[];
  updatedAt: string;
};

async function readThreads(): Promise<Record<string, MomentChatThread>> {
  const raw = await getRaw(THREADS_KEY);
  if (!raw.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, MomentChatThread>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

async function writeThreads(map: Record<string, MomentChatThread>): Promise<void> {
  await setRaw(THREADS_KEY, JSON.stringify(map));
}

export async function getOrCreateMomentChatThread(args: {
  threadId?: string;
  peer: MomentSender;
  openingQuote: string;
}): Promise<MomentChatThread> {
  const map = await readThreads();
  const id = args.threadId || newId("gm");
  const existing = map[id];
  if (existing) return existing;
  const thread: MomentChatThread = {
    id,
    peer: args.peer,
    openingQuote: args.openingQuote,
    messages: [
      {
        id: "opening",
        role: "peer",
        body: args.openingQuote,
        sentAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  map[id] = thread;
  await writeThreads(map);
  return thread;
}

export async function loadMomentChatThread(threadId: string): Promise<MomentChatThread | null> {
  const map = await readThreads();
  return map[threadId] || null;
}

/** Local Mode A threads for Chat inbox merge (durable notifications may lag). */
export async function listMomentChatThreads(): Promise<MomentChatThread[]> {
  const map = await readThreads();
  return Object.values(map).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function removeMomentChatThread(threadId: string): Promise<void> {
  const id = String(threadId || "").trim();
  if (!id) return;
  const map = await readThreads();
  if (!map[id]) return;
  delete map[id];
  await writeThreads(map);
}

export async function appendMomentChatReply(threadId: string, body: string): Promise<MomentChatThread> {
  const map = await readThreads();
  const thread = map[threadId];
  if (!thread) throw new Error("Conversation not found.");
  const text = String(body || "").trim();
  if (!text) throw new Error("Message is required.");
  const next: MomentChatThread = {
    ...thread,
    messages: [
      ...thread.messages,
      {
        id: newId("msg"),
        role: "user",
        body: text.slice(0, 4000),
        sentAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  map[threadId] = next;
  await writeThreads(map);

  const session = await getBottleScanSession();
  if (session) {
    await saveBottleScanSession({ ...session, chatThreadId: threadId, revealed: true });
  }
  const hist = await getMomentHistory();
  const updated = hist.map((h) =>
    h.chatThreadId === threadId || (session && h.momentId && h.momentId === session.momentId)
      ? { ...h, replied: true, revealed: true, chatThreadId: threadId }
      : h,
  );
  await setRaw(HISTORY_KEY, JSON.stringify(updated));

  try {
    const { updateDiscoveryRevealRemote } = await import("@/lib/guest-moment/remote");
    await updateDiscoveryRevealRemote({
      momentId: session?.momentId,
      chatThreadId: threadId,
      revealed: true,
      replied: true,
    });
  } catch {
    /* best-effort */
  }

  try {
    const { persistMomentChatMessage } = await import("@/lib/guest-moment/connection");
    const peerId = thread.peer?.id;
    await persistMomentChatMessage({
      threadId,
      body: text,
      peerUserId: peerId && /^[0-9a-f-]{36}$/i.test(peerId) ? peerId : undefined,
      peerDisplayName: thread.peer?.displayName,
      selfDisplayName: "Traveler",
    });
  } catch {
    /* local thread remains durable on-device */
  }

  return next;
}

export { initials, newId };
