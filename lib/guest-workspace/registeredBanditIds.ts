/**
 * Story / journal attribution → registered Local banDit UUIDs only.
 * Never navigate to invented commercial slugs (bandit_elena, …) — those
 * are not Postgres UUIDs and dead-end the profile stack.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Proven registered rows (anon-session readable on prod Supabase). */
export const REGISTERED_BANDIT = {
  neo: "d76cb120-018d-4a2e-8b5f-0578a71fd8f9",
  elia: "d6db5a96-339b-4016-ba80-b785fbdfb8e8",
  sofia: "c7dea92f-403e-4e13-931c-15d706785d11",
  kostas: "d7f053c0-a4c5-4f70-a82c-037d82005808",
  andreas: "92f7a899-6e11-4fc9-a797-2f4ab20f1ebd",
  eleni: "6bc0cb1c-4980-4916-af98-3a97bba19ebd",
  melina: "489bc747-702c-447f-8a3f-3aab95981eae",
  nickolis: "2f5f4057-4f09-463f-8c08-d66d13caea1a",
} as const;

/**
 * Commercial / demo aliases historically used in journal seed → real UUIDs.
 * Workspace maps commercialBanditId `bandit_elena` → Neo.
 */
const ALIAS_TO_REGISTERED: Record<string, string> = {
  bandit_elena: REGISTERED_BANDIT.neo,
  elena: REGISTERED_BANDIT.neo,
  neo: REGISTERED_BANDIT.neo,
  bandit_sofia: REGISTERED_BANDIT.sofia,
  sofia: REGISTERED_BANDIT.sofia,
  bandit_keys: REGISTERED_BANDIT.kostas,
  keys: REGISTERED_BANDIT.kostas,
  kostas: REGISTERED_BANDIT.kostas,
  bandit_nikos: REGISTERED_BANDIT.nickolis,
  nikos: REGISTERED_BANDIT.nickolis,
  bandit_anna: REGISTERED_BANDIT.melina,
  anna: REGISTERED_BANDIT.melina,
};

export function isRegisteredBanditUuid(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(String(id).trim()));
}

/**
 * Resolve a profile/journal attribution id to a registered banDit UUID.
 * Returns null when nothing safe to open — callers must hide the CTA.
 */
export function resolveRegisteredBanditId(
  raw: string | null | undefined,
): string | null {
  const id = String(raw || "").trim();
  if (!id) return null;
  if (UUID_RE.test(id)) return id;
  const mapped = ALIAS_TO_REGISTERED[id.toLowerCase()];
  return mapped && UUID_RE.test(mapped) ? mapped : null;
}

export function banditProfileHrefSafe(raw: string | null | undefined): string | null {
  const id = resolveRegisteredBanditId(raw);
  return id ? `/bandit/${encodeURIComponent(id)}` : null;
}
