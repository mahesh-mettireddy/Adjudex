// Deterministic hard-constraint rules. Each rule returns a constraint result:
// { key, ctype, label, type, status, expected, actual, detail }.
// A rule that cannot compare its inputs safely returns UNVERIFIABLE (abstains)
// instead of guessing, so malformed or mismatched data never yields a false
// "in mandate" or a false "breach".

import { STATUS } from "./constants.js";
import { parseMoney } from "./money.js";
import { fmtMoney, pctOver } from "./money.js";
import { isIsoDate, merchantKey } from "./text.js";

const base = (key, ctype, label, type = "hard") => ({ key, ctype, label, type });

const unverifiable = (head, expected, actual, detail) => ({
  ...head,
  status: STATUS.UNVERIFIABLE,
  expected,
  actual,
  detail,
});

const word = (b) => (b ? "refundable" : "non-refundable");

export function priceRule(mandate, execution) {
  const head = base("price", "price_cap", "Price per night");
  const cap = parseMoney(mandate.maxPricePerNight);
  const price = parseMoney(execution.price);
  const cur = mandate.currency || "INR";
  if (!cap.ok || cap.minor <= 0n) {
    return unverifiable(head, "A positive price cap", String(mandate.maxPricePerNight), "The mandate price cap is missing or invalid, so it cannot be checked");
  }
  if (!price.ok) {
    return unverifiable(head, `≤ ${fmtMoney(cap.minor, cur)}`, String(execution.price), "The executed price is missing or invalid, so it cannot be checked");
  }
  if (execution.currency && execution.currency !== cur) {
    return unverifiable(
      head,
      `≤ ${fmtMoney(cap.minor, cur)}`,
      `${execution.price} ${execution.currency}`,
      `Execution currency ${execution.currency} differs from mandate currency ${cur}; no FX rate is assumed, so the cap cannot be checked`
    );
  }
  const ok = price.minor <= cap.minor;
  const over = price.minor - cap.minor;
  const pct = pctOver(over, cap.minor);
  return {
    ...head,
    status: ok ? STATUS.MET : STATUS.BREACHED,
    expected: `≤ ${fmtMoney(cap.minor, cur)}`,
    actual: fmtMoney(price.minor, cur),
    detail: ok
      ? `${fmtMoney(price.minor, cur)} ≤ ${fmtMoney(cap.minor, cur)}`
      : `${fmtMoney(price.minor, cur)} exceeds cap ${fmtMoney(cap.minor, cur)} by ${fmtMoney(over, cur)}${pct !== null ? ` (+${pct}%)` : ""}`,
  };
}

export function merchantRule(mandate, execution) {
  const head = base("merchant", "allowed_merchants", "Merchant");
  const allowed = Array.isArray(mandate.allowedMerchants) ? mandate.allowedMerchants : [];
  const list = allowed.length ? allowed.join(", ") : "(empty allow-list)";
  if (typeof execution.merchant !== "string" || !execution.merchant.trim()) {
    return unverifiable(head, `One of: ${list}`, "(missing)", "The executed merchant is missing, so it cannot be checked");
  }
  const ok = allowed.some((m) => merchantKey(m) === merchantKey(execution.merchant));
  return {
    ...head,
    status: ok ? STATUS.MET : STATUS.BREACHED,
    expected: `One of: ${list}`,
    actual: execution.merchant,
    detail: ok
      ? `"${execution.merchant}" is on the allow-list (${list})`
      : `"${execution.merchant}" is not on the allow-list: ${list}`,
  };
}

export function refundableRule(mandate, execution) {
  const head = base("refundable", "refundable_required", "Refundable");
  const expected = mandate.refundableRequired ? "Refundable required" : "Non-refundable required";
  if (typeof execution.refundable !== "boolean" || typeof mandate.refundableRequired !== "boolean") {
    return unverifiable(head, expected, "(unknown)", "Refundability is not stated as true/false, so it cannot be checked");
  }
  const ok = execution.refundable === mandate.refundableRequired;
  return {
    ...head,
    status: ok ? STATUS.MET : STATUS.BREACHED,
    expected,
    actual: execution.refundable ? "Refundable" : "Non-refundable",
    detail: ok
      ? `Booking is ${word(execution.refundable)}, matching the mandate`
      : `Booking is ${word(execution.refundable)} but mandate requires ${word(mandate.refundableRequired)}`,
  };
}

export function dateRule(mandate, execution) {
  const head = base("dates", "date_range", "Stay dates");
  const w = mandate.stayWindow || {};
  const expected = `${w.checkIn ?? "?"} → ${w.checkOut ?? "?"}`;
  const valid =
    isIsoDate(w.checkIn) &&
    isIsoDate(w.checkOut) &&
    w.checkIn <= w.checkOut &&
    isIsoDate(execution.checkIn) &&
    isIsoDate(execution.checkOut);
  if (!valid) {
    return unverifiable(head, expected, `${execution.checkIn ?? "?"} → ${execution.checkOut ?? "?"}`, "A date is missing, invalid or the window is inverted, so the stay cannot be checked");
  }
  const actual = `${execution.checkIn} → ${execution.checkOut}`;
  // ISO dates compare correctly as strings. An inverted stay is itself a breach.
  const ok = execution.checkIn >= w.checkIn && execution.checkOut <= w.checkOut && execution.checkIn <= execution.checkOut;
  return {
    ...head,
    status: ok ? STATUS.MET : STATUS.BREACHED,
    expected,
    actual,
    detail: ok
      ? `Stay ${actual} is inside the authorised window`
      : `Stay ${actual} falls outside the authorised window ${expected}`,
  };
}

export const HARD_RULES = Object.freeze([priceRule, merchantRule, refundableRule, dateRule]);
