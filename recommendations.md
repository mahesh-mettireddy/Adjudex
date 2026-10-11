# Adjudex Production Recommendations

## Purpose

Adjudex should remain a small, trustworthy adjudication product:

```text
Mandate + execution + evidence
        ↓
Deterministic rule engine
        ↓
Auditable verdict or safe abstention
```

Gemini should assist with demo generation and evidence extraction, but it should
not decide the final liability verdict. The final verdict must remain
deterministic, reproducible, and explainable.

## Immediate goal

For the website prototype, prioritize:

1. A loud, clear first-screen verdict.
2. Ready-to-use sample JSON cases.
3. Gemini-powered random test-case generation.
4. A visible explanation of why a case passed, breached, or was abstained.
5. A clean boundary between AI assistance and deterministic adjudication.

## Gemini integration for random demo cases

### Recommended request flow

Do not place the Gemini API key in browser code. A frontend-exposed key can be
read by anyone using the website and can be abused.

Use this flow instead:

```text
React demo
    ↓ POST /api/demo/generate-case
Small server-side proxy
    ↓ Gemini API using GEMINI_API_KEY
Structured JSON response
    ↓ schema validation
Deterministic Adjudex evaluator
    ↓
Verdict displayed in the UI
```

For a temporary local prototype, a small Vite development proxy or local API
route can call Gemini. Before publishing the website, move that call to a
server-side function such as a serverless function, Cloud Run service, or small
Node.js API.

### Environment configuration

Use an environment variable on the server:

```text
GEMINI_API_KEY=replace-with-server-side-secret
GEMINI_MODEL=gemini-2.5-flash
```

Never:

- Commit the key to Git.
- Put the key in `VITE_*` variables.
- Put the key in `App.jsx`.
- Return the key from an API response.
- Allow arbitrary user prompts to be forwarded without limits.

Add `.env`, `.env.*`, and local secret files to `.gitignore` if they are not
already ignored.

### Generation API contract

Recommended endpoint:

```http
POST /api/demo/generate-case
Content-Type: application/json
```

Request:

```json
{
  "scenario": "mixed",
  "count": 3,
  "mandate": {
    "currency": "INR",
    "maxPricePerNight": 8000,
    "allowedMerchants": ["OYO", "Taj Bookings", "MakeMyTrip"],
    "refundableRequired": true,
    "stayWindow": {
      "checkIn": "2026-11-14",
      "checkOut": "2026-11-16"
    },
    "softConstraints": [
      {
        "key": "quietRoom",
        "label": "a quiet room"
      }
    ]
  }
}
```

Supported scenario values should be deliberately limited:

```text
clean
price_breach
merchant_breach
refundability_breach
date_breach
soft_contradiction
soft_missing_evidence
multiple_breaches
mixed
```

The server should clamp `count` to a small maximum such as 10.

### Gemini output contract

Ask Gemini to return JSON only, with no Markdown and no additional fields:

```json
{
  "cases": [
    {
      "name": "Missing quiet-room evidence",
      "execution": {
        "caseId": "EXE-AI-001",
        "merchant": "OYO",
        "price": 7200,
        "currency": "INR",
        "refundable": true,
        "checkIn": "2026-11-14",
        "checkOut": "2026-11-16",
        "quietEvidence": "absent",
        "softInfo": "The listing does not mention noise or room location."
      },
      "intendedScenario": "soft_missing_evidence"
    }
  ]
}
```

The server must validate every generated case before returning it. Validation
should check:

- The response is valid JSON.
- The response has a `cases` array.
- Each case has an execution object.
- Merchant is a non-empty string.
- Price is a finite non-negative number.
- Currency matches the mandate.
- Refundability is boolean.
- Dates are valid ISO dates.
- `checkIn` is not after `checkOut`.
- `quietEvidence` is one of `verified`, `contradicted`, or `absent`.
- The case does not contain unexpected executable content.

After validation, run the normal deterministic evaluator. Do not ask Gemini for
the final verdict. Derive the displayed verdict from the evaluator.

## Prompt design

Use a narrow, versioned server-side prompt. The prompt should tell Gemini to
generate realistic execution data, not legal conclusions.

Example:

```text
You generate demonstration booking executions for Adjudex.

Return JSON only. Follow the supplied schema exactly.
Do not return liability, legal advice, or a final verdict.
Generate cases that illustrate the requested scenario:
clean, price_breach, merchant_breach, refundability_breach,
date_breach, soft_contradiction, soft_missing_evidence,
multiple_breaches, or mixed.

Use only the supplied mandate fields. Keep prices, dates, merchants, and
evidence realistic. For a missing-evidence case, use quietEvidence "absent".
For a contradiction, use quietEvidence "contradicted". For a clean case,
make every constraint satisfy the mandate.
```

Store a prompt version with generated demo metadata:

```json
{
  "generator": "gemini",
  "model": "gemini-2.5-flash",
  "promptVersion": "demo-case-v1",
  "generatedAt": "2026-10-11T09:00:00Z"
}
```

## Fallback behavior

Gemini must not be a single point of failure for the demo.

If the API is unavailable, rate-limited, or returns invalid JSON:

1. Show a clear non-blocking error.
2. Keep the built-in Clean, Breach, and Ambiguous cases available.
3. Offer a deterministic local random-case generator as fallback.
4. Never show a success-shaped fake AI result.

The local generator should use the same execution schema and deterministic
evaluator as AI-generated cases.

## Sample JSON library

The website should provide one-click sample buttons:

- Load clean case
- Load price breach
- Load merchant breach
- Load ambiguous case
- Load contradictory evidence
- Generate random case

### Clean case

