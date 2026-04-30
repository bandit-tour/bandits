import { isMissingPostgrestRpcError } from '@/lib/rpcFallback';
import { getPilotApiBaseUrl } from '@/lib/pilotApiBase';
import { supabase } from '@/lib/supabase';

export type ModerationStatus = 'published' | 'hidden' | 'rejected';

export async function pilotVerifyScamAlert(id: string): Promise<void> {
  const rid = String(id || '').trim();
  if (!rid) throw new Error('Missing alert id.');
  const { error } = await supabase.from('scam_alerts').update({ admin_verified: true }).eq('id', rid);
  if (error) throw new Error(error.message || 'Could not verify alert.');
}

export async function pilotSetScamAlertModeration(id: string, status: ModerationStatus): Promise<void> {
  const rid = String(id || '').trim();
  if (!rid) throw new Error('Missing alert id.');
  const { error } = await supabase.from('scam_alerts').update({ moderation_status: status }).eq('id', rid);
  if (error) throw new Error(error.message || 'Could not update moderation.');
}

export async function pilotDeleteScamAlert(id: string): Promise<void> {
  const rid = String(id || '').trim();
  if (!rid) throw new Error('Missing alert id.');

  /**
   * Pilot Desk already gated via `resolvePilotDeskAccess` — do not re-run it here (second snapshot
   * often disagreed on native before RPC ran).
   *
   * **Operator id resolution must match `ensureOperatorUserId()`:** DB `app_public_config` then
   * `EXPO_PUBLIC_OPERATOR_USER_ID`. The Postgres RPC `delete_scam_alert_if_operator` only consults
   * `app_public_config` inside `is_pilot_operator()` — if that row is missing while the app build’s
   * env UUID matches the signed-in operator, Pilot Desk still shows but RPC fails. The Vercel route
   * `api/pilot-delete-scam-alert` mirrors the client’s DB-then-env check, so we call it **first** on
   * production native/web when `EXPO_PUBLIC_PILOT_API_BASE` / default host is set.
   */
  const {
    data: { session },
    error: sessErr,
  } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message || 'Could not verify your session.');
  if (!session?.user) {
    throw new Error('Not signed in.');
  }
  const token = session.access_token;

  const apiBase = getPilotApiBaseUrl();
  if (apiBase && token) {
    try {
      const res = await fetch(`${apiBase}/api/pilot-delete-scam-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: rid }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) return;
      if (res.status !== 503 && res.status !== 404 && res.status !== 403) {
        throw new Error((j.error && String(j.error)) || 'Could not delete report.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Could not delete')) throw e;
    }
  }

  const { error: rpcErr } = await supabase.rpc('delete_scam_alert_if_operator', { p_id: rid } as never);
  if (!rpcErr) return;

  const { data, error } = await supabase.from('scam_alerts').delete().eq('id', rid).select('id');
  if (!error && data?.length) return;

  const { error: rpcError } = await supabase.rpc('delete_scam_alert_if_operator', { p_id: rid } as never);
  if (!rpcError) return;
  if (error && !isMissingPostgrestRpcError(rpcError)) {
    throw new Error(error.message || rpcError.message || 'Could not delete alert.');
  }

  if (!isMissingPostgrestRpcError(rpcError)) {
    throw new Error(rpcError.message || 'Could not delete alert.');
  }

  throw new Error('Could not delete report. Confirm operator DB policies and migration 028 are in sync.');
}
