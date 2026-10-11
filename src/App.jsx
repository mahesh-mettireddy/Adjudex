import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { prepareInputs, adjudicateValidated } from "./engine/adjudicate.js";
import { SAMPLE_MANDATE, getSample } from "./engine/samples.js";
import { describeErrors } from "./engine/validateShared.js";
import { useConnection } from "./hooks/useConnection.js";
import { ActorFlow, CheckabilityCard, ImpactCard, MandatePanel, VerdictBanner } from "./components/core.jsx";
import { ApiConsole } from "./components/ApiConsole.jsx";
import { AuditActions, AuditDetails } from "./components/AuditPanel.jsx";
import { CasesPanel } from "./components/CasesPanel.jsx";
import { CustomCasePanel } from "./components/CustomCasePanel.jsx";
import { Hero } from "./components/Hero.jsx";
import { RealityDiff } from "./components/RealityDiff.jsx";
import { StatusBar } from "./components/StatusBar.jsx";
import { PreAuthorization } from "./components/PreAuthorization.jsx";

const clean = getSample("clean");
const breach = getSample("breach");

export default function App() {
  const [mandate, setMandate] = useState(SAMPLE_MANDATE);
  const [activeId, setActiveId] = useState(clean.id);
  const [execution, setExecution] = useState(clean.execution);
  const [toast, setToast] = useState("");
  const [heroBusy, setHeroBusy] = useState(false);

  // Deterministic engine: the verdict is always computed here or on the server, never by AI.
  // Valid input is normalised exactly as the API does; invalid input makes rules abstain.
  const { prepared, audit, latencyMs } = useMemo(() => {
    const t0 = performance.now();
    const p = prepareInputs(mandate, execution);
    const a = adjudicateValidated(p.mandate, p.execution);
    return { prepared: p, audit: a, latencyMs: performance.now() - t0 };
  }, [mandate, execution]);

  const conn = useConnection(prepared.mandate);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const notice = useCallback((m) => setToast(m), []);
  const loadExecution = useCallback((exec, id) => {
    setExecution(exec);
    setActiveId(id);
  }, []);

  const heroGenerate = async () => {
    if (heroBusy) return;
    setHeroBusy(true);
    const res = await conn.generate({ scenario: "mixed", count: 1 });
    setHeroBusy(false);
    if (!res.ok) {
      setToast(`Generation failed: ${res.error.message}`);
      return;
    }
    const first = res.data.cases[0];
    loadExecution(first.execution, first.execution.caseId);
    const fb = res.data.generation.fallback;
    setToast(fb?.used && fb.reason !== "offline" ? `Generated locally: ${fb.message}` : "Generated a random case");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <StatusBar latencyMs={latencyMs} mode={conn.connection.mode} />
      <Hero
        onClean={() => loadExecution(clean.execution, clean.id)}
        onBreach={() => loadExecution(breach.execution, breach.id)}
        onGenerate={heroGenerate}
        generating={heroBusy}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {!prepared.valid && (
          <div role="alert" className="flex items-start gap-2 border border-yellow-400 bg-yellow-400/10 p-3 text-sm text-yellow-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>Input is not fully valid, so affected rules abstain instead of guessing: {describeErrors(prepared.errors)}</span>
          </div>
        )}

        <VerdictBanner result={audit} caseId={String(prepared.execution.caseId ?? "")} latencyMs={latencyMs} />
        <ActorFlow result={audit} mandate={prepared.mandate} execution={prepared.execution} />
        <PreAuthorization result={audit} execution={prepared.execution} />
        <AuditDetails audit={audit} />

        <CasesPanel activeId={activeId} onLoadExecution={loadExecution} onGenerate={conn.generate} serverMode={conn.connection.mode === "server"} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <MandatePanel mandate={mandate} setMandate={setMandate} />
            <CheckabilityCard mandate={prepared.mandate} />
          </div>
          <RealityDiff audit={audit} execution={prepared.execution} />
        </div>

        <ApiConsole
          api={conn.api}
          connection={conn.connection}
          onConnection={conn.update}
          status={conn.status}
          onCheck={conn.check}
          mandate={prepared.mandate}
          execution={prepared.execution}
          onNotice={notice}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <CustomCasePanel isActive={activeId === "custom"} onApply={(exec) => loadExecution(exec, "custom")} />
          <ImpactCard verdict={audit.verdict} />
        </div>
      </main>

      <footer className="border-t-2 border-slate-600 bg-slate-900 mt-6">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <AuditActions audit={audit} onNotice={notice} />
          <p className="font-mono text-xs text-slate-400">
            A deterministic control and audit layer for AI agents that spend money · AI never decides the verdict
          </p>
        </div>
      </footer>

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 max-w-sm flex items-center gap-2 border-2 border-emerald-300 bg-emerald-500 text-slate-950 font-bold px-4 py-2 shadow-lg">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  );
}
