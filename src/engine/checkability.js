// Mandate checkability score: how mechanically verifiable each clause is.
// Pure and defensive: a malformed mandate scores low instead of throwing.

import { parseMoney, fmtMoney } from "./money.js";
import { isIsoDate } from "./text.js";

export function scoreCheckability(mandate) {
  const m = mandate ?? {};
  const clauses = [];

  const cap = parseMoney(m.maxPricePerNight);
  const priceValid = cap.ok && cap.minor > 0n;
  clauses.push({
    id: "price",
    label: priceValid ? `Max price ≤ ${fmtMoney(cap.minor, m.currency || "INR")} / night` : "Max price / night",
    score: priceValid ? 100 : 0,
    reason: priceValid
      ? "Numeric threshold; a single comparison decides it."
      : "Cap is zero or invalid; no booking can satisfy it.",
  });

  const hasMerchants = Array.isArray(m.allowedMerchants) && m.allowedMerchants.length > 0;
  clauses.push({
    id: "merchant",
    label: "Allowed merchants",
    score: hasMerchants ? 100 : 40,
    reason: hasMerchants
      ? "Enumerated allow-list; exact membership test."
      : "Empty allow-list rejects every merchant; likely unintended.",
  });

  clauses.push({
    id: "refundable",
    label: `Refundable ${m.refundableRequired ? "required" : "not required"}`,
    score: typeof m.refundableRequired === "boolean" ? 100 : 0,
    reason:
      typeof m.refundableRequired === "boolean"
        ? "Boolean flag; directly comparable with merchant terms."
        : "Refundability is not a true/false value, so it cannot be compared.",
  });

  const w = m.stayWindow ?? {};
  const windowValid = isIsoDate(w.checkIn) && isIsoDate(w.checkOut) && w.checkIn <= w.checkOut;
  clauses.push({
    id: "dates",
    label: `Stay window ${w.checkIn || "?"} → ${w.checkOut || "?"}`,
    score: windowValid ? 100 : 0,
    reason: windowValid
      ? "ISO date range; containment is an exact comparison."
      : "Window is missing or inverted; no stay can satisfy it.",
  });

  (Array.isArray(m.softConstraints) ? m.softConstraints : []).forEach((sc) => {
    const label = String(sc?.label ?? "");
    const measurable = /\d/.test(label) && /(db|km|\bm\b|%|₹|rating|≤|≥|<|>)/i.test(label);
    clauses.push({
      id: sc?.key ?? label,
      label: `Soft: "${label}"`,
      score: measurable ? 75 : 20,
      reason: measurable
        ? "Contains a measurable threshold, but still needs a named evidence source."
        : "Natural language with no threshold or evidence source; cannot be verified deterministically.",
    });
  });

  const overall = Math.round(clauses.reduce((s, c) => s + c.score, 0) / clauses.length);
  return { clauses, overall };
}
