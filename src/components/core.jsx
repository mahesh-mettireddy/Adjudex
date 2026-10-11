import React, { useMemo, useState } from "react";
import {
  Gauge, Lock, Check, Clock, X, Plus, Lightbulb, Calculator, Zap, User, Bot, Cpu, UserCheck, ArrowRight,
} from "lucide-react";
import { scoreCheckability } from "../engine/checkability.js";
import { SAMPLE_MANDATE } from "../engine/samples.js";
import { LATENCY_BUDGET_MS, LIMITS } from "../engine/constants.js";
import { cleanText, merchantKey } from "../engine/text.js";
import { VERDICT_META, STATUS_META, SUGGESTED_FIXES, GENERIC_FIX } from "./meta.js";

const MANDATE = SAMPLE_MANDATE;

/* ============================================================
   COMPONENTS
   ============================================================ */

export function Panel({ id, title, icon: Icon, children, right }) {
  return (
    <section id={id} className="border border-slate-600 bg-slate-900 scroll-mt-24">
      <div className="flex items-center justify-between gap-2 border-b border-slate-600 bg-slate-800 px-4 py-2">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-100">
          {Icon && <Icon className="w-4 h-4 text-slate-300" aria-hidden="true" />}
          {title}
        </h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function VerdictBanner({ result, caseId, latencyMs }) {
  const { verdict, constraints, verdictId } = result;
  const meta = VERDICT_META[verdict];
  const { Icon } = meta;
  const met = constraints.filter((c) => c.status === "MET").length;
  const breached = constraints.filter((c) => c.status === "BREACHED").length;
  const unver = constraints.filter((c) => c.status === "UNVERIFIABLE");
  const unverLabels = unver.map((c) => `'${c.label}'`).join(", ");

  return (
    <section id="verdict" aria-live="polite" className="scroll-mt-24">
      <div className={`border-2 ${meta.box} px-5 py-6 md:px-8 md:py-8`}>
        <div className="flex items-start gap-4">
          <Icon className="w-12 h-12 md:w-16 md:h-16 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <div>
            <div className="font-mono text-xs md:text-sm font-bold tracking-widest opacity-80">{meta.tag}</div>
            <h2 className="text-2xl md:text-4xl font-black leading-tight">
              {meta.headline}
              {verdict === "AMBIGUOUS_UNVERIFIABLE" && (
                <span className="block text-lg md:text-2xl font-bold mt-2">
                  {unver.length > 1 ? "Constraints" : "Constraint"} {unverLabels} {unver.length > 1 ? "were" : "was"}{" "}
                  never defined precisely enough to check.
                </span>
              )}
            </h2>
          </div>
        </div>
      </div>
      {result.explanation && (
        <p className="border-x-2 border-b border-slate-700 bg-slate-900 px-5 py-2 text-sm text-slate-200">{result.explanation}</p>
      )}
      <div className="border-x-2 border-b-2 border-slate-700 bg-slate-900 px-5 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-sm">
        <span className="text-slate-100">
          <span className="text-emerald-400">{met} met</span> · <span className="text-red-400">{breached} breached</span>{" "}
          · <span className="text-yellow-300">{unver.length} unverifiable</span>
        </span>
        <span className="text-slate-400 flex flex-wrap gap-x-4">
          <span>
            Case ID: <span className="text-slate-100 font-bold">{caseId}</span>
          </span>
          <span title="Same mandate + execution always yields the same verdict ID (idempotent)">{verdictId}</span>
          {latencyMs !== null && (
            <span>
              {latencyMs.toFixed(2)} ms / {LATENCY_BUDGET_MS / 1000}s budget
            </span>
          )}
        </span>
      </div>
    </section>
  );
}

export function ActorFlow({ result, mandate, execution }) {
  const ambiguous = result.verdict === "AMBIGUOUS_UNVERIFIABLE";
  const steps = [
    { Icon: User, role: "Principal", done: true, line: `Signed ${mandate.id}` },
    { Icon: Bot, role: "Shopping Agent", done: true, line: `${execution.caseId} · ${execution.merchant}` },
    { Icon: Cpu, role: "Adjudex", done: true, line: VERDICT_META[result.verdict].short },
    { Icon: UserCheck, role: "Reviewer", done: ambiguous, line: ambiguous ? "Human review required" : "Not needed" },
  ];
  return (
    <section aria-label="Adjudication pipeline" className="border border-slate-600 bg-slate-900">
      <ol className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-700">
        {steps.map((s, i) => (
          <li key={s.role} className="flex items-center gap-3 p-3 bg-slate-900">
            <s.Icon className={`w-6 h-6 shrink-0 ${s.done ? "text-slate-100" : "text-slate-600"}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1">
                {i + 1}. {s.role}
              </div>
              <div className={`font-mono text-xs truncate ${s.done ? "text-slate-100" : "text-slate-500"}`}>
                {s.line}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CheckabilityCard({ mandate }) {
  const { clauses, overall } = useMemo(() => scoreCheckability(mandate), [mandate]);
  const tone = (s) =>
    s >= 80
      ? { bar: "bg-emerald-500", text: "text-emerald-400", tag: "CHECKABLE" }
      : s >= 50
      ? { bar: "bg-yellow-400", text: "text-yellow-300", tag: "PARTIAL" }
      : { bar: "bg-red-500", text: "text-red-400", tag: "VAGUE" };
  const o = tone(overall);

  return (
    <Panel title="Mandate Checkability Score" icon={Gauge}>
      <p className="text-sm font-bold text-slate-100 mb-3">
        Vague mandates create unassignable liability. Fix the mandate, not the dispute.
      </p>
      <div className="flex items-end justify-between border border-slate-600 bg-slate-950 p-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400">Overall</div>
          <div className={`font-mono text-3xl font-black ${o.text}`}>{overall}/100</div>
        </div>
        <span className={`font-mono text-xs font-bold border px-2 py-1 ${o.text} border-current`}>{o.tag}</span>
      </div>
      <ul className="space-y-3">
        {clauses.map((c) => {
          const t = tone(c.score);
          return (
            <li key={c.id} className="border border-slate-700 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-100">{c.label}</span>
                <span className={`font-mono text-sm font-bold ${t.text}`}>{c.score}</span>
              </div>
              <div
                className="h-2 bg-slate-800 mt-2"
                role="progressbar"
                aria-label={c.label}
                aria-valuenow={c.score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={`h-2 ${t.bar} transition-all duration-300`} style={{ width: `${c.score}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2">{c.reason}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function MandatePanel({ mandate, setMandate }) {
  const [newMerchant, setNewMerchant] = useState("");

  const modified =
    Number(mandate.maxPricePerNight) !== Number(MANDATE.maxPricePerNight) ||
    mandate.refundableRequired !== MANDATE.refundableRequired ||
    mandate.allowedMerchants.join("|") !== MANDATE.allowedMerchants.join("|") ||
    mandate.stayWindow.checkIn !== MANDATE.stayWindow.checkIn ||
    mandate.stayWindow.checkOut !== MANDATE.stayWindow.checkOut;

  const [merchantError, setMerchantError] = useState("");

  const addMerchant = () => {
    const r = cleanText(newMerchant);
    if (!r.ok) {
      setMerchantError(newMerchant.trim() === "" ? "" : `Merchant ${r.reason}.`);
      return;
    }
    if (mandate.allowedMerchants.some((x) => merchantKey(x) === merchantKey(r.value))) {
      setMerchantError(`"${r.value}" is already on the list.`);
      return;
    }
    if (mandate.allowedMerchants.length >= LIMITS.maxMerchants) {
      setMerchantError(`At most ${LIMITS.maxMerchants} merchants are allowed.`);
      return;
    }
    setMerchantError("");
    setNewMerchant("");
    setMandate((prev) => ({ ...prev, allowedMerchants: [...prev.allowedMerchants, r.value] }));
  };
  const removeMerchant = (m) =>
    setMandate((prev) => ({ ...prev, allowedMerchants: prev.allowedMerchants.filter((x) => x !== m) }));
  const setWindow = (k, v) => setMandate((prev) => ({ ...prev, stayWindow: { ...prev.stayWindow, [k]: v } }));

  const inputCls =
    "w-full bg-slate-950 border border-slate-500 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-slate-200";
  const labelCls = "block text-xs uppercase tracking-wider text-slate-300 mb-1";

  return (
    <Panel
      id="mandate"
      title="Open Mandate (Signed)"
      icon={Lock}
      right={
        <span className="flex items-center gap-1 font-mono text-xs font-bold bg-emerald-500 text-slate-950 px-2 py-0.5">
          <Check className="w-3 h-3" aria-hidden="true" /> Signed
        </span>
      }
    >
      <div className="font-mono text-sm space-y-1 border border-slate-700 bg-slate-950 p-3 mb-4">
        <div className="text-slate-100 font-bold">{mandate.id}</div>
        <div className="text-slate-400 flex items-center gap-1 flex-wrap">
          <Clock className="w-3 h-3" aria-hidden="true" /> Signed by {mandate.signedBy} · {mandate.signedAt}
        </div>
        <div className="text-slate-400 break-all">sig: {mandate.signatureHash}</div>
      </div>

      <p className="text-xs text-slate-400">Edit constraints below; the engine re-evaluates live.</p>
      {modified && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-yellow-300 border border-yellow-400/60 bg-yellow-400/10 px-2 py-1">
          <span>What-if mode: differs from the signed original.</span>
          <button
            type="button"
            onClick={() => setMandate(MANDATE)}
            className="border border-yellow-400 px-2 py-0.5 font-bold hover:bg-yellow-400 hover:text-slate-950"
          >
            Reset to signed
          </button>
        </div>
      )}

      <div className="space-y-4 mt-4">
        <div>
          <label htmlFor="maxPrice" className={labelCls}>
            price_cap · Max price per night ({mandate.currency}) · hard
          </label>
          <input
            id="maxPrice"
            type="number"
            min="0"
            max={LIMITS.maxMoneyUnits}
            step="0.01"
            value={mandate.maxPricePerNight}
            onChange={(e) => {
              const n = Number(e.target.value);
              const safe = Number.isFinite(n) ? Math.min(LIMITS.maxMoneyUnits, Math.max(0, n)) : 0;
              setMandate((prev) => ({ ...prev, maxPricePerNight: safe }));
            }}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="winIn" className={labelCls}>
              date_range · Check-in from · hard
            </label>
            <input id="winIn" type="date" value={mandate.stayWindow.checkIn} onChange={(e) => setWindow("checkIn", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="winOut" className={labelCls}>
              Check-out by
            </label>
            <input id="winOut" type="date" value={mandate.stayWindow.checkOut} onChange={(e) => setWindow("checkOut", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-between border border-slate-700 bg-slate-950 px-3 py-2">
          <span id="refLabel" className="text-sm text-slate-100">
            refundable_required · <span className="text-xs uppercase text-slate-400">hard</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mandate.refundableRequired}
            aria-labelledby="refLabel"
            onClick={() => setMandate((prev) => ({ ...prev, refundableRequired: !prev.refundableRequired }))}
            className={`font-mono text-xs font-bold px-3 py-1 border ${
              mandate.refundableRequired
                ? "bg-emerald-500 text-slate-950 border-emerald-300"
                : "bg-slate-800 text-slate-300 border-slate-500"
            }`}
          >
            {mandate.refundableRequired ? "ON" : "OFF"}
          </button>
        </div>

        <div>
          <div className={labelCls}>allowed_merchants · hard</div>
          <ul className="flex flex-wrap gap-2 mb-2" aria-label="Allowed merchants">
            {mandate.allowedMerchants.length === 0 && (
              <li className="text-xs text-yellow-300 font-mono">Empty allow-list: every merchant will breach.</li>
            )}
            {mandate.allowedMerchants.map((m) => (
              <li key={m} className="flex items-center gap-1 border border-slate-500 bg-slate-950 pl-2 font-mono text-sm text-slate-100">
                {m}
                <button
                  type="button"
                  aria-label={`Remove ${m}`}
                  onClick={() => removeMerchant(m)}
                  className="p-1.5 text-slate-300 hover:text-red-400"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Add merchant"
              placeholder="Add merchant"
              value={newMerchant}
              maxLength={LIMITS.maxTextLength}
              onChange={(e) => setNewMerchant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMerchant();
              }}
              className={inputCls}
            />
            <button
              type="button"
              onClick={addMerchant}
              className="flex items-center gap-1 border border-slate-400 px-3 font-bold text-sm text-slate-100 hover:bg-slate-700"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add
            </button>
          </div>
          {merchantError && (
            <p role="alert" className="mt-1 text-xs font-mono text-red-300">
              {merchantError}
            </p>
          )}
        </div>

        <div>
          <div className={labelCls}>soft_constraint · natural language</div>
          <ul className="space-y-2">
            {mandate.softConstraints.map((sc) => (
              <li key={sc.key} className="border border-yellow-400/60 bg-yellow-400/10 px-3 py-2 text-sm text-slate-100">
                "{sc.label}"
                <span className="block text-xs text-yellow-300 font-mono mt-1">Unstructured; checkable only with evidence.</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export function ConstraintCard({ constraint, execution }) {
  const s = STATUS_META[constraint.status];
  const { Icon } = s;
  return (
    <article className={`border-2 ${s.border} bg-slate-900`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-700 bg-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`w-6 h-6 ${s.text}`} aria-hidden="true" />
          <h4 className="font-bold text-slate-100">{constraint.label}</h4>
          <span className="font-mono text-[10px] uppercase border border-slate-500 text-slate-300 px-1.5 py-0.5">
            {constraint.type}
          </span>
          <span className="font-mono text-[10px] border border-slate-600 text-slate-400 px-1.5 py-0.5">
            {constraint.ctype}
          </span>
        </div>
        <span className={`font-mono text-xs font-black px-2 py-1 ${s.badge}`}>{constraint.status}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-700">
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Mandate</div>
          <div className="font-mono text-sm text-slate-100 break-words">{constraint.expected}</div>
        </div>
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Executed</div>
          <div className={`font-mono text-sm font-bold break-words ${s.text}`}>{constraint.actual}</div>
        </div>
      </div>

      <div className="border-t border-slate-700 px-4 py-2 flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.text}`} aria-hidden="true" />
        <p className={`font-mono text-sm ${s.text}`}>{constraint.detail}</p>
      </div>

      {constraint.status === "UNVERIFIABLE" && (
        <div className="border-t border-slate-700 p-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Agent's evidence</div>
            <p className="font-mono text-sm text-slate-200 border border-slate-700 bg-slate-950 p-2">
              {execution.softInfo ? `"${execution.softInfo}"` : "(no evidence text supplied)"}
            </p>
          </div>
          <div className="border border-yellow-400 bg-yellow-400/10 p-3">
            <div className="flex items-center gap-2 text-yellow-300 font-bold text-sm mb-1">
              <Lightbulb className="w-4 h-4" aria-hidden="true" /> Suggested mandate fix
            </div>
            <p className="text-sm text-slate-100">{SUGGESTED_FIXES[constraint.key] || GENERIC_FIX}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export function ImpactCard({ verdict }) {
  const [disputes, setDisputes] = useState(5000);
  const [minutes, setMinutes] = useState(30);
  const [ambiguousPct, setAmbiguousPct] = useState(20);

  const pct = Math.min(100, Math.max(0, ambiguousPct));
  const autoShare = 100 - pct;
  const autoCases = Math.round((disputes * autoShare) / 100);
  const hoursSaved = (disputes * (autoShare / 100) * minutes) / 60;
  const fmt = (n) => Math.round(n).toLocaleString("en-IN");

  const field = (id, label, value, setter, extra = {}) => (
    <div>
      <label htmlFor={id} className="block text-xs uppercase tracking-wider text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        value={value}
        onChange={(e) => setter(Math.max(0, Number(e.target.value) || 0))}
        className="w-full bg-slate-950 border border-slate-500 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-slate-200"
        {...extra}
      />
    </div>
  );

  return (
    <Panel id="impact" title="Illustrative impact estimate" icon={Calculator}>
      <p className="text-xs font-bold text-yellow-300 border border-yellow-400/60 bg-yellow-400/10 px-2 py-1 mb-3">
        Illustrative assumptions: edit to match your data. Not a measured result.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {field("disputes", "Disputes / month", disputes, setDisputes)}
        {field("minutes", "Avg manual review (min)", minutes, setMinutes)}
        {field("ambPct", "% ambiguous (human review)", ambiguousPct, setAmbiguousPct, { max: 100 })}
      </div>
      <div className="border border-slate-600 bg-slate-950 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-400">Analyst-hours saved per month</div>
        <div className="font-mono text-4xl font-black text-emerald-400">{fmt(hoursSaved)} h</div>
        <p className="font-mono text-xs text-slate-400 mt-2">
          {fmt(autoCases)} of {fmt(disputes)} disputes auto-adjudicable ({autoShare}%: IN_MANDATE + OUT_OF_MANDATE) ·
          AMBIGUOUS cases still routed to a human. Assumes auto-adjudicated cases need ~0 manual review minutes.
        </p>
        <p className="font-mono text-xs text-slate-300 mt-1">
          Current case routing: {verdict === "AMBIGUOUS_UNVERIFIABLE" ? "human review" : "auto-adjudicable"}
        </p>
      </div>
    </Panel>
  );
}
