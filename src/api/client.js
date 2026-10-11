// Browser/Node client for the Adjudex HTTP API. Used by the UI workbench and
// usable by any JS caller. Never throws: every call resolves to
//   { ok: true, status, data, requestId }  or
//   { ok: false, status, error: { code, message, details? }, requestId }
// Network failures, timeouts and non-JSON replies (e.g. a static host that
// rewrites /api to index.html) are normalised to code "unreachable".

const DEFAULT_TIMEOUT_MS = 20_000;

/** Accept "", "/", a relative path prefix, or an http(s) origin. Returns "" for same-origin. */
export function normalizeBaseUrl(input) {
  const raw = String(input ?? "").trim();
  if (raw === "" || raw === "/") return { ok: true, value: "" };
  if (raw.startsWith("/") && !raw.startsWith("//")) return { ok: true, value: raw.replace(/\/+$/, "") };
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
    if (u.username || u.password) return { ok: false, reason: "Do not put credentials in the URL; use the API key field." };
    return { ok: true, value: `${u.origin}${u.pathname.replace(/\/+$/, "")}` };
  } catch {
    return { ok: false, reason: "Enter an http(s) URL such as https://api.example.com, or leave blank for same-origin." };
  }
}

const failure = (status, code, message, requestId = null, details) => ({
  ok: false,
  status,
  error: { code, message, ...(details !== undefined ? { details } : {}) },
  requestId,
});

/**
 * @param {{baseUrl?: string, apiKey?: string, fetch?: typeof fetch, timeoutMs?: number}} [opts]
 */
export function createApiClient({ baseUrl = "", apiKey = "", fetch: fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const base = normalizeBaseUrl(baseUrl);

  async function request(method, path, body) {
    if (!base.ok) return failure(0, "invalid_base_url", base.reason);
    const doFetch = fetchImpl ?? globalThis.fetch;
    if (typeof doFetch !== "function") return failure(0, "unreachable", "fetch is not available in this environment.");
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    let response;
    try {
      response = await doFetch(`${base.value}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      });
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      return failure(0, timedOut ? "timeout" : "unreachable", timedOut ? "The API did not respond in time." : "Could not reach the API.");
    }
    const requestId = response.headers?.get?.("x-request-id") ?? null;
    let json;
    try {
      json = await response.json();
    } catch {
      return failure(response.status, "unreachable", "The server did not return JSON (is the Adjudex API running?).", requestId);
    }
    if (!response.ok) {
      const e = json?.error;
      return failure(response.status, e?.code ?? "http_error", e?.message ?? `HTTP ${response.status}`, e?.requestId ?? requestId, e?.details);
    }
    return { ok: true, status: response.status, data: json, requestId };
  }

  return {
    health: () => request("GET", "/api/health"),
    schema: () => request("GET", "/api/v1/schema"),
    samples: () => request("GET", "/api/v1/samples"),
    generateCase: (payload) => request("POST", "/api/demo/generate-case", payload),
    createMandate: (mandate) => request("POST", "/api/v1/mandates", { mandate }),
    createExecution: (execution) => request("POST", "/api/v1/executions", { execution }),
    adjudicate: (payload) => request("POST", "/api/v1/adjudications", payload),
    getAdjudication: (verdictId) => request("GET", `/api/v1/adjudications/${encodeURIComponent(verdictId)}`),
    getCase: (caseId) => request("GET", `/api/v1/cases/${encodeURIComponent(caseId)}`),
  };
}

/** Build a copy-pasteable cURL command (the key is shown as a placeholder, never inlined). */
export function toCurl({ baseUrl, path, body, withKey = false }) {
  const base = normalizeBaseUrl(baseUrl);
  const origin = base.ok && base.value ? base.value : "http://localhost:8787";
  const parts = [`curl -sS -X ${body === undefined ? "GET" : "POST"} '${origin}${path}'`];
  if (withKey) parts.push("-H 'Authorization: Bearer $ADJUDEX_API_KEY'");
  if (body !== undefined) {
    parts.push("-H 'Content-Type: application/json'");
    parts.push(`-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`);
  }
  return parts.join(" \\\n  ");
}
