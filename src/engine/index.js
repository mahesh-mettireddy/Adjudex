// Public surface of the framework-independent Adjudex engine.
export * from "./constants.js";
export { parseMoney, minorToDecimal, fmtMoney, pctOver } from "./money.js";
export { sha256Hex, stableStringify } from "./hash.js";
export { isIsoDate, addDays, cleanText, merchantKey } from "./text.js";
export { validateMandate, validateExecution, parseJson, describeErrors } from "./validate.js";
export { evaluate, aggregateVerdict, verdictIdFor, inputHashFor, explain, evidenceFor } from "./evaluate.js";
export { adjudicate, adjudicateValidated, prepareInputs } from "./adjudicate.js";
export { SAMPLE_MANDATE, SAMPLES, getSample } from "./samples.js";
export { generateLocalCases, makeRng } from "./generate.js";
export { validateGeneratedCases, stripCodeFence } from "./generated.js";
