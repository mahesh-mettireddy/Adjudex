import React from "react";
import { Scale, Sparkles, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

const primary = "flex items-center justify-center gap-2 border-2 px-4 py-3 text-base md:text-lg font-black transition-colors disabled:opacity-60";

/** First screen: states the product in seconds and offers the three primary actions. */
export function Hero({ onClean, onBreach, onGenerate, generating }) {
  return (
    <header className="border-b-2 border-slate-600 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="border-2 border-slate-300 p-1.5">
            <Scale className="w-7 h-7 text-slate-100" aria-hidden="true" />
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight">
            Adjudex <span className="text-slate-400 font-bold">: Agentic Commerce Adjudication Engine</span>
          </h1>
          <span className="ml-auto font-mono text-xs font-bold border border-sky-300 text-sky-300 px-2 py-0.5">DEMO MODE</span>
        </div>
        <p className="mt-5 text-3xl md:text-5xl font-black leading-tight">
          When an AI spends money,
          <br />
          who is liable?
        </p>
        <p className="text-sm md:text-base text-slate-300 mt-3 max-w-3xl">
          Adjudex compares the signed mandate with the actual execution, explains every rule, and abstains when evidence is
          insufficient.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
          <button type="button" onClick={onClean} className={`${primary} bg-emerald-500 border-emerald-300 text-slate-950 hover:bg-emerald-400`}>
            <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Run clean case
          </button>
          <button type="button" onClick={onBreach} className={`${primary} bg-red-600 border-red-400 text-white hover:bg-red-500`}>
            <ShieldAlert className="w-5 h-5" aria-hidden="true" /> Try a breach
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className={`${primary} bg-slate-950 border-slate-400 text-slate-100 hover:border-slate-100`}
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Sparkles className="w-5 h-5" aria-hidden="true" />}
            Generate random case
          </button>
        </div>
      </div>
    </header>
  );
}
