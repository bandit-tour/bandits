/**
 * Authoritative Local banDit operator type for Premium Concierge.
 * HUMAN | AI_AGENT | HYBRID — derived from Workspace/commerce fields only.
 * Never infer from display names, portraits, or copy.
 */

export type ConciergeOperatorType = "HUMAN" | "AI_AGENT" | "HYBRID" | "UNDECLARED";

export type ConciergeOperatorResolution = {
  operatorType: ConciergeOperatorType;
  /** Guest-safe label — never invents "human" when undeclared. */
  guestLabel: string;
  /** Evidence keys used (field paths), not imagery/names. */
  evidenceFields: string[];
  blockers: string[];
  /** Who owns fulfillment for guest-facing ownership line. */
  ownershipSurface: "Workspace" | "Guest" | "Unknown";
  canGuestTrustHumanClaim: boolean;
};

type VisibilityLike = {
  octopusVerified?: boolean;
  showPremiumInsights?: boolean;
  premiumConciergeEnabled?: boolean;
  commercialBanditId?: string | null;
  authorizationClass?: string | null;
  /** Explicit Workspace field if/when shipped. */
  operatorType?: string | null;
  operator_type?: string | null;
  fulfillmentOperator?: string | null;
  fulfillment_operator?: string | null;
  agentMode?: string | null;
  agent_mode?: string | null;
  isAiAgent?: boolean | null;
  is_ai_agent?: boolean | null;
  hybridOperator?: boolean | null;
  hybrid_operator?: boolean | null;
  banditEmail?: string | null;
  bandit_email?: string | null;
};

type PersonLike = {
  email?: string | null;
  roles?: string[] | null;
  /** Explicit person-level operator type if Workspace adds it. */
  operatorType?: string | null;
  operator_type?: string | null;
};

function normalizeDeclared(raw: string | null | undefined): ConciergeOperatorType | null {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s === "HUMAN" || s === "HUMAN_OPERATOR" || s === "LOCAL_BANDIT_HUMAN") return "HUMAN";
  if (s === "AI" || s === "AI_AGENT" || s === "AGENT" || s === "AUTONOMOUS_AI") return "AI_AGENT";
  if (s === "HYBRID" || s === "HUMAN_AI" || s === "AI_ASSISTED") return "HYBRID";
  return null;
}

function guestLabelFor(type: ConciergeOperatorType, banditFirstName: string): string {
  const name = String(banditFirstName || "").trim() || "Your banDit";
  switch (type) {
    case "HUMAN":
      return `${name} (human Local banDit)`;
    case "AI_AGENT":
      return `${name} (AI agent · operational Concierge)`;
    case "HYBRID":
      return `${name} (AI + human Concierge)`;
    default:
      return `${name} (operator type not declared)`;
  }
}

/**
 * Resolve operator type from Workspace visibility / person / commercial fields only.
 * If no explicit field exists, returns UNDECLARED — never guess HUMAN from a name/photo.
 */
