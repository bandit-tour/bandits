/** When PostgREST has not picked up a new RPC yet, or the migration is not applied. */
export function isMissingPostgrestRpcError(rpcError: { message?: string; code?: string }): boolean {
  const m = (rpcError.message || '').toLowerCase();
  const c = String(rpcError.code || '');
  if (c === 'PGRST202' || c === '42883' || c === '42P01') return true;
  if (m.includes('does not exist') || m.includes('not found in the schema') || m.includes('schema cache')) {
    return true;
  }
  return false;
}
