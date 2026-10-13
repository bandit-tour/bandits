/**
 * Hook: keep a Guest surface alive — silent data reload on Workspace publish.
 * Prefer this over pull-to-refresh as the primary freshness path.
 */

import { useEffect, useRef } from "react";

import {
  subscribeGuestLiveSurface,
} from "@/lib/orchestra/live-bus";
import type { GuestLiveEvent, GuestLiveSurface } from "@/lib/orchestra/live-events";

export type GuestLiveReloadOpts = { silent?: boolean; event?: GuestLiveEvent };

/**
 * @param surface Existing Guest App surface
 * @param reload Must support silent=true (no full-screen spinner)
 */
export function useGuestLiveSurface(
  surface: GuestLiveSurface,
  reload: (opts?: GuestLiveReloadOpts) => void | Promise<void>,
): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    return subscribeGuestLiveSurface(surface, (event) => {
      void reloadRef.current({ silent: true, event });
    });
  }, [surface]);
}
