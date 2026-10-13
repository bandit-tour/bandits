import AsyncStorage from "@react-native-async-storage/async-storage";

export type GuestLanguageCode = "en" | "el" | "he";

export type GuestLanguageOption = {
  code: GuestLanguageCode;
  label: string;
  nativeLabel: string;
};

export const GUEST_LANGUAGES: GuestLanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "el", label: "Greek", nativeLabel: "Ελληνικά" },
  { code: "he", label: "Hebrew", nativeLabel: "עברית" },
];

const STORAGE_KEY = "bandits:guestLanguage";

let memoryLang: GuestLanguageCode = "en";
const listeners = new Set<(code: GuestLanguageCode) => void>();

export function getGuestLanguageSync(): GuestLanguageCode {
  return memoryLang;
}

export async function loadGuestLanguage(): Promise<GuestLanguageCode> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "el" || raw === "he") {
      memoryLang = raw;
      return raw;
    }
  } catch {
    /* keep default */
  }
  return memoryLang;
}

export async function setGuestLanguage(code: GuestLanguageCode): Promise<void> {
  memoryLang = code;
  listeners.forEach((fn) => fn(code));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* preference still applied in-memory */
  }
}

export function subscribeGuestLanguage(fn: (code: GuestLanguageCode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function languageLabel(code: GuestLanguageCode): string {
  return GUEST_LANGUAGES.find((l) => l.code === code)?.label ?? "English";
}
