import React from "react";
import { Copy, Download } from "lucide-react";

const btn =
  "flex items-center justify-center gap-2 border-2 border-slate-200 bg-slate-100 hover:bg-white text-slate-950 font-black px-4 py-2";

/** Progressive disclosure: technical details are collapsed by default. */
export function AuditDetails({ audit }) {
  return (
    <details className="border border-slate-600 bg-slate-900">
      <summary className="cursor-pointer px-4 py-2 text-sm font-bold uppercase tracking-wider text-slate-100 bg-slate-800">
        Audit details &amp; raw JSON
      </summary>
      <div className="p-4 space-y-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-slate-300">
          <div><dt className="inline text-slate-500">verdictId: </dt><dd className="inline">{audit.verdictId}</dd></div>
          <div><dt className="inline text-slate-500">engine: </dt><dd className="inline">{audit.engineVersion}</dd></div>
          <div><dt className="inline text-slate-500">ruleset: </dt><dd className="inline">{audit.rulesetVersion}</dd></div>
          <div><dt className="inline text-slate-500">evaluatedAt: </dt><dd className="inline">{audit.evaluatedAt}</dd></div>
          <div className="sm:col-span-2 break-all"><dt className="inline text-slate-500">inputHash: </dt><dd className="inline">{audit.inputHash}</dd></div>
        </dl>
        <pre aria-label="Raw audit JSON" className="max-h-96 overflow-auto border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200">
          {JSON.stringify(audit, null, 2)}
        </pre>
      </div>
    </details>
  );
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AuditActions({ audit, onNotice }) {
  const json = () => JSON.stringify(audit, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json());
      onNotice("Copied");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = json();
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        onNotice(ok ? "Copied" : "Copy failed: clipboard unavailable");
      } catch {
        onNotice("Copy failed: clipboard unavailable");
      }
    }
  };

  const save = () => {
    try {
      download(`${audit.verdictId}.audit.json`, json());
      onNotice("Download started");
    } catch {
      onNotice("Download failed in this browser");
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button type="button" onClick={copy} className={btn}>
        <Copy className="w-4 h-4" aria-hidden="true" /> Copy audit record (JSON)
      </button>
      <button type="button" onClick={save} className={btn}>
        <Download className="w-4 h-4" aria-hidden="true" /> Download audit JSON
      </button>
    </div>
  );
}
