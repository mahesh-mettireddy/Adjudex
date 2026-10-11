import React from "react";
import { parseMoney, fmtMoney } from "../engine/money.js";
import { ConstraintCard, Panel } from "./core.jsx";

function priceLabel(execution, currency) {
  const p = parseMoney(execution.price);
  return p.ok ? fmtMoney(p.minor, execution.currency || currency || "INR") : "invalid price";
}

export function RealityDiff({ audit, execution }) {
  return (
    <Panel
      id="diff"
      title="Reality Diff"
      right={
        <span className="font-mono text-xs text-slate-400">
          {String(execution.merchant ?? "?")} · {priceLabel(execution, audit.mandate?.currency)}
        </span>
      }
    >
      <div className="space-y-4">
        {audit.constraints.map((c) => (
          <ConstraintCard key={c.key} constraint={c} execution={execution} />
        ))}
      </div>
      <div className="mt-4 border border-slate-600 bg-slate-950 p-3 font-mono text-sm">
        <span className="text-slate-400">Liability → </span>
        <span className="font-bold text-slate-100">{audit.liability}</span>
        <span className="text-slate-500"> ({audit.liabilityCode})</span>
      </div>
    </Panel>
  );
}
