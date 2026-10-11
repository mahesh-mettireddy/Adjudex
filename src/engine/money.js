// Money is handled as integer minor units (BigInt) so no float comparison ever
// decides a verdict. This is the JS equivalent of BigDecimal semantics.

import { LIMITS } from "./constants.js";

const DECIMAL_RE = /^\d{1,13}(?:\.\d{1,2})?$/;
const SYMBOLS = { INR: "₹" };

/**
 * Parse a money input (finite number or decimal string, max 2 decimals).
 * @returns {{ok: true, minor: bigint} | {ok: false, reason: string}}
 */
export function parseMoney(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: "must be a finite number" };
    if (value < 0) return { ok: false, reason: "must not be negative" };
    if (value > LIMITS.maxMoneyUnits) return { ok: false, reason: "is too large" };
    // Number inputs may carry float noise (0.1 + 0.2); round to the minor unit.
    return { ok: true, minor: BigInt(Math.round(value * 100)) };
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!DECIMAL_RE.test(s)) return { ok: false, reason: "must be a decimal with at most 2 fraction digits" };
    const [whole, frac = ""] = s.split(".");
    const minor = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
    if (minor > BigInt(LIMITS.maxMoneyUnits) * 100n) return { ok: false, reason: "is too large" };
    return { ok: true, minor };
  }
  return { ok: false, reason: "must be a number or decimal string" };
}

const pad2 = (b) => String(b).padStart(2, "0");

/** Canonical decimal string used in audit JSON, e.g. 720000n -> "7200.00". */
export function minorToDecimal(minor) {
  return `${minor / 100n}.${pad2(minor % 100n)}`;
}

/** Human display with grouping, e.g. "₹7,200" or "USD 1,234.50". */
export function fmtMoney(minor, currency = "INR") {
  const whole = minor / 100n;
  const frac = minor % 100n;
  const grouped = whole.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
  const prefix = SYMBOLS[currency] ?? `${currency} `;
  return `${prefix}${grouped}${frac === 0n ? "" : "." + pad2(frac)}`;
}

/** Percentage over a cap, half-up to 2 dp using integer basis points. */
export function pctOver(overMinor, capMinor) {
  if (capMinor <= 0n || overMinor < 0n) return null;
  const bps = (overMinor * 20000n + capMinor) / (capMinor * 2n);
  const whole = bps / 100n;
  const frac = bps % 100n;
  if (frac === 0n) return `${whole}`;
  return frac % 10n === 0n ? `${whole}.${frac / 10n}` : `${whole}.${pad2(frac)}`;
}
