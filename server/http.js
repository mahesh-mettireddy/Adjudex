// Small HTTP helpers: error type, JSON responses, body reading, CORS, headers.

import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code stable machine-readable code
   * @param {string} message human-readable message
   * @param {unknown} [details] extra structured info (e.g. validation errors)
   */
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

export function requestIdFor(req) {
  const given = req.headers["x-request-id"];
  return typeof given === "string" && REQUEST_ID_RE.test(given) ? given : randomUUID();
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

export function sendJson(res, status, body, extraHeaders = {}) {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

export function sendError(res, err, requestId, extraHeaders = {}) {
  const known = err instanceof ApiError;
  // Unknown errors are never leaked to clients (they may contain secrets/paths).
  const status = known ? err.status : 500;
  const body = {
    error: {
      code: known ? err.code : "internal_error",
      message: known ? err.message : "An unexpected error occurred.",
      ...(known && err.details !== undefined ? { details: err.details } : {}),
      requestId,
    },
  };
  sendJson(res, status, body, extraHeaders);
}

/** CORS: exact-match allow-list only. Never `*`, never reflects arbitrary origins. */
export function corsHeaders(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Request-Id",
    "Access-Control-Expose-Headers": "X-Request-Id, RateLimit-Limit, RateLimit-Remaining, Retry-After",
    "Access-Control-Max-Age": "600",
  };
}

/** Read and parse a JSON body with a hard size cap and content-type check. */
export async function readJsonBody(req, maxBytes) {
  const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    throw new ApiError(415, "unsupported_media_type", 'Content-Type must be "application/json".');
  }
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, "payload_too_large", `Request body must be at most ${maxBytes} bytes.`);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new ApiError(413, "payload_too_large", `Request body must be at most ${maxBytes} bytes.`);
    }
    chunks.push(chunk);
  }
  if (size === 0) throw new ApiError(400, "empty_body", "Request body is required.");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
}
