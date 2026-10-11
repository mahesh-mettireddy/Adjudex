// Deterministic local case generator (seeded). Same schema and evaluator as the
// Gemini path, and the fallback whenever Gemini is unavailable.

import { GENERATION_SCENARIOS, LIMITS } from "./constants.js";
import { parseMoney } from "./money.js";
import { addDays, merchantKey } from "./text.js";

const CONCRETE = GENERATION_SCENARIOS.filter((s) => s !== "mixed");
const OUTSIDERS = ["Gucci Hotels", "Sunset Suites", "Aurora Stays", "Unlisted Stays"];

// mulberry32: tiny, fast, well-distributed seeded PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const toNum = (minor) => Number(minor) / 100;

const SOFT_INFO = {
  verified: ["Quiet room verified by listing metadata.", "Listing carries a verified quiet-room tag."],
  contradicted: ["Guest reviews mention loud construction next door.", "Room faces a busy highway, per listing photos."],
  absent: ["The listing never mentions noise or room location.", "Room is next to the service lift; noise is not mentioned."],
};

/**
 * @param {object} mandate a validated mandate
 * @param {string} scenario one of GENERATION_SCENARIOS
 * @param {number} seq 1-based sequence number (used in the case id)
 * @param {() => number} rng seeded random source
 */
export function buildCase(mandate, scenario, seq, rng) {
  const cap = parseMoney(mandate.maxPricePerNight).minor;
  const allowed = mandate.allowedMerchants;
  const allowedKeys = new Set(allowed.map(merchantKey));
  const outsider = OUTSIDERS.find((m) => !allowedKeys.has(merchantKey(m))) || "Unlisted Stays";
  const { checkIn, checkOut } = mandate.stayWindow;
  const hasSoft = mandate.softConstraints.some((s) => s.key === "quietRoom");

  const exec = {
    caseId: `EXE-LOCAL-${String(seq).padStart(3, "0")}`,
    merchant: pick(rng, allowed),
    price: toNum((cap * BigInt(70 + Math.floor(rng() * 26))) / 100n), // 70-95% of cap
    currency: mandate.currency,
    refundable: mandate.refundableRequired,
    checkIn,
    checkOut,
    quietEvidence: "verified",
    softInfo: pick(rng, SOFT_INFO.verified),
  };
  const soft = (v) => {
    exec.quietEvidence = v;
    exec.softInfo = pick(rng, SOFT_INFO[v]);
  };
  const breach = {
    price: () => {
      const scaled = (cap * BigInt(110 + Math.floor(rng() * 40))) / 100n;
      exec.price = toNum(scaled > cap ? scaled : cap + 1n); // always strictly above the cap, even for tiny caps
    },
    merchant: () => (exec.merchant = outsider),
    refundable: () => (exec.refundable = !mandate.refundableRequired),
    date: () => {
      exec.checkOut = addDays(checkOut, 1 + Math.floor(rng() * 3));
    },
  };

  let name;
  switch (scenario) {
    case "price_breach": breach.price(); name = "Price above cap"; break;
    case "merchant_breach": breach.merchant(); name = "Unapproved merchant"; break;
    case "refundability_breach": breach.refundable(); name = "Refundability mismatch"; break;
    case "date_breach": breach.date(); name = "Stay outside window"; break;
    case "soft_contradiction": soft("contradicted"); name = "Quiet-room evidence contradicts"; break;
    case "soft_missing_evidence": soft("absent"); name = "Missing quiet-room evidence"; break;
    case "multiple_breaches":
      breach.price(); breach.merchant(); breach.refundable(); soft("absent");
      name = "Multiple breaches";
      break;
    default: name = "Clean booking";
  }
  if (!hasSoft) exec.softInfo = "";
  return { name, intendedScenario: scenario === "mixed" ? "clean" : scenario, execution: exec };
}

/**
 * @param {object} mandate validated mandate
 * @param {{scenario?: string, count?: number, seed?: number}} [opts]
 */
export function generateLocalCases(mandate, { scenario = "mixed", count = 1, seed = Date.now() } = {}) {
  const sc = GENERATION_SCENARIOS.includes(scenario) ? scenario : "mixed";
  const n = Math.min(Math.max(Math.trunc(Number(count)) || 1, 1), LIMITS.maxGenerateCount);
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const s = sc === "mixed" ? CONCRETE[Math.floor(rng() * CONCRETE.length)] : sc;
    return buildCase(mandate, s, i + 1, rng);
  });
}
