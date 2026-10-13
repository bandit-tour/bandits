import type { Href, Router } from "expo-router";

import { upperTabHref, type UpperTabKey } from "@/lib/upperTab";

/** HOME = trip brain (ACCESS). */
export const APP_HOME_HREF = "/home" as Href;

/** Application menu / MORE = full universe. */
export const PLAY_MENU_HREF = "/menu" as Href;

/** Operator thread reply opened from Notifications / Pilot Desk. */
export const OPERATOR_CHAT_HREF = "/chat" as Href;

export type AppNavigationRouter = Pick<Router, "replace" | "push" | "back" | "canGoBack">;

/**
 * FINAL CANONICAL bottom ACCESS (locked — 6 items):
 * Home · Explore · Hotel · Local Friend · Chat · More
 * Notifications = GuestChromeBar bell only.
 * bandiTEAM = top rail (active stay) + More — not a bottom peer.
 */
export type LowerTabKey =
  | "home"
  | "explore"
  | "hotelier"
  | "localFriend"
  | "chat"
  | "alerts"
  | "notifications"
  | "profile"
  | "menu";

export type LowerTabHref =
  | "/home"
  | "/bandits"
  | "/explore"
  | "/hotelier"
  | "/localFriend"
  | "/community"
  | "/alerts"
  | "/notifications"
  | "/profile"
  | "/menu";

/**
 * Bottom-nav highlight from pathname.
 * Home = trip brain. Explore = discovery (incl. Bandit lane + bandiTEAM rail).
 * Local Friend = persistent bottom peer. More = menu/profile/Impact universe.
 */
export function getLowerTabFromPath(pathname: string | null): LowerTabKey | null {
  if (!pathname) return null;
  if (pathname.includes("/hotelier")) return "hotelier";
  if (pathname.includes("/localFriend")) return "localFriend";
  if (pathname.includes("/community")) return "chat";
  /** Operational chat thread — not product discovery. */
  if (pathname.includes("/chat") && !pathname.includes("/bandit")) return "chat";
  /** Inbox/notifications: chrome bell only — do not light a bottom tab. */
  if (pathname.includes("/notifications") || pathname.includes("/inbox")) return null;
  if (
    pathname.includes("/profile") ||
    pathname.includes("/mySpots") ||
    pathname.includes("/following") ||
    pathname.includes("/settings") ||
    pathname.includes("/account") ||
    pathname.includes("/menu") ||
    pathname.includes("/operatorDesk")
  ) {
    return "menu";
  }
  /** Impact / Passport — More universe, not Explore peer. */
  if (pathname.includes("/impact") || pathname.includes("/journey/")) return "menu";
  /**
   * Explore discovery surfaces — Bandits, Experiences, SmartTraveler, Shop, Bottle,
   * and bandiTEAM / scam-alerts (top-rail safety layer on active stay).
   */
  if (
    pathname.includes("/explore") ||
    pathname.includes("/bandits") ||
    pathname.includes("/experiences") ||
    pathname.includes("/smarttraveler") ||
    pathname.includes("/travelBottle") ||
    pathname.includes("/shop") ||
    pathname.includes("/alerts") ||
    pathname.includes("/scam-alerts") ||
    pathname.includes("/bandiTeam")
  ) {
    return "explore";
  }
  if (pathname.includes("/home")) return "home";
  return null;
}

/**
 * Upper discovery rail highlight.
 * Impact is More — never lights a discovery chip.
 * `/explore` lands as container (key "explore") with no rail chip selected.
 */
export function getUpperTabFromPath(pathname: string | null): UpperTabKey | null {
  if (!pathname) return null;
  if (pathname.includes("/bandit/")) return null;
  if (pathname.includes("/home")) return null;
  if (pathname.includes("/impact")) return null;
  if (pathname.includes("/experiences")) return "experiences";
  if (pathname.includes("/smarttraveler")) return "smarttraveler";
  if (pathname.includes("/travelBottle")) return "bottle";
  if (pathname.includes("/bottle")) return null;
  if (pathname.includes("/shop")) return "shop";
  if (
    pathname.includes("/bandiTeam") ||
    pathname.includes("/scam-alerts") ||
    pathname.includes("/scam-alert") ||
    pathname.includes("/alerts")
  ) {
    return "banditeam";
  }
  if (pathname.includes("/explore")) return "explore";
  if (pathname.includes("/bandits")) return "bandits";
  return null;
}

const NAV_LOCK_MS = 280;
let lastSafeNavAt = 0;

export function runSafeNavigation(_label: string, fn: () => void): boolean {
  const now = Date.now();
  if (now - lastSafeNavAt < NAV_LOCK_MS) return false;
  lastSafeNavAt = now;
  fn();
  return true;
}

export function banditProfileHref(banditId: string): Href {
  return `/bandit/${encodeURIComponent(String(banditId || "").trim())}` as Href;
}

type NavigationLike = {
  canGoBack?: () => boolean;
  goBack?: () => void;
};

export function navigateAppBack(
  router: AppNavigationRouter,
  fallback: Href,
  navigation?: NavigationLike | null,
): void {
  runSafeNavigation("back", () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack?.();
      return;
    }
    router.replace(fallback);
  });
}

export function goToPlayMenu(router: AppNavigationRouter): void {
  runSafeNavigation("menu", () => {
    router.replace(PLAY_MENU_HREF);
  });
}

export function goToAppHome(router: AppNavigationRouter): void {
  runSafeNavigation("home", () => {
    router.replace(APP_HOME_HREF);
  });
}

export function navigateLowerTab(
  router: AppNavigationRouter,
  path: LowerTabHref,
  tab: LowerTabKey,
  currentTab: LowerTabKey | null,
): boolean {
  return runSafeNavigation(`tab:${tab}`, () => {
    if (tab === "home") {
      if (currentTab === "home") return;
      router.replace(APP_HOME_HREF);
      return;
    }
    if (currentTab === tab) return;
    router.replace(path as Href);
  });
}

export function navigateUpperTab(router: AppNavigationRouter, tab: UpperTabKey): void {
  runSafeNavigation(`upper:${tab}`, () => {
    router.replace(upperTabHref(tab) as Href);
  });
}

export function navigateToBanditProfile(router: AppNavigationRouter, banditId: string): void {
  const id = String(banditId || "").trim();
  if (!id) return;
  router.push(banditProfileHref(id));
}
