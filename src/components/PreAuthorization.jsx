import React from "react";
import { ArrowRight, Ban, CheckCircle2, UserCheck } from "lucide-react";
import { Panel } from "./core.jsx";

const DECISIONS = {
  IN_MANDATE: {
    label: "ALLOW",
    description: "The proposed action satisfies every mandate rule.",
    Icon: CheckCircle2,
    className: "border-emerald-400 bg-emerald-500 text-slate-950",
  },
  OUT_OF_MANDATE: {
    label: "DENY",
    description: "The proposed action breaches one or more mandate rules.",
    Icon: Ban,
    className: "border-red-400 bg-red-600 text-white",
  },
  AMBIGUOUS_UNVERIFIABLE: {
    label: "REQUIRE HUMAN APPROVAL",
    description: "The action cannot be safely approved without better evidence.",
    Icon: UserCheck,
    className: "border-yellow-200 bg-yellow-400 text-slate-950",
  },
};

export function PreAuthorization({ result, execution }) {
  const decision = DECISIONS[result.verdict];
  const { Icon } = decision;

  return (
    <Panel
      id="authorization"
      title="Pre-authorization gate"
      icon={ArrowRight}
      right={<span className="font-mono text-xs text-slate-400">same rules · before payment</span>}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <div className="border border-slate-700 bg-slate-950 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Proposed action</div>
          <div className="font-bold text-slate-100">{execution.merchant}</div>
          <div className="font-mono text-sm text-slate-300">₹{Number(execution.price).toLocaleString("en-IN")} · {execution.refundable ? "refundable" : "non-refundable"}</div>
        </div>
        <div className="hidden md:flex items-center justify-center text-slate-500" aria-hidden="true">
          <ArrowRight className="w-6 h-6" />
        </div>
        <div className={`border-2 ${decision.className} p-3`}>
          <div className="flex items-center gap-2">
            <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">Policy decision</div>
              <div className="font-black text-lg leading-tight">{decision.label}</div>
            </div>
          </div>
          <p className="mt-2 text-sm">{decision.description}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Demo mapping: <span className="font-mono">IN_MANDATE → ALLOW</span> ·{" "}
        <span className="font-mono">OUT_OF_MANDATE → DENY</span> ·{" "}
        <span className="font-mono">AMBIGUOUS_UNVERIFIABLE → REQUIRE_HUMAN_APPROVAL</span>.
        The final execution is still recorded and independently adjudicated below.
      </p>
    </Panel>
  );
}
