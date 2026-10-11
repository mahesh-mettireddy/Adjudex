// POST /api/demo/generate-case: Gemini-assisted demo generation with a
// deterministic fallback. The verdict is ALWAYS computed by the engine; the
// response never contains a success-shaped fake AI result.

import { GENERATION_SCENARIOS, LIMITS, SCENARIO_EXPECTED_VERDICT } from "../src/engine/constants.js";
import { validateMandate } from "../src/engine/validateMandate.js";
import { adjudicateValidated } from "../src/engine/adjudicate.js";
import { SAMPLE_MANDATE } from "../src/engine/samples.js";
import { generateLocalCases } from "../src/engine/generate.js";
import { generateWithGemini, GeminiError } from "./gemini.js";
import { requireObject, validationFailure } from "./handlers.js";

const REQUEST_FIELDS = ["scenario", "count", "mandate", "forceLocal"];

function parseRequest(body) {
  const b = requireObject(body);
  const unknown = Object.keys(b).filter((k) => !REQUEST_FIELDS.includes(k));
  if (unknown.length) {
    throw validationFailure(unknown.map((k) => ({ path: `request.${k}`, code: "unknown_field", message: `"${k}" is not a recognised field` })));
  }
  const scenario = b.scenario ?? "mixed";
  if (!GENERATION_SCENARIOS.includes(scenario)) {
    throw validationFailure([{ path: "request.scenario", code: "invalid_scenario", message: `scenario must be one of ${GENERATION_SCENARIOS.join(", ")}` }]);
  }
  let count = 1;
  if (b.count !== undefined) {
    if (!Number.isInteger(b.count) || b.count < 1) {
      throw validationFailure([{ path: "request.count", code: "invalid_count", message: "count must be a positive integer" }]);
    }
    count = Math.min(b.count, LIMITS.maxGenerateCount); // clamp, per recommendations
  }
  if (b.forceLocal !== undefined && typeof b.forceLocal !== "boolean") {
    throw validationFailure([{ path: "request.forceLocal", code: "invalid_boolean", message: "forceLocal must be true or false" }]);
  }
  const m = validateMandate(b.mandate ?? SAMPLE_MANDATE);
  if (!m.ok) throw validationFailure(m.errors);
  return { scenario, count, mandate: m.value, forceLocal: b.forceLocal === true };
}

const FALLBACK_REASON = {
  unavailable: "Gemini is not configured on this server.",
  timeout: "Gemini timed out.",
  upstream: "Gemini is unavailable or rate-limited.",
  invalid_output: "Gemini returned output that failed validation.",
};

export async function generateCase(ctx, body) {
  const { scenario, count, mandate, forceLocal } = parseRequest(body);
  let cases;
  let meta;
  let fallback = null;

  if (!forceLocal) {
    try {
      ({ cases, meta } = await generateWithGemini(ctx.config.gemini, { mandate, scenario, count }, ctx.fetch));
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      fallback = { used: true, reason: err.kind, message: FALLBACK_REASON[err.kind] ?? "Gemini failed." };
    }
  }
  if (!cases) {
    if (forceLocal) fallback = { used: true, reason: "requested", message: "Local generator requested." };
    cases = generateLocalCases(mandate, { scenario, count, seed: ctx.now() });
    meta = { generator: "local", model: null, promptVersion: null, generatedAt: new Date(ctx.now()).toISOString(), validation: "passed" };
  }

  const results = cases.map((c) => {
    // Verdict derived by the deterministic evaluator, never by the model.
    const audit = adjudicateValidated(mandate, c.execution, { now: ctx.now(), meta });
    const expected = SCENARIO_EXPECTED_VERDICT[c.intendedScenario];
    return {
      name: c.name,
      intendedScenario: c.intendedScenario,
      // null = no expectation ("mixed"); false = the generator missed its target scenario.
      intentMatched: expected ? audit.verdict === expected : null,
      execution: c.execution,
      audit,
    };
  });
  return { status: 200, body: { mandate, generation: { ...meta, fallback }, cases: results } };
}
