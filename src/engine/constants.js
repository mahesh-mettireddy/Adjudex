// Shared, framework-independent constants for the Adjudex engine.
// Used by the browser app and the Node API alike (no DOM / Node-only imports).

export const ENGINE_VERSION = "1.2.0";
// Bump when rule semantics change so historical verdicts stay explainable.
export const RULESET_VERSION = "ruleset-2026.10.1";
export const AUDIT_SCHEMA = "adjudex.audit.v1";
export const LATENCY_BUDGET_MS = 8000;

export const VERDICTS = Object.freeze({
  IN_MANDATE: "IN_MANDATE",
  OUT_OF_MANDATE: "OUT_OF_MANDATE",
  AMBIGUOUS_UNVERIFIABLE: "AMBIGUOUS_UNVERIFIABLE",
});

export const LIABILITY = Object.freeze({
  none: "None",
  agent_provider: "Agent Provider",
  unassigned: "Unassigned: human review required",
});

export const STATUS = Object.freeze({
  MET: "MET",
  BREACHED: "BREACHED",
  UNVERIFIABLE: "UNVERIFIABLE",
});

export const EVIDENCE_VALUES = Object.freeze(["verified", "contradicted", "absent"]);

// Deliberately limited generation scenarios (see docs/API.md).
export const GENERATION_SCENARIOS = Object.freeze([
  "clean",
  "price_breach",
  "merchant_breach",
  "refundability_breach",
  "date_breach",
  "soft_contradiction",
  "soft_missing_evidence",
  "multiple_breaches",
  "mixed",
]);

// The verdict a generated case should produce for its intended scenario. "mixed"
// has no single expectation. Used only to flag demo cases whose generator missed
// its target; it never influences the verdict itself.
export const SCENARIO_EXPECTED_VERDICT = Object.freeze({
  clean: "IN_MANDATE",
  price_breach: "OUT_OF_MANDATE",
  merchant_breach: "OUT_OF_MANDATE",
  refundability_breach: "OUT_OF_MANDATE",
  date_breach: "OUT_OF_MANDATE",
  soft_contradiction: "OUT_OF_MANDATE",
  soft_missing_evidence: "AMBIGUOUS_UNVERIFIABLE",
  multiple_breaches: "OUT_OF_MANDATE",
});

export const LIMITS = Object.freeze({
  maxIdLength: 64,
  maxTextLength: 200,
  maxSoftInfoLength: 1000,
  maxMerchants: 50,
  maxSoftConstraints: 10,
  maxGenerateCount: 10,
  maxMoneyUnits: 1_000_000_000_000, // 1e12 whole currency units
});

export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
export const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
