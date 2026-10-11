// Route handlers for the v1 API. Each receives a context and returns
// { status, body }. Records are namespaced per caller (tenant) so one API key
// can never read another key's mandates, executions or audits.

import { ID_PATTERN, GENERATION_SCENARIOS, LIMITS, ENGINE_VERSION, RULESET_VERSION, AUDIT_SCHEMA, EVIDENCE_VALUES } from "../src/engine/constants.js";
import { validateMandate } from "../src/engine/validateMandate.js";
import { validateExecution } from "../src/engine/validateExecution.js";
import { SAMPLE_MANDATE, SAMPLES } from "../src/engine/samples.js";
import { ApiError } from "./http.js";

export const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const ns = (ctx, id) => `${ctx.tenant}:${id}`;

export function requireObject(body) {
  if (!isObj(body)) throw new ApiError(400, "invalid_body", "Request body must be a JSON object.");
  return body;
}

export function validationFailure(errors) {
  return new ApiError(422, "validation_failed", "The request failed validation.", errors);
}

/** Reject top-level fields we do not know (typos, a caller-supplied "verdict", "__proto__"). */
export function rejectUnknownKeys(body, allowed, label = "request") {
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    throw validationFailure(unknown.map((k) => ({ path: `${label}.${k}`, code: "unknown_field", message: `"${k}" is not a recognised field` })));
  }
}

export function checkId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new ApiError(400, "invalid_id", `${label} is not a valid identifier.`);
  }
  return value;
}

function persist(ctx, bucket, id, record, label) {
  const out = ctx.store.putImmutable(bucket, ns(ctx, id), record);
  if (out.status === "conflict") {
    throw new ApiError(409, "conflict", `${label} "${id}" already exists with different content. Records are immutable; use a new id.`);
  }
  return out;
}

export function health(ctx) {
  return {
    status: 200,
    body: {
      status: "ok",
      engineVersion: ENGINE_VERSION,
      rulesetVersion: RULESET_VERSION,
      geminiConfigured: Boolean(ctx.config.gemini.apiKey),
      authRequired: ctx.config.apiKeys.length > 0,
    },
  };
}

export function schema() {
  return {
    status: 200,
    body: {
      engineVersion: ENGINE_VERSION,
      rulesetVersion: RULESET_VERSION,
      auditSchema: AUDIT_SCHEMA,
      scenarios: GENERATION_SCENARIOS,
      evidenceValues: EVIDENCE_VALUES,
      limits: { maxGenerateCount: LIMITS.maxGenerateCount, idPattern: String(ID_PATTERN) },
      mandate: {
        required: ["maxPricePerNight", "allowedMerchants", "refundableRequired", "stayWindow"],
        optional: ["id", "currency", "softConstraints", "signedBy", "signedAt", "signatureHash"],
        example: SAMPLE_MANDATE,
      },
      execution: {
        required: ["merchant", "price", "refundable", "checkIn", "checkOut"],
        optional: ["caseId", "currency", "quietEvidence", "evidence", "softInfo"],
        example: SAMPLES[0].execution,
      },
    },
  };
}

export const samples = () => ({ status: 200, body: { mandate: SAMPLE_MANDATE, samples: SAMPLES } });

/** Accept either `{ mandate: {...} }` or the bare mandate object. */
function unwrap(body, key) {
  const b = requireObject(body);
  if (isObj(b[key])) {
    rejectUnknownKeys(b, [key]); // wrapper form carries nothing but the record
    return b[key];
  }
  return b;
}

export function createMandate(ctx, body) {
  const raw = unwrap(body, "mandate");
  if (typeof raw.id !== "string") {
    throw validationFailure([{ path: "mandate.id", code: "required", message: '"id" is required to store a mandate' }]);
  }
  const v = validateMandate(raw);
  if (!v.ok) throw validationFailure(v.errors);
  const out = persist(ctx, ctx.store.mandates, v.value.id, v.value, "Mandate");
  return { status: out.status === "created" ? 201 : 200, body: { mandate: out.record, replayed: out.status === "replayed" } };
}

export function createExecution(ctx, body) {
  const raw = unwrap(body, "execution");
  if (typeof raw.caseId !== "string") {
    throw validationFailure([{ path: "execution.caseId", code: "required", message: '"caseId" is required to store an execution' }]);
  }
  const v = validateExecution(raw);
  if (!v.ok) throw validationFailure(v.errors);
  const out = persist(ctx, ctx.store.executions, v.value.caseId, v.value, "Execution");
  return { status: out.status === "created" ? 201 : 200, body: { execution: out.record, replayed: out.status === "replayed" } };
}
