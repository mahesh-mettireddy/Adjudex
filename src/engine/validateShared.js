// Shared helpers for the strict validators (internal module).

import { ID_PATTERN, CURRENCY_PATTERN, LIMITS } from "./constants.js";
import { parseMoney, minorToDecimal } from "./money.js";
import { isIsoDate, cleanText } from "./text.js";

export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export class Collector {
  constructor() {
    this.errors = [];
  }
  add(path, code, message) {
    this.errors.push({ path, code, message });
  }
}

export function rejectUnknown(obj, allowed, path, c) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) c.add(`${path}.${key}`, "unknown_field", `"${key}" is not a recognised field`);
  }
}

export function readText(obj, key, path, c, opts) {
  const r = cleanText(obj[key], opts);
  if (!r.ok) {
    c.add(`${path}.${key}`, "invalid_text", `"${key}" ${r.reason}`);
    return undefined;
  }
  return r.value;
}

export function readId(obj, key, path, c, fallback) {
  if (obj[key] === undefined) return fallback;
  if (typeof obj[key] !== "string" || !ID_PATTERN.test(obj[key])) {
    c.add(
      `${path}.${key}`,
      "invalid_id",
      `"${key}" must be 1-${LIMITS.maxIdLength} chars of letters, digits, '.', '_', ':' or '-'`
    );
    return undefined;
  }
  return obj[key];
}

export function readMoney(obj, key, path, c, { positive = false } = {}) {
  const r = parseMoney(obj[key]);
  if (!r.ok) {
    c.add(`${path}.${key}`, "invalid_money", `"${key}" ${r.reason}`);
    return undefined;
  }
  if (positive && r.minor <= 0n) {
    c.add(`${path}.${key}`, "invalid_money", `"${key}" must be greater than zero`);
    return undefined;
  }
  return minorToDecimal(r.minor);
}

export function readCurrency(obj, path, c, fallback) {
  if (obj.currency === undefined) return fallback;
  if (typeof obj.currency !== "string" || !CURRENCY_PATTERN.test(obj.currency)) {
    c.add(`${path}.currency`, "invalid_currency", '"currency" must be a 3-letter uppercase ISO code, e.g. "INR"');
    return undefined;
  }
  return obj.currency;
}

export function readDate(obj, key, path, c) {
  if (!isIsoDate(obj[key])) {
    c.add(`${path}.${key}`, "invalid_date", `"${key}" must be a real date formatted YYYY-MM-DD`);
    return undefined;
  }
  return obj[key];
}

export function readBool(obj, key, path, c) {
  if (typeof obj[key] !== "boolean") {
    c.add(`${path}.${key}`, "invalid_boolean", `"${key}" must be true or false`);
    return undefined;
  }
  return obj[key];
}

export function finish(c, value) {
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value };
}

/** Parse a JSON string safely, returning a friendly error instead of throwing. */
export function parseJson(text) {
  if (typeof text !== "string") return { ok: false, error: "Expected JSON text." };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "That isn't valid JSON. Check for missing quotes, commas or braces and try again." };
  }
}

/** Flatten validator errors to a single human-readable line. */
export function describeErrors(errors) {
  return errors.map((e) => `${e.path}: ${e.message}`).join("; ");
}
