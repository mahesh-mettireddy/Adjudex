import React from "react";
import { normalizeBaseUrl } from "../api/client.js";

const toggle = (on) =>
  `px-3 py-1.5 font-mono text-xs font-bold border ${
    on ? "bg-slate-100 text-slate-950 border-slate-100" : "bg-slate-950 text-slate-200 border-slate-500 hover:border-slate-200"
  }`;

/**
 * Local (in-browser) vs Server (HTTP) engine selector.
 * The API key here is the caller's Adjudex API key (ADJUDEX_API_KEYS), held in
 * memory only: never persisted, never logged, never put in the URL. The Gemini
 * key lives only in the server's .env and is never visible to the browser.
 */
export function ConnectionSettings({ connection, onChange, onCheck, status }) {
  const { mode, baseUrl, apiKey } = connection;
  const urlCheck = normalizeBaseUrl(baseUrl);
  const input =
    "w-full bg-slate-950 border border-slate-500 px-2 py-1.5 font-mono text-sm text-slate-100 focus:outline-none focus:border-slate-200";

  return (
    <div className="border border-slate-700 bg-slate-950 p-3 mb-3" aria-label="Connection settings">
      <div className="flex flex-wrap items-center gap-2 mb-2" role="group" aria-label="Engine mode">
        <span className="text-xs uppercase tracking-wider text-slate-400">Engine:</span>
        <button type="button" aria-pressed={mode === "local"} className={toggle(mode === "local")} onClick={() => onChange({ mode: "local" })}>
          Local (in browser)
        </button>
        <button type="button" aria-pressed={mode === "server"} className={toggle(mode === "server")} onClick={() => onChange({ mode: "server" })}>
          Server (HTTP API)
        </button>
        {status && (
          <span role="status" className={`font-mono text-xs ${status.ok ? "text-emerald-400" : "text-red-400"}`}>
            {status.text}
          </span>
        )}
      </div>

      {mode === "server" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="api-base" className="block text-xs text-slate-300 mb-1">API base URL (blank = same origin / dev proxy)</label>
            <input
              id="api-base"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              className={input}
              aria-invalid={!urlCheck.ok}
            />
            {!urlCheck.ok && <p role="alert" className="text-xs text-red-300 mt-1">{urlCheck.reason}</p>}
          </div>
          <div>
            <label htmlFor="api-key" className="block text-xs text-slate-300 mb-1">Adjudex API key (optional, kept in memory only)</label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value.trim() })}
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="button" onClick={onCheck} className="border border-slate-400 px-3 py-1.5 font-mono text-xs font-bold text-slate-100 hover:bg-slate-700">
              Check connection
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Calls run in this browser against an in-memory store. Nothing leaves the page.</p>
      )}
    </div>
  );
}
