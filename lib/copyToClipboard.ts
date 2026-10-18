import { Platform } from "react-native";

/** Best-effort copy — web proof uses navigator.clipboard. */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const mod = await import("expo-clipboard").catch(() => null);
    if (mod?.setStringAsync) {
      await mod.setStringAsync(value);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
