/**
 * Personal Impact ledger — verified events only.
 * Seed figures in IMPACT_VIEW are editorial and must never be written here.
 * Drops are destination totals of these events. They are not environmental proof
 * and they do not redeem for payment or privileges.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const IMPACT_LEDGER_KEY = "@bandits_impact_ledger_v1";

/** Next ocean mark. Not a commercial reward. */
export const IMPACT_DROP_MILESTONE = 10;

/**
 * Scoring for verified actions only. Applied once per event id.
 * Page views, refreshes and client replays of the same id do not add Drops.
 */
export const IMPACT_DROP_RULES = {
  verified_local_purchase: 4,
  verified_cause_contribution: 8,
  verified_volunteer_completion: 6,
} as const;

export type ImpactEventKind = keyof typeof IMPACT_DROP_RULES;

export type ImpactEvent = {
  id: string;
  userId: string;
  kind: ImpactEventKind;
  city: string;
  title: string;
  drops: number;
  at: string;
  /** Short evidence the guest can read. No spend, hotel or precise address. */
  evidence: string;
};

export type ImpactNotice = {
  id: string;
  userId: string;
  eventId: string;
  title: string;
  message: string;
  at: string;
};

type LedgerFile = {
  events: ImpactEvent[];
  notices: ImpactNotice[];
};

const EMPTY: LedgerFile = { events: [], notices: [] };

async function readFile(): Promise<LedgerFile> {
  try {
    const raw =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.localStorage.getItem(IMPACT_LEDGER_KEY)
        : await AsyncStorage.getItem(IMPACT_LEDGER_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as LedgerFile;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
    };
  } catch {
    return EMPTY;
  }
}

async function writeFile(file: LedgerFile): Promise<void> {
  const raw = JSON.stringify(file);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(IMPACT_LEDGER_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(IMPACT_LEDGER_KEY, raw);
}

export async function listImpactEvents(userId: string): Promise<ImpactEvent[]> {
  const file = await readFile();
  return file.events.filter((e) => e.userId === userId);
}

export async function listImpactNotices(userId: string): Promise<ImpactNotice[]> {
  const file = await readFile();
  return file.notices.filter((n) => n.userId === userId);
}

export function dropsForCity(events: ImpactEvent[], city?: string): number {
  return events
    .filter((e) => !city || e.city === city)
    .reduce((sum, e) => sum + e.drops, 0);
}

/**
 * Idempotent. The same event id never awards Drops twice.
 * Returns created:false when the id was already stored.
 */
export async function recordVerifiedImpact(input: {
  userId: string;
  eventId: string;
  kind: ImpactEventKind;
  city: string;
  title: string;
  evidence: string;
}): Promise<{ created: boolean; event: ImpactEvent }> {
  const file = await readFile();
  const existing = file.events.find((e) => e.id === input.eventId && e.userId === input.userId);
  if (existing) return { created: false, event: existing };

  const event: ImpactEvent = {
    id: input.eventId,
    userId: input.userId,
    kind: input.kind,
    city: input.city.trim() || "Athens",
    title: input.title.trim(),
    drops: IMPACT_DROP_RULES[input.kind],
    at: new Date().toISOString(),
    evidence: input.evidence.trim(),
  };
  const notice: ImpactNotice = {
    id: `notice_${event.id}`,
    userId: event.userId,
    eventId: event.id,
    title: "Impact recorded",
    message: `${event.title} · ${event.drops} Drops in ${event.city}`,
    at: event.at,
  };
  await writeFile({
    events: [event, ...file.events].slice(0, 200),
    notices: [notice, ...file.notices.filter((n) => n.id !== notice.id)].slice(0, 40),
  });
  return { created: true, event };
}

export function sharePassportText(events: ImpactEvent[]): string {
  const cities = [...new Set(events.map((e) => e.city))];
  const drops = events.reduce((s, e) => s + e.drops, 0);
  return `My Impact Passport — ${drops} verified Drops across ${cities.join(", ") || "my travels"}. ${events.length} confirmed action${events.length === 1 ? "" : "s"}.`;
}
