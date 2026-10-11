# Adjudex

> **The control plane for AI agents that spend money.**

AI agents are moving from recommending products to booking travel, paying
invoices, purchasing goods, and creating recurring commitments. The difficult
question is no longer only whether an agent can click **Pay**:

> **Was the completed action within the authority the principal granted?**

Adjudex answers that question with a versioned, deterministic, auditable
policy engine.

```text
Mandate + proposed/actual execution + evidence
                    ↓
          independent policy evaluation
                    ↓
       ALLOW · DENY · HUMAN REVIEW
                    ↓
             immutable audit trail
```

## What Adjudex is

Adjudex is a vendor-neutral **authorization-verification and audit layer** for
agent-initiated commerce and financial workflows.

It compares:

- **Mandate** — what the principal authorized.
- **Execution** — what the agent actually did.
- **Evidence** — what proves or contradicts the constraints.

It produces three honest outcomes:

| Verdict | Meaning | Operational result |
| --- | --- | --- |
| `IN_MANDATE` | Every rule is satisfied | Automatically acceptable |
| `OUT_OF_MANDATE` | One or more rules are breached | Policy-defined responsibility; dispute escalation |
| `AMBIGUOUS_UNVERIFIABLE` | The action is not proven wrong, but evidence is insufficient | Abstain and route to human review |

The engine follows a strict precedence:

```text
breach > unverifiable > in mandate
```

It never guesses when a rule cannot be safely checked.

## Why this problem is real

Agentic commerce is moving into controlled live transactions. Visa reported
hundreds of agent-initiated transactions with ecosystem partners and described
work on trusted-agent identity, payment controls, and merchant acceptance for
agent-driven purchasing:

- [Visa Intelligent Commerce and agent-initiated transactions](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.21961.html)

The security problem is broader than payments. OWASP identifies excessive
agency, tool misuse, privilege abuse, goal hijacking, and cascading failures as
important risks for systems that let AI agents take external actions:

- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

Public incident reporting has also described an AI shopping agent completing a
purchase when the user intended comparison or research. This type of report
should be treated as an incident signal rather than a universal statistical
claim:

