// Display metadata for verdicts and constraint statuses (UI only).
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export const SUBTITLE =
  "Adjudex compares the signed mandate with the actual execution, explains every rule, and abstains when evidence is insufficient.";

export const VERDICT_META = {
  IN_MANDATE: {
    headline: "IN MANDATE: Liability None",
    short: "IN MANDATE",
    Icon: ShieldCheck,
    box: "bg-emerald-500 border-emerald-300 text-slate-950",
    chip: "bg-emerald-500 text-slate-950",
    tag: "VERDICT · IN_MANDATE",
  },
  OUT_OF_MANDATE: {
    headline: "OUT OF MANDATE: Liability: Agent / Agent Provider",
    short: "OUT OF MANDATE",
    Icon: ShieldAlert,
    box: "bg-red-600 border-red-400 text-white",
    chip: "bg-red-600 text-white",
    tag: "VERDICT · OUT_OF_MANDATE",
  },
  AMBIGUOUS_UNVERIFIABLE: {
    headline: "Calibrated Abstention: Liability Unassigned.",
    short: "ABSTAIN",
    Icon: AlertTriangle,
    box: "bg-amber-400 border-amber-200 text-slate-950",
    chip: "bg-amber-400 text-slate-950",
    tag: "VERDICT · AMBIGUOUS_UNVERIFIABLE",
  },
};

export const STATUS_META = {
  MET: { Icon: CheckCircle2, border: "border-emerald-500", badge: "bg-emerald-500 text-slate-950", text: "text-emerald-400" },
  BREACHED: { Icon: XCircle, border: "border-red-500", badge: "bg-red-600 text-white", text: "text-red-400" },
  UNVERIFIABLE: { Icon: AlertTriangle, border: "border-yellow-400", badge: "bg-yellow-400 text-slate-950", text: "text-yellow-300" },
};

export const SUGGESTED_FIXES = {
  quietRoom:
    'Define "quiet" measurably: "Listing must state noise rating ≤ 40 dB or a verified quiet tag, and room must not be adjacent to a lift, elevator or kitchen."',
};

export const GENERIC_FIX =
  "Rewrite this clause as a measurable, enumerated or numeric condition with a named evidence source that can be checked automatically.";

export const NAV = [
  ["verdict", "Verdict"],
  ["cases", "Cases"],
  ["mandate", "Mandate"],
  ["diff", "Reality Diff"],
  ["api", "API"],
  ["impact", "Impact"],
];
