// Request pipeline: request id -> CORS -> routing -> auth -> rate limit ->
// handler -> JSON response. Exposes a plain (req, res) listener so tests can
// run it on an ephemeral port with an injected clock and fetch.

import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { ApiError, corsHeaders, readJsonBody, requestIdFor, sendError, sendJson } from "./http.js";
import { RateLimiter, authenticate, clientAddress } from "./security.js";
import { Store } from "./store.js";
import * as core from "./handlers.js";
import * as adj from "./adjudications.js";
import { generateCase } from "./demo.js";

const ID = "([^/]+)";
const AUTH_FAILURES_PER_MIN = 20;

// method, path pattern, handler, flags
const ROUTES = [
  ["GET", /^\/api\/health$/, core.health, { public: true }],
  ["GET", /^\/api\/v1\/schema$/, core.schema, { public: true }],
  ["GET", /^\/api\/v1\/samples$/, core.samples, { public: true }],
  ["POST", /^\/api\/v1\/mandates$/, core.createMandate, { body: true }],
  ["POST", /^\/api\/v1\/executions$/, core.createExecution, { body: true }],
  ["POST", /^\/api\/v1\/adjudications$/, adj.createAdjudication, { body: true }],
  ["GET", new RegExp(`^/api/v1/adjudications/${ID}$`), (ctx, _b, m) => adj.getAudit(ctx, m[1])],
  ["GET", new RegExp(`^/api/v1/cases/${ID}$`), (ctx, _b, m) => adj.getCase(ctx, m[1])],
  ["POST", /^\/api\/demo\/generate-case$/, generateCase, { body: true, demo: true, public: true }],
];

/**
 * @param {Partial<ReturnType<typeof loadConfig>>} [overrides]
 * @param {{now?: () => number, fetch?: typeof fetch, store?: Store}} [deps]
 */
export function createApp(overrides = {}, deps = {}) {
  const config = { ...loadConfig(), ...overrides };
  const now = deps.now ?? Date.now;
  const store = deps.store ?? new Store(config.maxStoreEntries);
  const limiter = new RateLimiter({ now });
  const demoLimiter = new RateLimiter({ now });
  const authFailLimiter = new RateLimiter({ now });
  const fetchImpl = deps.fetch ?? globalThis.fetch;

  async function dispatch(req, res, requestId, cors) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    const send = (status, body, headers = {}) => sendJson(res, status, body, { ...cors, "X-Request-Id": requestId, ...headers });

    if (req.method === "OPTIONS") {
      res.writeHead(Object.keys(cors).length ? 204 : 403, { ...cors, "X-Request-Id": requestId });
      return res.end();
    }

    let matched = null;
    let pathMatched = false;
    for (const [method, re, handler, flags = {}] of ROUTES) {
      const m = re.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (method === req.method) {
        matched = { handler, flags, m };
        break;
      }
    }
    if (!matched) {
      if (pathMatched) throw new ApiError(405, "method_not_allowed", `Method ${req.method} is not allowed on this path.`);
      throw new ApiError(404, "not_found", "No such endpoint.");
    }

    const { handler, flags, m } = matched;
    const ip = clientAddress(req, config.trustProxy);

    // Auth: demo + discovery endpoints are public; stored-data endpoints require a key (when configured).
    // Failed attempts are throttled per address so keys cannot be brute-forced.
    let caller = null;
    if (!flags.public) {
      try {
        caller = authenticate(req, config.apiKeys);
      } catch (err) {
        if (!authFailLimiter.hit(`authfail:${ip}`, AUTH_FAILURES_PER_MIN).allowed) {
          throw new ApiError(429, "rate_limited", "Too many failed authentication attempts.", { retryAfterSec: 60 });
        }
        throw err;
      }
    }
    const tenant = caller ?? "anon";

    // Rate limit per caller (key id when authenticated, else client address).
    const id = caller ?? `ip:${ip}`;
    const rl = (flags.demo ? demoLimiter : limiter).hit(`${flags.demo ? "demo" : "api"}:${id}`, flags.demo ? config.demoRateLimitPerMin : config.rateLimitPerMin);
    const rlHeaders = { "RateLimit-Limit": String(rl.limit), "RateLimit-Remaining": String(rl.remaining) };
    if (!rl.allowed) {
      throw new ApiError(429, "rate_limited", `Too many requests. Retry in ${rl.retryAfterSec}s.`, { retryAfterSec: rl.retryAfterSec });
    }

    const body = flags.body ? await readJsonBody(req, config.maxBodyBytes) : undefined;
    const out = await handler({ config, store, tenant, now, fetch: fetchImpl }, body, m);
    return send(out.status, out.body, rlHeaders);
  }

  const listener = async (req, res) => {
    const requestId = requestIdFor(req);
    const cors = corsHeaders(req, config.allowedOrigins);
    try {
      await dispatch(req, res, requestId, cors);
    } catch (err) {
      if (!(err instanceof ApiError)) console.error(`[${requestId}]`, err?.message ?? err);
      const extra = { ...cors, "X-Request-Id": requestId };
      if (err instanceof ApiError && err.status === 429) extra["Retry-After"] = String(err.details?.retryAfterSec ?? 60);
      if (err instanceof ApiError && err.status === 401) extra["WWW-Authenticate"] = 'Bearer realm="adjudex"';
      // Don't keep reading an oversized upload.
      if (err instanceof ApiError && err.status === 413) extra.Connection = "close";
      sendError(res, err, requestId, extra);
    }
  };

  return { config, store, listener, server: createServer(listener) };
}
