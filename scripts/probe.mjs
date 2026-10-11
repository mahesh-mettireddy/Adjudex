// Black-box probe of a running Adjudex API.
// Usage: node scripts/probe.mjs http://127.0.0.1:8787 [apiKeyA] [apiKeyB]
// Prints one line per scenario. Exit code 1 on any failure.
const [base = "http://127.0.0.1:8787", keyA, keyB] = process.argv.slice(2);

const mandate = {
  id: "MND-PROBE",
  maxPricePerNight: 8000,
  allowedMerchants: ["OYO"],
  refundableRequired: true,
  stayWindow: { checkIn: "2026-11-14", checkOut: "2026-11-16" },
};
const execution = { merchant: "oyo", price: "8000.00", refundable: true, checkIn: "2026-11-14", checkOut: "2026-11-16" };
const good = JSON.stringify({ mandate, execution });
const authA = keyA ? { Authorization: `Bearer ${keyA}` } : {};
const authB = keyB ? { "X-API-Key": keyB } : {};
const withExec = (patch) => JSON.stringify({ mandate, execution: { ...execution, ...patch } });
const ADJ = "/api/v1/adjudications";

let failures = 0;
async function call(method, path, body, headers = {}) {
  try {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, json, text, headers: res.headers };
  } catch (err) {
    return { status: 0, json: null, text: String(err.message), headers: new Headers() };
  }
}
function check(name, res, status, code) {
  const actual = `${res.status}${res.json?.error?.code ? ` ${res.json.error.code}` : ""}`;
  const want = `${status}${code ? ` ${code}` : ""}`;
  const pass = actual === want;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(34)} -> ${actual}${pass ? "" : `   (expected ${want})`}`);
}

const secured = Boolean(keyA);
if (secured) {
  check("no key", await call("POST", ADJ, good), 401, "unauthorized");
  check("wrong key", await call("POST", ADJ, good, { Authorization: "Bearer nope" }), 401, "unauthorized");
}
const first = await call("POST", ADJ, good, authA);
check("valid adjudication", first, 201);
const again = await call("POST", ADJ, good, authA);
check("identical replay", again, 200);
console.log(`      replayed=${again.json?.replayed} sameId=${first.json?.audit?.verdictId === again.json?.audit?.verdictId} verdict=${first.json?.audit?.verdict}`);

check("malformed JSON", await call("POST", ADJ, "{bad", authA), 400, "invalid_json");
check("empty body", await call("POST", ADJ, "", authA), 400, "empty_body");
check("array body", await call("POST", ADJ, "[]", authA), 400, "invalid_body");
check("unknown top-level field", await call("POST", ADJ, JSON.stringify({ mandate, execution, verdict: "IN_MANDATE" }), authA), 422, "validation_failed");
check("__proto__ pollution attempt", await call("POST", ADJ, `{"__proto__":{"x":1},"mandate":${JSON.stringify(mandate)},"execution":${JSON.stringify(execution)}}`, authA), 422, "validation_failed");
check("negative price", await call("POST", ADJ, withExec({ price: -5 }), authA), 422, "validation_failed");
check("3-decimal price", await call("POST", ADJ, withExec({ price: "1.005" }), authA), 422, "validation_failed");
check("impossible date", await call("POST", ADJ, withExec({ checkIn: "2026-02-30" }), authA), 422, "validation_failed");
check("HTML in merchant", await call("POST", ADJ, withExec({ merchant: "<script>x</script>" }), authA), 422, "validation_failed");
check("mixed inline + by-reference", await call("POST", ADJ, JSON.stringify({ mandate, execution, mandateId: "a" }), authA), 400, "ambiguous_request");
check("oversize body", await call("POST", ADJ, JSON.stringify({ x: "a".repeat(200000) }), authA), 413, "payload_too_large");
check("wrong content type", await call("POST", ADJ, good, { ...authA, "Content-Type": "text/plain" }), 415, "unsupported_media_type");
check("wrong method", await call("DELETE", ADJ, undefined, authA), 405, "method_not_allowed");
check("unknown route", await call("GET", "/api/nope"), 404, "not_found");
check("path traversal id", await call("GET", `${ADJ}/..%2F..%2Fetc%2Fpasswd`, undefined, authA), 400, "invalid_id");
check("unknown verdict id", await call("GET", `${ADJ}/VRD-doesnotexist`, undefined, authA), 404, "audit_not_found");

check("health is public", await call("GET", "/api/health"), 200);
check("demo is public (local)", await call("POST", "/api/demo/generate-case", JSON.stringify({ forceLocal: true })), 200);
check("demo rejects bad scenario", await call("POST", "/api/demo/generate-case", JSON.stringify({ scenario: "hack" })), 422, "validation_failed");

check("store mandate", await call("POST", "/api/v1/mandates", JSON.stringify({ mandate }), authA), 201);
check("store mandate again (replay)", await call("POST", "/api/v1/mandates", JSON.stringify({ mandate }), authA), 200);
check("same id, different content", await call("POST", "/api/v1/mandates", JSON.stringify({ mandate: { ...mandate, maxPricePerNight: 1 } }), authA), 409, "conflict");
if (secured && keyB) {
  check("tenant B cannot see A's mandate", await call("POST", ADJ, JSON.stringify({ mandateId: "MND-PROBE", executionId: "x" }), authB), 404, "mandate_not_found");
}
const rid = await call("GET", "/api/health", undefined, { "X-Request-Id": "probe-request-1" });
const ridOk = rid.headers.get("x-request-id") === "probe-request-1";
if (!ridOk) failures++;
console.log(`${ridOk ? "PASS" : "FAIL"}  request id echoed                  -> ${rid.headers.get("x-request-id")}`);
if (keyA && [first.text, again.text].join("").includes(keyA)) {
  failures++;
  console.log("FAIL  API key leaked in a response body");
}
console.log(failures ? `\n${failures} FAILED` : "\nall probes passed");
process.exit(failures ? 1 : 0);
