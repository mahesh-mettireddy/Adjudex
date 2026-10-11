import React, { useRef, useState } from "react";
import { Terminal, Play, Copy } from "lucide-react";
import { toCurl } from "../api/client.js";
import { Panel } from "./core.jsx";
import { VERDICT_META } from "./meta.js";
import { ConnectionSettings } from "./ConnectionSettings.jsx";

const btn =
  "flex items-center gap-1 border border-slate-400 px-3 py-1.5 font-mono text-xs font-bold text-slate-100 hover:bg-slate-700 disabled:opacity-50";

/**
 * Interactive console for the Adjudex API. `api` is either the in-browser
 * implementation or the HTTP client; both resolve to the same result shape.
 */
export function ApiConsole({ api, connection, onConnection, status, onCheck, mandate, execution, onNotice }) {
  const [last, setLast] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const lastVerdict = useRef(null);

  const actions = [
    { id: "health", method: "GET", path: "/api/health", run: () => api.health() },
    { id: "mandate", method: "POST", path: "/api/v1/mandates", body: { mandate }, run: () => api.createMandate(mandate) },
    { id: "execution", method: "POST", path: "/api/v1/executions", body: { execution }, run: () => api.createExecution(execution) },
    {
      id: "adjudicate",
      method: "POST",
      path: "/api/v1/adjudications",
      body: { mandateId: mandate.id, executionId: execution.caseId },
      run: () => api.adjudicate({ mandateId: mandate.id, executionId: execution.caseId }),
    },
    { id: "inline", label: "inline", method: "POST", path: "/api/v1/adjudications", body: { mandate, execution }, run: () => api.adjudicate({ mandate, execution }) },
    {
      id: "audit",
      method: "GET",
      path: `/api/v1/adjudications/${lastVerdict.current ?? "{verdictId}"}`,
      run: () => (lastVerdict.current ? api.getAdjudication(lastVerdict.current) : Promise.resolve({ ok: false, status: 0, error: { code: "no_verdict", message: "Run an adjudication first." } })),
    },
    { id: "case", method: "GET", path: `/api/v1/cases/${execution.caseId}`, run: () => api.getCase(execution.caseId) },
  ];

  const call = async (a) => {
    if (busy) return;
    setBusy(true);
    const t0 = performance.now();
    const res = await a.run();
    setBusy(false);
    setLast({ ...a, res, ms: Math.round(performance.now() - t0) });
    const audit = res.ok ? res.data.audit : null;
    if (audit) {
      lastVerdict.current = audit.verdictId;
      setLog((p) => [{ verdictId: audit.verdictId, verdict: audit.verdict, executionId: audit.execution.caseId, replayed: Boolean(res.data.replayed), at: audit.evaluatedAt }, ...p].slice(0, 50));
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(toCurl({ baseUrl: connection.baseUrl, path: last.path, body: last.body, withKey: Boolean(connection.apiKey) }));
      onNotice("Copied cURL");
    } catch {
      onNotice("Copy failed: clipboard unavailable");
    }
  };

  const bodyText = last ? JSON.stringify(last.res.ok ? last.res.data : { error: last.res.error }, null, 2) : "";

  return (
    <Panel id="api" title="Adjudex API console" icon={Terminal} right={<span className="font-mono text-xs text-slate-400">{connection.mode === "server" ? "HTTP server" : "in-browser"}</span>}>
      <ConnectionSettings connection={connection} onChange={onConnection} onCheck={onCheck} status={status} />
      <p className="text-xs text-slate-400 mb-3">
        Same contract locally and on the server. Repeating the same adjudication returns the same verdict ID with <span className="font-mono">replayed: true</span> (idempotent).
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {actions.map((a) => (
          <button key={a.id} type="button" disabled={busy} className={btn} onClick={() => call(a)}>
            <Play className="w-3 h-3" aria-hidden="true" /> {a.method} {a.path.replace(/\/[^/]*\{verdictId\}$/, "/:verdictId").replace(`/${execution.caseId}`, "/:caseId")}
            {a.label ? ` (${a.label})` : ""}
          </button>
        ))}
      </div>

      <div className="font-mono text-xs border border-slate-700 bg-slate-950 p-3 mb-3 overflow-x-auto">
        <div className="text-slate-400 mb-1">Active: {mandate.id} / {execution.caseId}</div>
        {last ? (
          <>
            <pre data-testid="api-response" className="text-slate-100 whitespace-pre-wrap break-all">
              {last.res.status || "ERR"} {last.method} {last.path} · {last.ms} ms{last.res.requestId ? ` · ${last.res.requestId}` : ""}
              {"\n"}
              {bodyText}
            </pre>
            <button type="button" onClick={copyCurl} className={`${btn} mt-2`}>
              <Copy className="w-3 h-3" aria-hidden="true" /> Copy as cURL
            </button>
          </>
        ) : (
          <span className="text-slate-500">No call yet. Press a button above.</span>
        )}
      </div>

      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Adjudication log</div>
      <ul className="font-mono text-xs border border-slate-700 divide-y divide-slate-800 max-h-48 overflow-y-auto" aria-label="Case log">
        {log.length === 0 && <li className="p-2 text-slate-500">Empty</li>}
        {log.map((e, i) => (
          <li key={`${e.verdictId}-${i}`} className="p-2 flex flex-wrap gap-x-3 text-slate-200">
            <span className="text-slate-500">{e.at}</span>
            <span>{e.executionId}</span>
            <span className={`${VERDICT_META[e.verdict].chip} px-1`}>{VERDICT_META[e.verdict].short}</span>
            <span className="text-slate-400">{e.verdictId}</span>
            {e.replayed && <span className="text-sky-300">replayed (idempotent)</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
