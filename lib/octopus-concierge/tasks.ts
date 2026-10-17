/**
 * Structured ConciergeTask helpers — only create when entitlement is ACTIVE.
 */

import type {
  ConciergeExecutionMethod,
  ConciergeTask,
  ConciergeTaskCategory,
} from "@/lib/octopus-concierge/types";
import type { OctopusEntitlement } from "@/lib/octopus-concierge/entitlement";
import { assertConciergeOpsAllowed } from "@/lib/octopus-concierge/entitlement";

function inferCategory(request: string): ConciergeTaskCategory {
  const t = request.toLowerCase();
  if (/restaurant|table|dinner|lunch|reserv/.test(t)) return "restaurant";
  if (/ticket|concert|show|theatre|theater/.test(t)) return /theatre|theater/.test(t) ? "theatre" : "tickets";
  if (/airport|transfer/.test(t)) return "airport_transfer";
  if (/taxi|cab|ride/.test(t)) return "taxi";
  if (/wolt|food delivery|uber ?eats/.test(t)) return "delivery_wolt";
  if (/deliver/.test(t)) return "delivery_local";
  if (/club|nightlife|bar|cocktail/.test(t)) return "nightlife";
  if (/special|custom/.test(t)) return "special";
  return "other";
}

function defaultMethod(category: ConciergeTaskCategory): ConciergeExecutionMethod {
  // Most local arrangements need ASSISTED or HUMAN — do not pretend AUTO covers restaurants.
  if (category === "taxi" || category === "delivery_wolt") return "ASSISTED";
  if (category === "restaurant" || category === "nightlife" || category === "theatre") return "HUMAN";
  return "ASSISTED";
}

/**
 * Create a structured task stub for entitled guests.
 * Returns null if not entitled — never invents operating work for unpaid guests.
 */
export function createConciergeTaskStub(
  entitlement: OctopusEntitlement,
  input: {
    request: string;
    banditDisplayName: string;
    category?: ConciergeTaskCategory;
    executionMethod?: ConciergeExecutionMethod;
    deadline?: string | null;
    location?: string | null;
  },
): ConciergeTask | null {
  if (!assertConciergeOpsAllowed(entitlement)) return null;
  const guestKey = entitlement.guestId;
  if (!guestKey) return null;
  const request = input.request.trim();
  if (!request) return null;
  const category = input.category ?? inferCategory(request);
  const now = new Date().toISOString();
  return {
    id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    request,
    guestId: guestKey,
    banditId: entitlement.banditId,
    banditDisplayName: input.banditDisplayName,
    category,
    deadline: input.deadline ?? null,
    location: input.location ?? null,
    budget: null,
    executionMethod: input.executionMethod ?? defaultMethod(category),
    status: "requested",
    confirmation: null,
    providerReply: null,
    cost: null,
    commission: null,
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}
