// Authentication (optional API keys) and fixed-window rate limiting.

import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./http.js";

const digest = (s) => createHash("sha256").update(s).digest();

/** Extract the caller's API key from `Authorization: Bearer` or `X-API-Key`. */
export function extractApiKey(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const m = /^Bearer\s+(\S+)$/i.exec(auth);
    if (m) return m[1];
  }
  const x = req.headers["x-api-key"];
  return typeof x === "string" && x ? x : null;
}

/**
 * Constant-time check against the configured keys. When no keys are
 * configured the API runs open (documented as local-development only).
 * @returns {string|null} a stable, non-secret caller id (hash prefix) or null when open
 */
export function authenticate(req, apiKeys) {
  if (apiKeys.length === 0) return null;
  const provided = extractApiKey(req);
  if (!provided) throw new ApiError(401, "unauthorized", "Missing API key. Send Authorization: Bearer <key> or X-API-Key.");
  const given = digest(provided);
  let matched = false;
  for (const k of apiKeys) {
    // Compare fixed-length digests; evaluate every key to avoid early-exit timing.
    if (timingSafeEqual(given, digest(k))) matched = true;
  }
  if (!matched) throw new ApiError(401, "unauthorized", "Invalid API key.");
  return `key_${given.toString("hex").slice(0, 12)}`;
}

export function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim().slice(0, 64);
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export class RateLimiter {
  /** @param {{windowMs?: number, now?: () => number, maxBuckets?: number}} [opts] */
  constructor({ windowMs = 60_000, now = Date.now, maxBuckets = 10_000 } = {}) {
    this.windowMs = windowMs;
    this.now = now;
    this.maxBuckets = maxBuckets;
    this.buckets = new Map();
  }

  /** @returns {{allowed: boolean, limit: number, remaining: number, retryAfterSec: number}} */
  hit(id, limit) {
    const t = this.now();
    if (this.buckets.size >= this.maxBuckets) this.prune(t);
    let b = this.buckets.get(id);
    if (!b || t >= b.resetAt) {
      b = { count: 0, resetAt: t + this.windowMs };
      this.buckets.set(id, b);
    }
    b.count += 1;
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - t) / 1000));
    return { allowed: b.count <= limit, limit, remaining: Math.max(0, limit - b.count), retryAfterSec };
  }

  prune(t = this.now()) {
    for (const [k, b] of this.buckets) if (t >= b.resetAt) this.buckets.delete(k);
    // Still full of live buckets (e.g. an attack): drop the oldest to bound memory.
    while (this.buckets.size >= this.maxBuckets) this.buckets.delete(this.buckets.keys().next().value);
  }
}
