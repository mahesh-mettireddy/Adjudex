// Validation of AI-generated demo cases (Gemini output contract). AI output is
// untrusted: every case must pass the same strict execution validator as user
// input, match the mandate currency, and carry no unexpected fields.

import { GENERATION_SCENARIOS, LIMITS } from "./constants.js";
import { cleanText } from "./text.js";
import { validateExecution } from "./validateExecution.js";
import { isPlainObject, rejectUnknown, Collector } from "./validateShared.js";

/** Remove an optional Markdown code fence some models wrap around JSON. */
export function stripCodeFence(text) {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
  return m ? m[1] : text;
}

/**
 * @param {unknown} payload parsed Gemini JSON (or a JSON string)
 * @param {object} mandate validated mandate (currency is enforced)
 * @param {{maxCases?: number}} [opts]
 * @returns {{ok: true, cases: object[]} | {ok: false, errors: object[]}}
 */
export function validateGeneratedCases(payload, mandate, { maxCases = LIMITS.maxGenerateCount } = {}) {
  const c = new Collector();
  let data = payload;
  if (typeof payload === "string") {
    try {
      data = JSON.parse(stripCodeFence(payload));
    } catch {
      c.add("response", "invalid_json", "Model output is not valid JSON");
      return { ok: false, errors: c.errors };
    }
  }
  if (!isPlainObject(data)) {
    c.add("response", "invalid_type", "Model output must be a JSON object");
    return { ok: false, errors: c.errors };
  }
  rejectUnknown(data, ["cases"], "response", c);
  if (!Array.isArray(data.cases) || data.cases.length === 0) {
    c.add("response.cases", "invalid_type", '"cases" must be a non-empty array');
    return { ok: false, errors: c.errors };
  }
  if (data.cases.length > maxCases) {
    c.add("response.cases", "too_many", `Model returned more than ${maxCases} cases`);
    return { ok: false, errors: c.errors };
  }

  const cases = [];
  const seenIds = new Set();
  data.cases.forEach((item, i) => {
    const p = `response.cases[${i}]`;
    if (!isPlainObject(item)) return c.add(p, "invalid_type", "case must be an object");
    rejectUnknown(item, ["name", "execution", "intendedScenario"], p, c);
    const name = cleanText(item.name ?? `Generated case ${i + 1}`, { max: 80 });
    if (!name.ok) c.add(`${p}.name`, "invalid_text", `"name" ${name.reason}`);
    if (item.intendedScenario !== undefined && !GENERATION_SCENARIOS.includes(item.intendedScenario)) {
      c.add(`${p}.intendedScenario`, "invalid_scenario", `must be one of ${GENERATION_SCENARIOS.join(", ")}`);
    }
    const ex = validateExecution(item.execution, `${p}.execution`);
    if (!ex.ok) {
      c.errors.push(...ex.errors);
      return undefined;
    }
    const e = ex.value;
    if (e.currency !== undefined && e.currency !== mandate.currency) {
      c.add(`${p}.execution.currency`, "currency_mismatch", `currency must equal the mandate currency ${mandate.currency}`);
    }
    // Force unique, namespaced IDs so AI output cannot collide with stored cases.
    let id = e.caseId === "EXE-ADHOC" ? `EXE-AI-${String(i + 1).padStart(3, "0")}` : e.caseId;
    if (seenIds.has(id)) id = `${id}-${i + 1}`.slice(0, LIMITS.maxIdLength);
    seenIds.add(id);
    if (name.ok) {
      cases.push({
        name: name.value,
        intendedScenario: item.intendedScenario ?? "mixed",
        execution: { ...e, caseId: id, currency: mandate.currency },
      });
    }
    return undefined;
  });
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, cases };
}