- [Incident Database: reported Operator unauthorized purchase](https://incidentdatabase.ai/cite/1028/)

These signals point to the same unresolved gap:

```text
Payment rail: Can this agent attempt the transaction?
Adjudex:      Did the completed transaction stay within the mandate?
```

## Where Adjudex fits

Adjudex complements payment networks, fraud systems, agent frameworks, and
approval tools. It is not a replacement for them.

```text
Principal mandate
        ↓
Pre-transaction policy gate
        ↓
Agent execution
        ↓
Payment authorization and fraud controls
        ↓
Adjudex post-execution verification
        ↓
Audit record or human dispute workflow
```

The current prototype demonstrates the post-execution verification layer. The
next product expansion is a pre-authorization decision:

```text
ALLOW · DENY · REQUIRE_HUMAN_APPROVAL
```

followed by a proposed-versus-actual diff after execution.

## Current demo

The live prototype uses a hotel-booking mandate to make the idea concrete:

```text
Maximum: ₹8,000 per night
Merchants: OYO, Taj Bookings, MakeMyTrip
Refundable booking required
Stay window: 2026-11-14 → 2026-11-16
Soft requirement: a quiet room
```

It demonstrates:

- Clean compliant execution → `IN_MANDATE`.
- Price, merchant, refundability, or date breach → `OUT_OF_MANDATE`.
- Missing or vague soft evidence → `AMBIGUOUS_UNVERIFIABLE`.
- Constraint-by-constraint explanations.
- Mandate checkability scoring.
- Suggested fixes for vague mandates.
- Deterministic local random-case generation.
- Optional server-side Gemini generation.
- Audit JSON, verdict IDs, input hashes, and engine/ruleset versions.

Live demo: [adjudex.netlify.app](https://adjudex.netlify.app/)

The public Netlify demo currently runs the browser-local engine and deterministic
fallback generator. That is intentional: the core adjudication path does not
depend on a network or a model.

For the three-minute presentation, see [docs/DEMO.md](docs/DEMO.md).

## AI boundary

Gemini may draft realistic demo executions or help structure evidence. Gemini
does **not** decide:

- The final verdict.
- Liability.
- Whether a mandate was legally sufficient.

The safe flow is:

```text
Gemini draft
    ↓
Strict schema and domain validation
    ↓
Deterministic Adjudex evaluation
    ↓
Auditable verdict
```

Invalid, unsafe, unavailable, or timed-out model output is rejected or replaced
by a clearly labelled local fallback. API keys are server-side only.

## Quick start

Requirements:

- Node.js `20.12+`
- npm

```bash
npm install
npm run dev:all
```

Open `http://localhost:5173`.

This starts:

- Web app: `http://localhost:5173`
- API server: `http://127.0.0.1:8787`

Browser-only mode:

```bash
npm run dev
```

Verification:

```bash
npm test
npm run build
```

## Gemini configuration

Gemini is optional and is used only for demo-case generation:

```text
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=15000
```

Copy `.env.example` to `.env`, set the key, and restart the server. Never use a
`VITE_` prefix, put the key in frontend code, or commit `.env`.

Without a key, the local generator keeps the demo working and reports the
fallback explicitly.

## API

The full API contract is documented in [docs/API.md](docs/API.md).

```text
GET  /api/health
GET  /api/v1/schema
GET  /api/v1/samples
POST /api/v1/mandates
POST /api/v1/executions
POST /api/v1/adjudications
GET  /api/v1/adjudications/:verdictId
GET  /api/v1/cases/:caseId
POST /api/demo/generate-case
```

The framework-independent engine can also be imported directly:

```js
import { adjudicate } from "./src/engine/index.js";

const result = adjudicate(mandate, execution);
```

## Safety and reliability

- Money is normalised to integer minor units.
- Dates are validated as real ISO calendar dates.
- Unknown fields are rejected.
- Incomplete data causes affected rules to abstain.
- Identical adjudications are idempotent.
- Generated model output is schema-validated.
- Verdicts are never accepted from a model.
- API bodies, request IDs, origins, and rate limits are bounded.
- Secrets remain server-side.
- Audit records include engine and ruleset versions.

## Product boundary

Adjudex does not currently:

- Determine legally binding liability.
- Stop or reverse a payment by itself.
- Prove a mandate's cryptographic authenticity.
- Replace payment-network fraud controls.
- Independently verify every merchant claim.
- Detect every prompt-injection or tool-compromise event.
- Provide durable multi-tenant production storage.

The product assigns responsibility according to configured policy and evidence.
Legal, financial, and operational decisions remain subject to the deploying
organization's controls and applicable law.

## Product roadmap

The highest-value next capabilities are:

1. Generic transaction and commitment policies beyond travel.
2. Pre-authorization gates: `ALLOW`, `DENY`, `HUMAN_APPROVAL`.
3. Proposed-versus-actual execution diffs.
4. Evidence provenance, source references, timestamps, and hashes.
5. Agent identity, provider, version, principal, and delegated scope.
6. Idempotency, duplicate-action, retry, refund, and subscription handling.
7. Durable immutable storage, authentication, tenant isolation, and review queues.
8. Merchant, receipt, invoice, travel, cloud, and payment integrations.

## Project layout

```text
src/engine/       Framework-independent validation and adjudication
src/api/           API client and browser API implementation
src/components/   Demo UI components
server/           Node HTTP API and optional Gemini integration
docs/API.md       HTTP API reference and deployment boundary
docs/DEMO.md      Hackathon presentation runbook
```

## Deployment

The frontend is deployable to Netlify with:

```text
Build command: npm run build
Publish directory: dist
```

The current Node API is suitable for local or separately hosted deployment.
Netlify will host the frontend, but a full hosted API requires adapting the
routes to Netlify Functions or deploying the Node API separately. Persistent
production use also requires replacing the bounded in-memory store with a
database and adding real authentication and tenant authorization.
