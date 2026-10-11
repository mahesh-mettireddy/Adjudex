// In-browser implementation of the same API surface as src/api/client.js, so
// the UI works offline (and in tests) with identical response shapes.
// Mirrors the server semantics: validation (422), immutable records (409),
// idempotent adjudication (`replayed`), 404s. Nothing leaves the browser.

import { ENGINE_VERSION, RULESET_VERSION, GENERATION_SCENARIOS, LIMITS, SCENARIO_EXPECTED_VERDICT } from "../engine/constants.js";
import { validateMandate } from "../engine/validateMandate.js";
import { validateExecution } from "../engine/validateExecution.js";
import { adjudicateValidated } from "../engine/adjudicate.js";
import { generateLocalCases } from "../engine/generate.js";
import { SAMPLE_MANDATE, SAMPLES } from "../engine/samples.js";
import { stableStringify } from "../engine/hash.js";

const ok = (status, data) => ({ ok: true, status, data, requestId: null });
const fail = (status, code, message, details) => ({
  ok: false,
  status,
  error: { code, message, ...(details ? { details } : {}) },
  requestId: null,
});

function putImmutable(map, id, record) {
  const existing = map.get(id);
  if (!existing) {
    map.set(id, record);
    return "created";
  }
  return stableStringify(existing) === stableStringify(record) ? "replayed" : "conflict";
}

export function createLocalApi({ now = Date.now } = {}) {
  const mandates = new Map();
  const executions = new Map();
  const audits = new Map();

  const store = (map, label, validated, idOf) => {
    if (!validated.ok) return fail(422, "validation_failed", "The request failed validation.", validated.errors);
    const id = idOf(validated.value);
    const status = putImmutable(map, id, validated.value);
    if (status === "conflict") return fail(409, "conflict", `${label} "${id}" already exists with different content. Records are immutable; use a new id.`);
    return ok(status === "created" ? 201 : 200, { [label.toLowerCase()]: map.get(id), replayed: status === "replayed" });
  };

  return {
    mode: "local",
    stats: () => ({ audits: audits.size, mandates: mandates.size, executions: executions.size }),
    health: async () =>
      ok(200, { status: "ok", engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, geminiConfigured: false, authRequired: false }),
    schema: async () => ok(200, { engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, scenarios: GENERATION_SCENARIOS }),
    samples: async () => ok(200, { mandate: SAMPLE_MANDATE, samples: SAMPLES }),

    createMandate: async (mandate) =>
      typeof mandate?.id !== "string"
        ? fail(422, "validation_failed", "The request failed validation.", [{ path: "mandate.id", code: "required", message: '"id" is required to store a mandate' }])
        : store(mandates, "Mandate", validateMandate(mandate), (v) => v.id),

    createExecution: async (execution) =>
      typeof execution?.caseId !== "string"
        ? fail(422, "validation_failed", "The request failed validation.", [{ path: "execution.caseId", code: "required", message: '"caseId" is required to store an execution' }])
        : store(executions, "Execution", validateExecution(execution), (v) => v.caseId),

    adjudicate: async (payload) => {
      const p = payload && typeof payload === "object" ? payload : {};
      let mandate;
      let execution;
      if (p.mandateId !== undefined || p.executionId !== undefined) {
        mandate = mandates.get(p.mandateId);
        execution = executions.get(p.executionId);
        if (!mandate) return fail(404, "mandate_not_found", `Mandate "${p.mandateId}" was not found.`);
        if (!execution) return fail(404, "execution_not_found", `Execution "${p.executionId}" was not found.`);
      } else {
        const m = validateMandate(p.mandate);
        const e = validateExecution(p.execution);
        const errors = [...(m.ok ? [] : m.errors), ...(e.ok ? [] : e.errors)];
        if (errors.length) return fail(422, "validation_failed", "The request failed validation.", errors);
        mandate = m.value;
        execution = e.value;
      }
      const audit = adjudicateValidated(mandate, execution, { now: now() });
      const existing = audits.get(audit.verdictId);
      if (existing) return ok(200, { audit: existing, replayed: true });
      audits.set(audit.verdictId, audit);
      return ok(201, { audit, replayed: false });
    },

    getAdjudication: async (verdictId) => {
      const audit = audits.get(verdictId);
      return audit ? ok(200, { audit }) : fail(404, "audit_not_found", `Adjudication "${verdictId}" was not found.`);
    },

    getCase: async (caseId) => {
      const execution = executions.get(caseId);
      if (!execution) return fail(404, "case_not_found", `Case "${caseId}" was not found.`);
      return ok(200, { caseId, execution, audits: [...audits.values()].filter((a) => a.execution.caseId === caseId) });
    },

    generateCase: async (payload = {}) => {
      const m = validateMandate(payload.mandate ?? SAMPLE_MANDATE);
      if (!m.ok) return fail(422, "validation_failed", "The request failed validation.", m.errors);
      const scenario = payload.scenario ?? "mixed";
      if (!GENERATION_SCENARIOS.includes(scenario)) return fail(422, "validation_failed", "Unknown scenario.");
      const count = Math.min(Math.max(Math.trunc(Number(payload.count)) || 1, 1), LIMITS.maxGenerateCount);
      const meta = { generator: "local", model: null, promptVersion: null, generatedAt: new Date(now()).toISOString(), validation: "passed" };
      const cases = generateLocalCases(m.value, { scenario, count, seed: now() }).map((c) => {
        const audit = adjudicateValidated(m.value, c.execution, { now: now(), meta });
        const expected = SCENARIO_EXPECTED_VERDICT[c.intendedScenario];
        return { ...c, intentMatched: expected ? audit.verdict === expected : null, audit };
      });
      return ok(200, { mandate: m.value, generation: { ...meta, fallback: { used: true, reason: "offline", message: "Generated in the browser (no server)." } }, cases });
    },
  };
}
