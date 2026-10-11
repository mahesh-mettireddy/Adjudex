import React from "react";
import { Timer } from "lucide-react";
import { LATENCY_BUDGET_MS } from "../engine/constants.js";
import { NAV } from "./meta.js";

export function StatusBar({ latencyMs, mode }) {
  const withinBudget = latencyMs <= LATENCY_BUDGET_MS;
  return (
    <div className="sticky top-0 z-20 border-b border-slate-600 bg-slate-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <nav aria-label="Sections" className="flex flex-wrap gap-1">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 font-mono text-xs text-slate-300" aria-label="Engine status">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" /> Engine online ({mode === "server" ? "server API" : "in-browser"})
          </span>
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" aria-hidden="true" />
            <span className={withinBudget ? "text-emerald-400" : "text-red-400"}>{latencyMs.toFixed(2)} ms</span>
            <span className="text-slate-500">/ {LATENCY_BUDGET_MS / 1000}s</span>
          </span>
        </div>
      </div>
    </div>
  );
}
