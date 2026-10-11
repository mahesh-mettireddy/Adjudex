import { EVIDENCE_VALUES, KEY_PATTERN, LIMITS } from "./constants.js";
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

const EXECUTION_FIELDS = [
  "caseId",
  "merchant",
  "price",
  "currency",
  "refundable",
  "checkIn",
  "checkOut",
  "quietEvidence",
  "evidence",
  "softInfo",
];

function readEvidence(input, path, c) {
  const evidence = {};
  if (input.evidence !== undefined) {
    const p = `${path}.evidence`;
    if (!isPlainObject(input.evidence)) {
      c.add(p, "invalid_type", '"evidence" must be an object like { "quietRoom": "verified" }');
    } else if (Object.keys(input.evidence).length > LIMITS.maxSoftConstraints) {
      c.add(p, "too_many", `at most ${LIMITS.maxSoftConstraints} evidence entries are allowed`);
    } else {
      for (const [k, v] of Object.entries(input.evidence)) {
        if (!KEY_PATTERN.test(k)) c.add(`${p}.${k}`, "invalid_key", "evidence key must be an identifier");
        else if (!EVIDENCE_VALUES.includes(v)) {
          c.add(`${p}.${k}`, "invalid_evidence", `must be one of ${EVIDENCE_VALUES.join(", ")}`);
        } else evidence[k] = v;
      }
    }
  }
  if (input.quietEvidence !== undefined) {
    if (!EVIDENCE_VALUES.includes(input.quietEvidence)) {
      c.add(`${path}.quietEvidence`, "invalid_evidence", `"quietEvidence" must be one of ${EVIDENCE_VALUES.join(", ")}`);
    } else if (evidence.quietRoom !== undefined && evidence.quietRoom !== input.quietEvidence) {
      c.add(`${path}.quietEvidence`, "conflicting_evidence", '"quietEvidence" conflicts with evidence.quietRoom');
    } else {
      evidence.quietRoom = input.quietEvidence;
    }
  }
  return evidence;
}

/**
 * Validate and normalise an execution.
 * Evidence for soft constraints may be supplied as `evidence: { key: value }`
 * and/or the `quietEvidence` shorthand (key "quietRoom"). Missing evidence is
 * NOT an error: it makes the clause UNVERIFIABLE (calibrated abstention).
 */
export function validateExecution(input, path = "execution") {
  const c = new Collector();
  if (!isPlainObject(input)) {
    c.add(path, "invalid_type", "execution must be a JSON object");
    return finish(c);
  }
  rejectUnknown(input, EXECUTION_FIELDS, path, c);

  const caseId = readId(input, "caseId", path, c, "EXE-ADHOC");
  const merchant = readText(input, "merchant", path, c);
  const price = readMoney(input, "price", path, c);
  const currency = readCurrency(input, path, c, undefined);
  const refundable = readBool(input, "refundable", path, c);
  const checkIn = readDate(input, "checkIn", path, c);
  const checkOut = readDate(input, "checkOut", path, c);
  if (checkIn && checkOut && checkIn > checkOut) {
    c.add(path, "inverted_dates", "checkIn must not be after checkOut");
  }
  const evidence = readEvidence(input, path, c);

  let softInfo = "";
  if (input.softInfo !== undefined) {
    softInfo = readText(input, "softInfo", path, c, { min: 0, max: LIMITS.maxSoftInfoLength }) ?? "";
  }

  const value = { caseId, merchant, price, refundable, checkIn, checkOut, evidence, softInfo };
  if (currency !== undefined) value.currency = currency;
  return finish(c, value);
}
