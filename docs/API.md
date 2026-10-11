# Adjudex API

A small JSON-over-HTTP API in front of the deterministic adjudication engine.
Send a **mandate** (what the principal authorised) and an **execution** (what
the agent actually did), then receive an auditable verdict or a calibrated
abstention when evidence is insufficient.

This API is the post-execution verification layer in a broader agentic-commerce
authorization workflow. It complements payment authorization and fraud systems; it does
not itself determine legally binding liability, reverse payments, or replace
merchant and network controls.

Base URL (local): `http://127.0.0.1:8787` (`npm run server`). In `npm run dev` the Vite proxy forwards `/api` there.

## Conventions

| Topic | Rule |
| --- | --- |
| Format | `Content-Type: application/json` on every POST (else `415`). Bodies are capped (`MAX_BODY_BYTES`, default 64 KiB, else `413`). |
| Auth | If the server sets `ADJUDEX_API_KEYS`, `/api/v1/mandates`, `/executions`, `/adjudications` and `/cases` need `Authorization: Bearer <key>` or `X-API-Key: <key>`. Health, schema, samples and the demo endpoint are public. |
| Tenancy | Stored records are namespaced per API key: one key can never read another's records. |
| Request ID | Send `X-Request-Id` (8-64 chars `A-Za-z0-9._-`) or one is generated. Every response, including errors, returns it. |
| Rate limits | Per key (or client address): `RATE_LIMIT_PER_MIN` (120). Demo endpoint: `DEMO_RATE_LIMIT_PER_MIN` (10). `429` carries `Retry-After`. Repeated bad keys are throttled separately. |
| CORS | Browsers are allowed only from origins listed in `ALLOWED_ORIGINS`. |
| Money | JSON numbers or decimal strings with at most 2 decimals. Compared as integer minor units; normalised output is a string such as `"7200.00"`. |
| Dates | Real calendar dates, `YYYY-MM-DD`. Inclusive window comparison. |
| Unknown fields | Rejected (`422`), so typos cannot silently change a verdict. |

## Errors

Every failure has the same envelope:

```json
{ "error": { "code": "validation_failed", "message": "The request failed validation.", "requestId": "…",
             "details": [{ "path": "execution.price", "code": "invalid_money", "message": "\"price\" must not be negative" }] } }
```

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_json`, `empty_body`, `invalid_body`, `invalid_id`, `ambiguous_request` | Malformed request |
| 401 | `unauthorized` | Missing or invalid API key |
| 404 | `not_found`, `mandate_not_found`, `execution_not_found`, `audit_not_found`, `case_not_found` | Unknown route or record |
| 405 | `method_not_allowed` | Wrong method for the path |
| 409 | `conflict` | Same id already stored with different content (records are immutable) |
| 413 / 415 | `payload_too_large`, `unsupported_media_type` | Body problems |
| 422 | `validation_failed` | Semantic validation; `details` lists every problem with a path |
| 429 | `rate_limited` | Slow down; see `Retry-After` |
| 500 | `internal_error` | Generic. Internals are never leaked. |

## Discovery endpoints

- `GET /api/health` returns `{ status, engineVersion, rulesetVersion, geminiConfigured, authRequired }`.
- `GET /api/v1/schema` returns field lists, limits, scenarios and examples.
- `GET /api/v1/samples` returns the sample mandate and ready-to-use executions (clean, breach, merchant breach,
  ambiguous, contradicted).

## `POST /api/v1/adjudications`: judge a case (the core call)

Inline form (stateless; nothing needs to be stored first):

```bash
curl -sS -X POST http://127.0.0.1:8787/api/v1/adjudications \
  -H 'Content-Type: application/json' \
  -d '{
    "mandate": {
      "id": "MND-1", "currency": "INR", "maxPricePerNight": 8000,
      "allowedMerchants": ["OYO", "Taj Bookings"], "refundableRequired": true,
      "stayWindow": { "checkIn": "2026-11-14", "checkOut": "2026-11-16" },
      "softConstraints": [{ "key": "quietRoom", "label": "a quiet room" }]
    },
    "execution": {
      "caseId": "EXE-1", "merchant": "OYO", "price": 7200, "currency": "INR", "refundable": true,
      "checkIn": "2026-11-14", "checkOut": "2026-11-16",
      "evidence": { "quietRoom": "verified" }
    }
  }'
```

By reference (after storing both records): `{ "mandateId": "MND-1", "executionId": "EXE-1" }`. Mixing the two forms is a
`400 ambiguous_request`.

Response: `201` the first time, `200` with `"replayed": true` for an identical repeat.

```json
{ "replayed": false,
  "audit": {
    "schema": "adjudex.audit.v1", "verdictId": "VRD-76ee17db70605f39",
    "engineVersion": "1.2.0", "rulesetVersion": "ruleset-2026.10.1",
    "inputHash": "<sha256>", "evaluatedAt": "2026-10-11T09:00:00.000Z", "latencyMs": 0.4,
    "verdict": "IN_MANDATE", "liabilityCode": "none", "liability": "None",
    "explanation": "In mandate: all 5 rules are satisfied. No liability.",
    "summary": { "met": 5, "total": 5 },
    "constraints": [{ "key": "price", "ctype": "price_cap", "type": "hard", "status": "MET",
                      "expected": "≤ ₹8,000", "actual": "₹7,200", "detail": "…" }],
    "mandate": {}, "execution": {} } }
