/**
 * Root bootstrap — Workspaces publish; Guest App stays subscribed for the session.
 */

import { useEffect } from "react";

import { startGuestLiveSubscriptions } from "@/lib/orchestra/live-subscribe";

export default function GuestLiveBootstrap() {
  useEffect(() => {
    const stop = startGuestLiveSubscriptions();
    return () => stop();
  }, []);

  return null;
}
