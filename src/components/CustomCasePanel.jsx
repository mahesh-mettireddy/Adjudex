import React, { useState } from "react";
import { FileJson, XCircle, Zap } from "lucide-react";
import { validateExecution } from "../engine/validateExecution.js";
import { parseJson } from "../engine/validateShared.js";
import { LIMITS } from "../engine/constants.js";
import { Panel } from "./core.jsx";

const EXAMPLE = JSON.stringify(
  {
    merchant: "MakeMyTrip",
    price: 7500,
    currency: "INR",
    refundable: true,
    checkIn: "2026-11-14",
    checkOut: "2026-11-16",
    quietEvidence: "absent",
    softInfo: "Listing never mentions noise.",
  },
  null,
  2
);

const MAX_CHARS = 20_000;

/** Paste any execution as JSON; it is validated with the same rules as the API. */
export function CustomCasePanel({ onApply, isActive }) {
  const [text, setText] = useState(EXAMPLE);
  const [errors, setErrors] = useState([]);

  const apply = () => {
    if (text.length > MAX_CHARS) {
      setErrors([`Input is too long (max ${MAX_CHARS} characters).`]);
      return;
    }
    const parsed = parseJson(text);
    if (!parsed.ok) {
      setErrors([parsed.error]);
      return;
    }
    const v = validateExecution({ caseId: "EXE-CUSTOM", ...(parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value) ? parsed.value : { __invalid: true }) });
    if (!v.ok) {
      setErrors(v.errors.map((e) => `${e.path}: ${e.message}`));
      return;
    }
    setErrors([]);
    onApply(v.value);
  };

  return (
    <Panel
      title="Custom case"
      icon={FileJson}
      right={isActive && <span className="font-mono text-xs font-bold bg-sky-500 text-slate-950 px-2 py-0.5">ACTIVE</span>}
    >
      <p className="text-xs text-slate-400 mb-2">
        Paste an execution as JSON. Required: <span className="font-mono">merchant, price, refundable, checkIn, checkOut</span>. Optional:{" "}
        <span className="font-mono">caseId, currency, quietEvidence, evidence, softInfo</span>. Unknown fields are rejected.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        maxLength={MAX_CHARS + 1000}
        spellCheck={false}
        aria-label="Custom execution JSON"
        className="w-full bg-slate-950 border border-slate-500 p-3 font-mono text-sm text-slate-100 focus:outline-none focus:border-slate-200"
      />
      {errors.length > 0 && (
        <div role="alert" className="mt-2 border border-red-500 bg-red-500/10 p-2 text-sm text-red-300">
          <ul className="space-y-1">
            {errors.slice(0, LIMITS.maxSoftConstraints + 5).map((e) => (
              <li key={e} className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {e}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={apply}
        className="mt-3 flex items-center gap-2 border border-sky-300 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2"
      >
        <Zap className="w-4 h-4" aria-hidden="true" /> Evaluate custom case
      </button>
    </Panel>
  );
}