```

### Verdicts

Precedence: any breach, then any unverifiable, then in mandate.

| `verdict` | `liabilityCode` | Meaning |
| --- | --- | --- |
| `IN_MANDATE` | `none` | Every rule is satisfied |
| `OUT_OF_MANDATE` | `agent_provider` | At least one rule is breached |
| `AMBIGUOUS_UNVERIFIABLE` | `unassigned` | No breach, but a rule cannot be checked; route to human review |

**Safe abstention.** The engine never guesses. A rule returns `UNVERIFIABLE` (not met, not breached) when its inputs
cannot be compared: a different currency than the mandate (no FX rate is assumed), or a soft constraint with no
evidence.

**Idempotency.** `verdictId` is derived from a SHA-256 of the normalised mandate, execution and ruleset version.
Re-submitting identical content returns the stored audit with `replayed: true`; it never creates a duplicate.

**Soft-constraint evidence.** Provide `evidence: { "<constraintKey>": "verified" | "contradicted" | "absent" }`.
`quietEvidence` is accepted as shorthand for `evidence.quietRoom`. A missing entry means `absent`, so the clause
abstains.

## Stored records

| Call | Notes |
| --- | --- |
| `POST /api/v1/mandates` | Body `{ "mandate": {…} }` or the bare mandate. `id` is required. `201` new, `200` identical replay, `409` different content. |
| `POST /api/v1/executions` | Same pattern; `caseId` is required. |
| `GET /api/v1/adjudications/:verdictId` | Returns the stored audit. |
| `GET /api/v1/cases/:caseId` | The stored execution and every adjudication of it. |

Stores are in memory and bounded (`MAX_STORE_ENTRIES`, oldest evicted). See "Production" below.

## `POST /api/demo/generate-case`: random demo cases

```json
{ "scenario": "mixed", "count": 3, "mandate": {}, "forceLocal": false }
```

`scenario`: `clean`, `price_breach`, `merchant_breach`, `refundability_breach`, `date_breach`, `soft_contradiction`,
`soft_missing_evidence`, `multiple_breaches`, `mixed`. `count` is clamped to 10. `mandate` defaults to the sample.

Response: `{ mandate, generation, cases: [{ name, intendedScenario, intentMatched, execution, audit }] }`.

`intentMatched` is `true` when the engine's verdict is what `intendedScenario` should produce, `false` when the
generator missed its target (the engine verdict is still authoritative), and `null` for `mixed`.

- `generation` is `{ generator: "gemini" | "local", model, promptVersion, generatedAt, latencyMs?, validation, fallback }`.
- `fallback` is `null` for a genuine Gemini result, otherwise `{ used: true, reason, message }` where `reason` is one of
  `unavailable`, `timeout`, `upstream`, `invalid_output`, `requested`. A fallback is never dressed up as AI output.
- Gemini only drafts executions. Its output is validated like any user input (unknown fields, a model-supplied verdict,
  a wrong currency, bad dates and too many cases all cause rejection), and `audit.verdict` is always computed by the
  deterministic engine. Only constraint data is sent to the model; ids and signatures are redacted.

## Using it from JavaScript

`src/api/client.js` is a dependency-free client that never throws:

```js
import { createApiClient } from "./src/api/client.js";
const api = createApiClient({ baseUrl: "http://127.0.0.1:8787", apiKey: process.env.ADJUDEX_API_KEY });
const res = await api.adjudicate({ mandate, execution });
if (res.ok) console.log(res.data.audit.verdict);
else console.error(res.error.code, res.error.details);
```

Or use the engine directly with no server: `import { adjudicate } from "./src/engine/index.js"`.

## Demo versus production

The current server is suitable for a hackathon demo and controlled integration
testing. It is intentionally dependency-free and stores records in bounded
memory.

Before exposing it to real users:

1. Set `ADJUDEX_API_KEYS` and a strict `ALLOWED_ORIGINS` list.
2. Run it behind TLS. Set `TRUST_PROXY=1` only behind a proxy you control.
3. Replace the in-memory `server/store.js` with persistent storage.
4. Keep mandate, execution, evidence, and audit snapshots immutable.
5. Add user authentication and tenant-level authorization.
6. Add production observability for latency, errors, rate limits, and Gemini
   generation outcomes.
7. Redact sensitive data before sending anything to an external model.

The Gemini integration is for demo-case generation only. The model output is
untrusted, validated, and passed to the deterministic engine. It cannot supply
the final verdict or liability code.
