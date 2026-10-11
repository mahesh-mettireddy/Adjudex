import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { VERDICT_META } from "./meta.js";

export const btnCls =
  "flex items-center gap-2 border border-slate-400 px-3 py-1.5 text-sm font-bold text-slate-100 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed";

export function GenerationError({ error, busy, onLocal }) {
  return (
    <div role="alert" className="mb-3 border border-red-500 bg-red-500/10 p-3 text-sm text-red-300">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-bold">Generation failed ({error.code})</div>
          <div>{error.message}</div>
          <div className="text-xs text-slate-400 mt-1">Samples above still work. You can use the local generator instead.</div>
        </div>
      </div>
      <button type="button" onClick={onLocal} disabled={busy} className={`${btnCls} mt-2`}>
        Generate locally instead
      </button>
    </div>
  );
}

export function GenerationMeta({ generation }) {
  return (
    <div aria-label="Generation metadata" className="mb-3 border border-slate-600 bg-slate-950 p-2 font-mono text-xs text-slate-300">
      <div className="flex items-center gap-1 text-slate-400 mb-1">
        <Info className="w-3 h-3" aria-hidden="true" /> Generation metadata (not part of the verdict)
      </div>
      generator: {generation.generator}
      {generation.model && ` · model: ${generation.model}`}
      {generation.promptVersion && ` · prompt: ${generation.promptVersion}`}
      {typeof generation.latencyMs === "number" && ` · ${generation.latencyMs} ms`}
      {` · validation: ${generation.validation}`}
      {generation.fallback?.used && <div className="text-yellow-300 mt-1">Fallback: {generation.fallback.message}</div>}
    </div>
  );
}

export function GeneratedList({ cases, onLoad }) {
  return (
    <ul className="space-y-2" aria-label="Generated cases">
      {cases.map((c) => {
        const meta = VERDICT_META[c.audit.verdict];
        return (
          <li key={c.execution.caseId} className="flex flex-wrap items-center justify-between gap-2 border border-slate-700 bg-slate-950 p-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-100 truncate">{c.name}</div>
              <div className="font-mono text-xs text-slate-400">
                {c.execution.caseId} · {c.execution.merchant} · {c.intendedScenario}
              </div>
              {c.intentMatched === false && (
                <div className="text-xs text-yellow-300">
                  Generator missed its target scenario; the engine verdict is still authoritative.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold px-2 py-0.5 ${meta.chip}`}>{meta.short}</span>
              <button type="button" className={btnCls} onClick={() => onLoad(c)}>
                Load
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
