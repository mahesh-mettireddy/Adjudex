import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, FlaskConical } from "lucide-react";
import { GENERATION_SCENARIOS, LIMITS } from "../engine/constants.js";
import { SAMPLES } from "../engine/samples.js";
import { Panel } from "./core.jsx";
import { GeneratedList, GenerationError, GenerationMeta, btnCls } from "./GeneratedResults.jsx";

/**
 * Sample library + random case generation.
 * `onGenerate({scenario, count, forceLocal})` resolves to an API result
 * ({ok, data|error}); this component only renders it. AI output is never
 * shown as a success unless the API reports a validated result.
 */
export function CasesPanel({ activeId, onLoadExecution, onGenerate, serverMode }) {
  const [scenario, setScenario] = useState("mixed");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [generation, setGeneration] = useState(null);
  const [cases, setCases] = useState([]);
  const ticket = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (forceLocal) => {
    if (busy) return;
    const mine = ++ticket.current;
    setBusy(true);
    setError(null);
    const res = await onGenerate({ scenario, count, forceLocal });
    if (!mounted.current || mine !== ticket.current) return; // stale / unmounted
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGeneration(res.data.generation);
    setCases(res.data.cases);
  };

  const field = "bg-slate-950 border border-slate-500 px-2 py-1.5 font-mono text-sm text-slate-100";

  return (
    <Panel
      id="cases"
      title="Sample cases & generator"
      icon={FlaskConical}
      right={<span className="font-mono text-xs text-slate-400">Demo mode · no login</span>}
    >
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Sample library</div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Sample cases">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={activeId === s.id}
            onClick={() => onLoadExecution(s.execution, s.id)}
            className={`${btnCls} ${activeId === s.id ? "bg-slate-100 !text-slate-950" : ""}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Generate random cases</div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label htmlFor="gen-scenario" className="block text-xs text-slate-300 mb-1">Scenario</label>
          <select id="gen-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)} className={field}>
            {GENERATION_SCENARIOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gen-count" className="block text-xs text-slate-300 mb-1">Count (max {LIMITS.maxGenerateCount})</label>
          <input
            id="gen-count"
            type="number"
            min="1"
            max={LIMITS.maxGenerateCount}
            value={count}
            onChange={(e) => setCount(Math.min(LIMITS.maxGenerateCount, Math.max(1, Math.trunc(Number(e.target.value)) || 1)))}
            className={`w-20 ${field}`}
          />
        </div>
        <button type="button" onClick={() => run(false)} disabled={busy} className={`${btnCls} border-sky-300 bg-sky-500 !text-slate-950 hover:bg-sky-400`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
          {busy ? "Generating…" : "Generate random case"}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        {serverMode
          ? "Server mode: Gemini drafts the execution data; the verdict always comes from the deterministic engine."
          : "Local mode: cases come from the seeded in-browser generator (no AI, no network)."}
      </p>

      {error && <GenerationError error={error} busy={busy} onLocal={() => run(true)} />}
      {generation && <GenerationMeta generation={generation} />}
      {cases.length > 0 && <GeneratedList cases={cases} onLoad={(c) => onLoadExecution(c.execution, c.execution.caseId)} />}
    </Panel>
  );
}