export function resolveConciergeOperatorType(input: {
  visibility?: VisibilityLike | null;
  person?: PersonLike | null;
  commercial?: {
    premiumConciergeEnabled?: boolean;
    operatorType?: string | null;
    operator_type?: string | null;
    applicantEmail?: string | null;
  } | null;
  /** Organic operator login succeeded with LOCAL_BANDIT role (proven session). */
  organicHumanSessionProven?: boolean;
  banditFirstName?: string;
}): ConciergeOperatorResolution {
  const evidenceFields: string[] = [];
  const blockers: string[] = [];
  const v = input.visibility || {};
  const p = input.person || {};
  const c = input.commercial || {};

  const declared =
    normalizeDeclared(v.operatorType) ||
    normalizeDeclared(v.operator_type) ||
    normalizeDeclared(v.fulfillmentOperator) ||
    normalizeDeclared(v.fulfillment_operator) ||
    normalizeDeclared(v.agentMode) ||
    normalizeDeclared(v.agent_mode) ||
    normalizeDeclared(p.operatorType) ||
    normalizeDeclared(p.operator_type) ||
    normalizeDeclared(c.operatorType) ||
    normalizeDeclared(c.operator_type);

  if (v.operatorType != null) evidenceFields.push("visibility.operatorType");
  if (v.operator_type != null) evidenceFields.push("visibility.operator_type");
  if (v.fulfillmentOperator != null) evidenceFields.push("visibility.fulfillmentOperator");
  if (v.agentMode != null) evidenceFields.push("visibility.agentMode");
  if (v.isAiAgent === true || v.is_ai_agent === true) {
    evidenceFields.push(v.isAiAgent === true ? "visibility.isAiAgent" : "visibility.is_ai_agent");
    return {
      operatorType: "AI_AGENT",
      guestLabel: guestLabelFor("AI_AGENT", input.banditFirstName || ""),
      evidenceFields,
      blockers: [],
      ownershipSurface: "Workspace",
      canGuestTrustHumanClaim: false,
    };
  }
  if (v.hybridOperator === true || v.hybrid_operator === true) {
    evidenceFields.push(
      v.hybridOperator === true ? "visibility.hybridOperator" : "visibility.hybrid_operator",
    );
    return {
      operatorType: "HYBRID",
      guestLabel: guestLabelFor("HYBRID", input.banditFirstName || ""),
      evidenceFields,
      blockers: [],
      ownershipSurface: "Workspace",
      canGuestTrustHumanClaim: false,
    };
  }

  if (declared) {
    evidenceFields.push("declared_operator_type_field");
    return {
      operatorType: declared,
      guestLabel: guestLabelFor(declared, input.banditFirstName || ""),
      evidenceFields,
      blockers: [],
      ownershipSurface: "Workspace",
      canGuestTrustHumanClaim: declared === "HUMAN" || declared === "HYBRID",
    };
  }

  // Proven human Workspace session with LOCAL_BANDIT (or bandit) role — still not "AI".
  const roles = Array.isArray(p.roles) ? p.roles.map((r) => String(r).toUpperCase()) : [];
  if (input.organicHumanSessionProven && roles.some((r) => /BANDIT|LOCAL_BANDIT/.test(r))) {
    evidenceFields.push("person.roles", "organicHumanSessionProven");
    return {
      operatorType: "HUMAN",
      guestLabel: guestLabelFor("HUMAN", input.banditFirstName || ""),
      evidenceFields,
      blockers: [],
      ownershipSurface: "Workspace",
      canGuestTrustHumanClaim: true,
    };
  }

  if (c.applicantEmail && /@banditour\.demo$/i.test(String(c.applicantEmail))) {
    evidenceFields.push("commercial.applicantEmail");
    // Demo commercial login path is human Elena-style — only when session also proven.
    if (input.organicHumanSessionProven) {
      evidenceFields.push("organicHumanSessionProven");
      return {
        operatorType: "HUMAN",
        guestLabel: guestLabelFor("HUMAN", input.banditFirstName || ""),
        evidenceFields,
        blockers: [],
        ownershipSurface: "Workspace",
        canGuestTrustHumanClaim: true,
      };
    }
  }

  blockers.push(
    "No authoritative operatorType / isAiAgent / hybridOperator field on Workspace visibility, commercial, or person payloads.",
  );
  if (v.commercialBanditId) evidenceFields.push("visibility.commercialBanditId");
  if (v.premiumConciergeEnabled != null) evidenceFields.push("visibility.premiumConciergeEnabled");

  return {
    operatorType: "UNDECLARED",
    guestLabel: guestLabelFor("UNDECLARED", input.banditFirstName || ""),
    evidenceFields,
    blockers,
    ownershipSurface: "Unknown",
    canGuestTrustHumanClaim: false,
  };
}

/** Notes that must not hit Workspace (would unfairly consume Stay Pass). */
export function isSubstantiveConciergeNote(
  note: string,
  servicePrefix?: string | null | readonly string[],
): { ok: true } | { ok: false; reason: "empty" | "prefix_only" | "too_short" } {
  let t = String(note || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  const prefixes = (Array.isArray(servicePrefix) ? servicePrefix : [servicePrefix])
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    // Longer titles first so "Book a Taxi" wins over "Taxi".
    .sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    const next = t.replace(new RegExp(`^${escapeReg(prefix)}\\s*:?\\s*`, "i"), "").trim();
    if (next !== t) {
      t = next;
      break;
    }
  }
  if (!t) return { ok: false, reason: "prefix_only" };
  if (t.length < 8) return { ok: false, reason: "too_short" };
  return { ok: true };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
