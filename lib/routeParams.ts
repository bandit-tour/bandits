/** Normalize expo-router search params (iOS often delivers string[]). */
export function routeParamString(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}
