// Date and text helpers shared by the validators and rules.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Control characters and angle brackets are never legitimate in names/labels.
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT_RE = /[\u0000-\u001f\u007f<>]/;

/** True only for real calendar dates formatted YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Add whole days to an ISO date (UTC arithmetic, no DST surprises). */
export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Normalise free text: NFKC, trim, collapse whitespace.
 * @returns {{ok: true, value: string} | {ok: false, reason: string}}
 */
export function cleanText(value, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string") return { ok: false, reason: "must be a string" };
  const v = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (v.length < min) return { ok: false, reason: min === 1 ? "must not be empty" : `must be at least ${min} characters` };
  if (v.length > max) return { ok: false, reason: `must be at most ${max} characters` };
  if (UNSAFE_TEXT_RE.test(v)) return { ok: false, reason: "contains control characters or markup" };
  return { ok: true, value: v };
}

/** Case/whitespace-insensitive key for merchant allow-list matching. */
export function merchantKey(name) {
  return String(name).normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
