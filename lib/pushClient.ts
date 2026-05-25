import { getPilotApiBaseUrl } from '@/lib/pilotApiBase';
import { supabase } from '@/lib/supabase';

const DEFAULT_PROD = 'https://bandits-two.vercel.app';

function resolveApiBase(): string | null {
  const base = getPilotApiBaseUrl();
  if (base) return base;
  if (__DEV__) return DEFAULT_PROD;
  return DEFAULT_PROD;
}

/** Fire-and-forget push after client-side notification insert (operator chat reply, etc.). */
export async function requestPushForRecipient(args: {
  recipientUserId: string;
  referenceId: string;
  referenceType: string;
  title?: string;
  body?: string;
  surface?: 'inbox' | 'chat';
  kind?: string;
}): Promise<void> {
  const recipientUserId = String(args.recipientUserId || '').trim();
  const referenceId = String(args.referenceId || '').trim();
  const referenceType = String(args.referenceType || '').trim();
  if (!recipientUserId || !referenceId) return;

  const apiBase = resolveApiBase();
  if (!apiBase) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await fetch(`${apiBase}/api/push?action=notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        recipientUserId,
        referenceId,
        referenceType,
        title: args.title,
        body: args.body,
        surface: args.surface ?? 'chat',
        kind: args.kind ?? 'chat_message',
      }),
    });
  } catch {
    /* non-blocking */
  }
}
