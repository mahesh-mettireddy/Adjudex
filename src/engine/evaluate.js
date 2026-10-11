// Deterministic evaluator + verdict aggregator. No LLM, no I/O, no clock, no
// randomness: the same inputs always produce the same verdict and verdict ID.

import { LIABILITY, STATUS, VERDICTS, ENGINE_VERSION, RULESET_VERSION } from "./constants.js";
import { HARD_RULES } from "./rules.js";
import { sha256Hex, stableStringify } from "./hash.js";

const EVIDENCE_LABELS = Object.freeze({
  verified: "Verified",
  contradicted: "Contradicted (evidence against)",
  absent: "No evidence found",
});

const SOFT_DISPLAY_LABEL = Object.freeze({ quietRoom: "Quiet Room" });

/** Evidence for a soft-constraint key; supports `evidence{}` and `quietEvidence`. */
export function evidenceFor(execution, key) {
  const direct = execution.evidence && typeof execution.evidence === "object" ? execution.evidence[key] : undefined;
  const v = direct ?? (key === "quietRoom" ? execution.quietEvidence : undefined);
  return v === "verified" || v === "contradicted" ? v : "absent";
}

export function softRule(sc, execution) {
  const evidence = evidenceFor(execution, sc.key);
  const status = evidence === "verified" ? STATUS.MET : evidence === "contradicted" ? STATUS.BREACHED : STATUS.UNVERIFIABLE;
  return {
    key: sc.key,
    ctype: "soft_constraint",
    label: SOFT_DISPLAY_LABEL[sc.key] || sc.label,
    type: "soft",
    status,
    expected: `"${sc.label}" (natural language)`,
    actual: EVIDENCE_LABELS[evidence],
    detail:
      status === STATUS.MET
        ? "Evidence verifies the soft constraint"
        : status === STATUS.BREACHED
        ? "Evidence contradicts the soft constraint"
        : "No machine-checkable evidence; the clause is too vague to evaluate",
  };
}

/**
 * Precedence: any breach > any unverifiable > all met.
 * A breach is decisive even if other clauses are unverifiable (a proven
 * violation does not need the remaining evidence).
 */
export function aggregateVerdict(constraints) {
  if (constraints.some((c) => c.status === STATUS.BREACHED)) {
    return { verdict: VERDICTS.OUT_OF_MANDATE, liabilityCode: "agent_provider" };
  }
  if (constraints.some((c) => c.status === STATUS.UNVERIFIABLE)) {
    return { verdict: VERDICTS.AMBIGUOUS_UNVERIFIABLE, liabilityCode: "unassigned" };
  }
  return { verdict: VERDICTS.IN_MANDATE, liabilityCode: "none" };
}

/** Idempotency key: identical (mandate, execution, ruleset) => identical ID. */
export function inputHashFor(mandate, execution) {
  return sha256Hex(stableStringify({ mandate, execution, ruleset: RULESET_VERSION }));
}

export const verdictIdFor = (mandate, execution) => `VRD-${inputHashFor(mandate, execution).slice(0, 16)}`;

export function explain(verdict, constraints) {
  const of = (s) => constraints.filter((c) => c.status === s);
  const names = (list) => list.map((c) => c.label).join(", ");
  if (verdict === VERDICTS.OUT_OF_MANDATE) {
    const b = of(STATUS.BREACHED);
    return `Out of mandate: ${b.length} rule${b.length > 1 ? "s" : ""} breached (${names(b)}). Liability rests with the agent provider.`;
  }
  if (verdict === VERDICTS.AMBIGUOUS_UNVERIFIABLE) {
    const u = of(STATUS.UNVERIFIABLE);
    return `Abstained: ${names(u)} cannot be verified from the available evidence. No liability is assigned; human review is required.`;
  }
  return `In mandate: all ${constraints.length} rules are satisfied. No liability.`;
}

/**
 * Evaluate a (normalised) mandate against an execution.
 * Callers holding untrusted data should use `adjudicate()` which validates first.
 */
export function evaluate(mandate, execution) {
  const constraints = [
    ...HARD_RULES.map((rule) => rule(mandate, execution)),
    ...(mandate.softConstraints || []).map((sc) => softRule(sc, execution)),
  ];
  const { verdict, liabilityCode } = aggregateVerdict(constraints);
  const met = constraints.filter((c) => c.status === STATUS.MET).length;
  return {
    constraints,
    verdict,
    liability: LIABILITY[liabilityCode],
    liabilityCode,
    verdictId: verdictIdFor(mandate, execution),
    summary: { met, total: constraints.length },
    explanation: explain(verdict, constraints),
  };
}

export { ENGINE_VERSION, RULESET_VERSION };
