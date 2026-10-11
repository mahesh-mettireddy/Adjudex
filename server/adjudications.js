// Adjudication + case lookup handlers.

import { validateMandate } from "../src/engine/validateMandate.js";
import { validateExecution } from "../src/engine/validateExecution.js";
import { adjudicateValidated } from "../src/engine/adjudicate.js";
import { ApiError } from "./http.js";
import { ns, checkId, requireObject, validationFailure, rejectUnknownKeys } from "./handlers.js";

function resolveInputs(ctx, input) {
  rejectUnknownKeys(input, ["mandate", "execution", "mandateId", "executionId"]);
  const hasRefs = input.mandateId !== undefined || input.executionId !== undefined;
  const hasInline = input.mandate !== undefined || input.execution !== undefined;
  if (hasRefs && hasInline) {
    throw new ApiError(400, "ambiguous_request", "Provide either {mandateId, executionId} or {mandate, execution}, not both.");
  }
  if (!hasRefs && !hasInline) {
    throw new ApiError(400, "invalid_body", "Provide {mandateId, executionId} or inline {mandate, execution}.");
  }
  if (hasRefs) {
    const mandateId = checkId(input.mandateId, "mandateId");
    const executionId = checkId(input.executionId, "executionId");
    const mandate = ctx.store.mandates.get(ns(ctx, mandateId));
    const execution = ctx.store.executions.get(ns(ctx, executionId));
    if (!mandate) throw new ApiError(404, "mandate_not_found", `Mandate "${mandateId}" was not found.`);
    if (!execution) throw new ApiError(404, "execution_not_found", `Execution "${executionId}" was not found.`);
    return { mandate, execution };
  }
  const m = validateMandate(input.mandate);
  const e = validateExecution(input.execution);
  const errors = [...(m.ok ? [] : m.errors), ...(e.ok ? [] : e.errors)];
  if (errors.length) throw validationFailure(errors);
  return { mandate: m.value, execution: e.value };
}

/**
 * Adjudicate stored records ({mandateId, executionId}) or inline
 * ({mandate, execution}). Idempotent: identical inputs return the stored audit
 * with `replayed: true` and never create a duplicate.
 */
export function createAdjudication(ctx, body) {
  const { mandate, execution } = resolveInputs(ctx, requireObject(body));
  const audit = adjudicateValidated(mandate, execution, { now: ctx.now() });
  const key = ns(ctx, audit.verdictId);
  const existing = ctx.store.audits.get(key);
  if (existing) return { status: 200, body: { audit: existing, replayed: true } };
  ctx.store.audits.set(key, audit);
  return { status: 201, body: { audit, replayed: false } };
}

export function getAudit(ctx, verdictId) {
  const audit = ctx.store.audits.get(ns(ctx, checkId(verdictId, "verdictId")));
  if (!audit) throw new ApiError(404, "audit_not_found", `Adjudication "${verdictId}" was not found.`);
  return { status: 200, body: { audit } };
}

export function getCase(ctx, caseId) {
  const id = checkId(caseId, "caseId");
  const execution = ctx.store.executions.get(ns(ctx, id));
  if (!execution) throw new ApiError(404, "case_not_found", `Case "${id}" was not found.`);
  return { status: 200, body: { caseId: id, execution, audits: ctx.store.auditsForExecution(ctx.tenant, id) } };
}
