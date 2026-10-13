# Orchestra consumption + Alive Bus (GUEST-INT-1.0 · GUEST-ALIVE-001)

Workspaces **publish**. The Guest App **subscribes**. Surfaces update instantly.

| Module | Role |
|--------|------|
| `live-events.ts` | Event types · Workspace → surface routing · Alive Law |
| `live-bus.ts` | In-app fan-out + table-change mapping |
| `live-subscribe.ts` | Supabase Realtime subscriptions |
| `useGuestLiveSurface.ts` | Silent reload hook for screens |
| `GuestLiveBootstrap` | Root mount |
| `api/guest-live-publish.js` | Workspace HTTP publish into `guest_live_events` |
| `supabase/migrations/065_guest_live_events.sql` | Durable event log + realtime |

Pull-to-refresh is fallback. Primary path = live events.

Set `EXPO_PUBLIC_ORCHESTRA_OS_URL` for OS snapshots. Apply migration `065` for cross-workspace publish.