```json
{
  "caseId": "EXE-SAMPLE-CLEAN",
  "merchant": "OYO",
  "price": 7200,
  "currency": "INR",
  "refundable": true,
  "checkIn": "2026-11-14",
  "checkOut": "2026-11-16",
  "quietEvidence": "verified",
  "softInfo": "Quiet room verified by listing metadata."
}
```

### Hard breach

```json
{
  "caseId": "EXE-SAMPLE-BREACH",
  "merchant": "Gucci Hotels",
  "price": 11500,
  "currency": "INR",
  "refundable": false,
  "checkIn": "2026-11-14",
  "checkOut": "2026-11-16",
  "quietEvidence": "absent",
  "softInfo": "Room is 350m from the venue."
}
```

### Ambiguous case

```json
{
  "caseId": "EXE-SAMPLE-AMBIGUOUS",
  "merchant": "OYO",
  "price": 7200,
  "currency": "INR",
  "refundable": true,
  "checkIn": "2026-11-14",
  "checkOut": "2026-11-16",
  "quietEvidence": "absent",
  "softInfo": "The listing never mentions noise or room location."
}
```

### Contradictory evidence

```json
{
  "caseId": "EXE-SAMPLE-CONTRADICTED",
  "merchant": "MakeMyTrip",
  "price": 7800,
  "currency": "INR",
  "refundable": true,
  "checkIn": "2026-11-14",
  "checkOut": "2026-11-16",
  "quietEvidence": "contradicted",
  "softInfo": "Guest reviews mention loud construction next door."
}
```

## Current implementation status

The following recommendations are already implemented:

- Framework-independent deterministic engine in `src/engine/`.
- Shared validation and sample execution schemas.
- Deterministic local random-case generator.
- Server-side Gemini demo endpoint.
- Structured Gemini output and strict validation.
- Deterministic re-evaluation of every generated case.
- Visible local fallback when Gemini is unavailable.
- API request validation, rate limits, CORS, request IDs, and optional API keys.
- Verdict IDs, input hashes, engine/ruleset versions, and audit records.
- Browser-local mode and server/API mode.
- Automated engine, API, Gemini, demo, storage, and UI tests.

The project is therefore ready for a hackathon or technical product demo.
Use [docs/DEMO.md](docs/DEMO.md) for the presentation sequence.

## Production architecture, kept small

### Completed: polished website demo

- The deterministic engine is available in framework-independent modules and in
  the browser.
- Sample JSON fixtures and one-click case loading are available.
- A deterministic local generator is available.
- A server-side Gemini demo endpoint is available.
- AI generation metadata and fallback status are returned separately.
- Loading, error, and fallback states are shown in the demo UI.

### Completed: small real API

The current backend provides:

```text
POST /api/v1/mandates
POST /api/v1/executions
POST /api/v1/adjudications
GET  /api/v1/cases/:caseId
POST /api/demo/generate-case
```

The frontend can run against the same engine contract locally or through the
HTTP API. Production deployments should treat the server as the authority.

### Next: persistence and identity

Persist in a database:

- Mandate snapshot.
- Execution snapshot.
- Evidence.
- Constraint results.
- Verdict and liability code.
- Engine version.
- Ruleset version.
- Evaluation timestamp.
- Input hash.
- AI generation metadata, when applicable.

Historical verdicts must remain explainable even after rules change.

## UI recommendations for a loud, clean demo

The first screen should communicate the product in seconds.

### Hero

Use a direct headline:

```text
When an AI spends money,
who is liable?
```

Supporting copy:

```text
Adjudex compares the signed mandate with the actual execution,
explains every rule, and abstains when evidence is insufficient.
```

Primary actions:

```text
Run clean case
Try a breach
Generate random case
```

### Verdict-first layout

Make the verdict the largest element:

```text
IN MANDATE
Liability: None
4/4 rules satisfied
```

Use consistent semantic colors:

- Green: compliant.
- Red: breach.
- Amber: abstain / human review.

Show the technical verdict code beneath the friendly label rather than making
users decode `AMBIGUOUS_UNVERIFIABLE`.

### Progressive disclosure

Default view:

- Verdict.
- One-sentence explanation.
- Constraint summary.
- Primary action.

Expanded view:

- Mandate versus execution details.
- Evidence text and source.
- Suggested mandate fix.
- Verdict ID.
- Engine version.
- Raw audit JSON.

### Demo mode

Add a clearly marked `Demo mode` with:

- No login requirement.
- Sample case buttons.
- Gemini random generation.
- Deterministic fallback generation.
- Copy/download audit JSON.
- A short animated evaluation sequence.

Do not expose backend configuration or secret-management details in the public
demo.

## Trust and security requirements

Before describing the product as production-ready:

- Validate all inputs on the server.
- Authenticate access to real mandates and cases.
- Authorize users by tenant or organization.
- Apply rate limits to Gemini generation.
- Keep API keys server-side.
- Redact sensitive data before AI calls.
- Record AI model, prompt version, latency, and validation outcome.
- Version the adjudication engine.
- Store immutable audit snapshots.
- Provide explicit human-review handling for abstentions.

## Recommended next implementation order

1. Replace the bounded in-memory store with PostgreSQL or equivalent.
2. Add real user authentication and tenant authorization.
3. Add immutable audit persistence and retention controls.
4. Add production observability and alerting.
5. Add real merchant/evidence connectors.
6. Add human-review workflow for abstentions.
7. Add AI evidence extraction only behind strict schemas and review policies.

## Product boundary

Adjudex should be presented as:

> A deterministic control and audit layer for AI agents that spend money.

It should not be presented as an AI that independently decides legal liability.
AI can generate scenarios and structure evidence; Adjudex applies the published
rules and clearly abstains when those rules or evidence are insufficient.
