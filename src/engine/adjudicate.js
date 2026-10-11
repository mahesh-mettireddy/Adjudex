// The single trusted entry point: validate untrusted input, evaluate
// deterministically, and return an immutable-shaped audit record.

import { AUDIT_SCHEMA, ENGINE_VERSION, RULESET_VERSION } from "./constants.js";
import { validateMandate } from "./validateMandate.js";
import { validateExecution } from "./validateExecution.js";
import { evaluate, inputHashFor } from "./evaluate.js";

/**
 * @param {{mandate: unknown, execution: unknown}} input untrusted payload
 * @param {{now?: number, meta?: object}} [options] `now` is epoch ms (injectable for tests)
 * @returns {{ok: true, audit: object} | {ok: false, errors: Array<{path: string, code: string, message: string}>}}
 */
export function adjudicate(input, options = {}) {
  const errors = [];
  const src = input !== null && typeof input === "object" ? input : {};
  const m = validateMandate(src.mandate);
  const e = validateExecution(src.execution);
  if (!m.ok) errors.push(...m.errors);
  if (!e.ok) errors.push(...e.errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, audit: adjudicateValidated(m.value, e.value, options) };
}

/**
 * Best-effort normalisation for interactive callers (the UI): valid inputs are
 * normalised exactly as the API does, so verdict IDs match across UI and API.
 * Invalid inputs are passed through unchanged (the rules then abstain safely)
 * and the validation errors are returned so they can be shown to the user.
 */
export function prepareInputs(mandate, execution) {
  const m = validateMandate(mandate);
  const e = validateExecution(execution);
  return {
    mandate: m.ok ? m.value : mandate,
    execution: e.ok ? e.value : execution,
    valid: m.ok && e.ok,
    errors: [...(m.ok ? [] : m.errors), ...(e.ok ? [] : e.errors)],
  };
}

/** For callers that already hold validated/normalised data. */
export function adjudicateValidated(mandate, execution, { now = Date.now(), meta } = {}) {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = evaluate(mandate, execution);
  const finished = typeof performance !== "undefined" ? performance.now() : Date.now();
  const audit = {
    schema: AUDIT_SCHEMA,
    verdictId: result.verdictId,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    inputHash: inputHashFor(mandate, execution),
    evaluatedAt: new Date(now).toISOString(),
    latencyMs: Math.max(0, Math.round((finished - started) * 100) / 100),
    verdict: result.verdict,
    liability: result.liability,
    liabilityCode: result.liabilityCode,
    explanation: result.explanation,
    summary: result.summary,
    constraints: result.constraints,
    mandate,
    execution,
  };
  if (meta) audit.generation = meta;
  return audit;
}
