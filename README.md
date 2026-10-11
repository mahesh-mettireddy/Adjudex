# Adjudex

> A deterministic control and audit layer for AI agents that spend money.

Adjudex compares what a principal authorised (the **mandate**) with what an AI
agent actually did (the **execution**). It returns an explainable verdict:

```text
Mandate + execution + evidence
              ↓
     deterministic rule engine
              ↓
  compliant · breach · safe abstention
```

Gemini can generate realistic demo cases, but it never decides the verdict.
Every verdict is computed by the deterministic Adjudex engine.

## Demo-ready capabilities

- Clean, breach, ambiguous, and contradictory-evidence scenarios.
- One-click Gemini random-case generation.
- Deterministic local fallback when Gemini is unavailable.
- Hard constraints for price, merchant, refundability, and stay dates.
- Evidence-driven soft constraints with safe abstention.
- Mandate checkability scoring and suggested mandate improvements.
- Constraint-by-constraint reality diff.
- Verdict IDs, input hashes, engine/ruleset versions, and audit JSON.
- Browser-local mode and server/API mode using the same engine contract.
- 107 automated tests, a production build, and a black-box API probe.

## Quick start

Requirements:

- Node.js `20.12+`
- npm

```bash
npm install
npm run dev:all
```

Open `http://localhost:5173`.

`npm run dev:all` starts:

- Web app: `http://localhost:5173`
- API server: `http://127.0.0.1:8787`

The Vite development server proxies `/api` requests to the API server.

### Browser-only mode

To run without the API server:

```bash
npm run dev
```

The app runs in Local mode. The built-in scenarios and local deterministic
generator continue to work without network access.

### Verify the project

```bash
npm test
npm run build
```

With the API running, `node scripts/probe.mjs http://127.0.0.1:8787 [keyA] [keyB]` runs about 30 black-box checks
(auth, hostile input, idempotency, immutability, tenant isolation) and exits non-zero on any failure.

For the recommended live presentation flow, see
[docs/DEMO.md](docs/DEMO.md).

## Gemini demo generation

Gemini is used only for generating random demonstration executions. The API
key is read by the Node server and is never bundled into the browser.

1. Copy `.env.example` to `.env`.
2. Set `GEMINI_API_KEY=your-key`.
3. Optionally set `GEMINI_MODEL` and `GEMINI_TIMEOUT_MS`.
4. Restart `npm run dev:all`.
5. Confirm the server log says `Gemini: enabled`.

```text
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=15000
```

Without a key, `/api/demo/generate-case` uses the deterministic local
generator and clearly reports the fallback in `generation.fallback`.

Never:

- Put the key in `App.jsx`.
- Use a `VITE_` prefix for the key.
- Commit `.env`.
- Treat Gemini output as a verdict.

## Verdict model

| Verdict | Meaning | Liability |
| --- | --- | --- |
| `IN_MANDATE` | Every constraint is satisfied | `none` |
| `OUT_OF_MANDATE` | At least one constraint is breached | `agent_provider` |
| `AMBIGUOUS_UNVERIFIABLE` | No breach is proven, but evidence is insufficient | `unassigned` / human review |

Precedence is deterministic:

```text
breach > unverifiable > in mandate
```

The engine abstains rather than guessing when it cannot safely compare data,
for example when a soft constraint has no evidence or currencies do not match.

## API and library usage

The API reference is in [docs/API.md](docs/API.md).

Core endpoints:

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

The engine can also be used without a server:

```js
import { adjudicate } from "./src/engine/index.js";

const result = adjudicate(mandate, execution);
```

The dependency-free JavaScript API client is in
[src/api/client.js](src/api/client.js).

## Safety and reliability

- Money is normalised to integer minor units before comparison.
- Dates are validated as real ISO calendar dates.
- Unknown fields are rejected.
- Malformed or incomplete data causes affected rules to abstain.
- Repeated identical adjudications are idempotent.
- Gemini output is schema-validated before use.
- Gemini cannot supply a verdict or liability decision.
- Invalid, unsafe, unavailable, or timed-out Gemini output falls back locally.
- API bodies, request IDs, origins, and rate limits are bounded.
- Secrets are server-side only.

## Project layout

```text
src/engine/       Framework-independent validation and adjudication engine
src/api/           API client and browser API implementation
src/components/   Demo UI components
src/App.jsx       Application composition and demo state
server/           Dependency-free Node HTTP API and Gemini integration
docs/API.md       HTTP API reference and production notes
docs/DEMO.md      Hackathon/demo presentation runbook
recommendations.md Product and production roadmap
```

## Deploy

### Web app

```bash
npm run build
npx firebase-tools deploy --only hosting
```

`firebase.json` serves `dist/` with an SPA rewrite.

### API

Run the API on a server or Cloud Run-style runtime:

```bash
npm run server
```

Before exposing it publicly:

- Set `ADJUDEX_API_KEYS`.
- Set a strict `ALLOWED_ORIGINS` list.
- Run behind TLS.
- Use a persistent database instead of `server/store.js`.
- Add real user authentication and tenant authorization.

## Known limitations

The current project is demo/API ready, not a complete multi-tenant production
platform:

- The store is bounded in memory and is lost on restart.
- There are no user accounts or durable tenant identities.
- API keys are not a replacement for user authentication.
- Merchant and evidence connectors are simulated.
- Gemini is currently used for demo-case generation, not final adjudication.

See the production roadmap in
[recommendations.md](recommendations.md) and the API production notes in
[docs/API.md](docs/API.md).
