import { KEY_PATTERN, LIMITS } from "./constants.js";
import { cleanText, merchantKey } from "./text.js";
import {
  Collector,
  isPlainObject,
  rejectUnknown,
  readText,
  readId,
  readMoney,
  readCurrency,
  readDate,
  readBool,
  finish,
} from "./validateShared.js";

const MANDATE_FIELDS = [
  "id",
  "currency",
  "maxPricePerNight",
  "allowedMerchants",
  "refundableRequired",
  "stayWindow",
  "softConstraints",
  "signedBy",
  "signedAt",
  "signatureHash",
];

function readMerchants(input, path, c) {
  const p = `${path}.allowedMerchants`;
  if (!Array.isArray(input.allowedMerchants)) {
    c.add(p, "invalid_type", '"allowedMerchants" must be an array of merchant names');
    return undefined;
  }
  if (input.allowedMerchants.length === 0) {
    c.add(p, "empty_allow_list", '"allowedMerchants" must contain at least one merchant (an empty list would breach every execution)');
    return undefined;
  }
  if (input.allowedMerchants.length > LIMITS.maxMerchants) {
    c.add(p, "too_many", `"allowedMerchants" may contain at most ${LIMITS.maxMerchants} merchants`);
    return undefined;
  }
  const seen = new Set();
  const out = [];
  input.allowedMerchants.forEach((m, i) => {
    const r = cleanText(m);
    if (!r.ok) {
      c.add(`${p}[${i}]`, "invalid_text", `merchant ${r.reason}`);
      return;
    }
    const k = merchantKey(r.value);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r.value);
    }
  });
  return out;
}

function readWindow(input, path, c) {
  const p = `${path}.stayWindow`;
  if (!isPlainObject(input.stayWindow)) {
    c.add(p, "invalid_type", '"stayWindow" must be an object with checkIn and checkOut');
    return undefined;
  }
  rejectUnknown(input.stayWindow, ["checkIn", "checkOut"], p, c);
  const checkIn = readDate(input.stayWindow, "checkIn", p, c);
  const checkOut = readDate(input.stayWindow, "checkOut", p, c);
  if (!checkIn || !checkOut) return undefined;
  if (checkIn > checkOut) {
    c.add(p, "inverted_window", "stayWindow.checkIn must not be after stayWindow.checkOut");
    return undefined;
  }
  return { checkIn, checkOut };
}

function readSoftConstraints(input, path, c) {
  if (input.softConstraints === undefined) return [];
  const p = `${path}.softConstraints`;
  if (!Array.isArray(input.softConstraints)) {
    c.add(p, "invalid_type", '"softConstraints" must be an array');
    return [];
  }
  if (input.softConstraints.length > LIMITS.maxSoftConstraints) {
    c.add(p, "too_many", `at most ${LIMITS.maxSoftConstraints} soft constraints are allowed`);
    return [];
  }
  const keys = new Set();
  const out = [];
  input.softConstraints.forEach((sc, i) => {
    const ip = `${p}[${i}]`;
    if (!isPlainObject(sc)) {
      c.add(ip, "invalid_type", "soft constraint must be an object { key, label }");
      return;
    }
    rejectUnknown(sc, ["key", "label"], ip, c);
    if (typeof sc.key !== "string" || !KEY_PATTERN.test(sc.key)) {
      c.add(`${ip}.key`, "invalid_key", '"key" must be an identifier like "quietRoom" (letters, digits, underscore)');
      return;
    }
    if (keys.has(sc.key)) {
      c.add(`${ip}.key`, "duplicate_key", `duplicate soft constraint key "${sc.key}"`);
      return;
    }
    keys.add(sc.key);
    const label = readText(sc, "label", ip, c);
    if (label !== undefined) out.push({ key: sc.key, label });
  });
  return out;
}

/**
 * Validate and normalise a mandate.
 * @param {unknown} input raw mandate
 * @returns {{ok: true, value: object} | {ok: false, errors: Array<{path: string, code: string, message: string}>}}
 */
export function validateMandate(input, path = "mandate") {
  const c = new Collector();
  if (!isPlainObject(input)) {
    c.add(path, "invalid_type", "mandate must be a JSON object");
    return finish(c);
  }
  rejectUnknown(input, MANDATE_FIELDS, path, c);

  const id = readId(input, "id", path, c, "MND-ADHOC");
  const currency = readCurrency(input, path, c, "INR");
  const maxPricePerNight = readMoney(input, "maxPricePerNight", path, c, { positive: true });
  const refundableRequired = readBool(input, "refundableRequired", path, c);
  const allowedMerchants = readMerchants(input, path, c);
  const stayWindow = readWindow(input, path, c);
  const softConstraints = readSoftConstraints(input, path, c);

  const meta = {};
  for (const k of ["signedBy", "signedAt", "signatureHash"]) {
    if (input[k] !== undefined) {
      const v = readText(input, k, path, c, { max: 128 });
      if (v !== undefined) meta[k] = v;
    }
  }

  return finish(c, {
    id,
    ...meta,
    currency,
    maxPricePerNight,
    allowedMerchants,
    refundableRequired,
    stayWindow,
    softConstraints,
  });
}
