// Environment-driven configuration. Secrets are read only here, on the server.
// Invalid numeric values fall back to safe defaults instead of crashing or
// silently disabling a limit.

function int(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function list(value) {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {Record<string, string | undefined>} env */
export function loadConfig(env = process.env) {
  return Object.freeze({
    port: int(env.PORT, 8787, { min: 0, max: 65535 }),
    host: env.HOST?.trim() || "127.0.0.1",
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    apiKeys: list(env.ADJUDEX_API_KEYS),
    trustProxy: env.TRUST_PROXY === "1",
    maxBodyBytes: int(env.MAX_BODY_BYTES, 65536, { min: 1024, max: 5_000_000 }),
    maxStoreEntries: int(env.MAX_STORE_ENTRIES, 5000, { min: 10, max: 1_000_000 }),
    rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 120),
    demoRateLimitPerMin: int(env.DEMO_RATE_LIMIT_PER_MIN, 10),
    gemini: Object.freeze({
      apiKey: env.GEMINI_API_KEY?.trim() || "",
      model: /^[A-Za-z0-9._-]{1,64}$/.test(env.GEMINI_MODEL?.trim() ?? "") ? env.GEMINI_MODEL.trim() : "gemini-2.5-flash",
      timeoutMs: int(env.GEMINI_TIMEOUT_MS, 15000, { min: 1000, max: 60000 }),
    }),
  });
}
