import { useCallback, useMemo, useRef, useState } from "react";
import { createApiClient, normalizeBaseUrl } from "../api/client.js";
import { createLocalApi } from "../api/local.js";

/**
 * Owns the Local-vs-Server engine selection. `generate()` always falls back to
 * the in-browser generator when asked (forceLocal), so demos survive a dead server.
 */
export function useConnection(mandateForGeneration) {
  const [connection, setConnection] = useState({ mode: "local", baseUrl: "", apiKey: "" });
  const [status, setStatus] = useState(null);
  const localApi = useRef(null);
  if (localApi.current === null) localApi.current = createLocalApi();

  const api = useMemo(
    () => (connection.mode === "server" ? createApiClient({ baseUrl: connection.baseUrl, apiKey: connection.apiKey }) : localApi.current),
    [connection]
  );

  const update = useCallback((patch) => {
    setConnection((c) => ({ ...c, ...patch }));
    setStatus(null);
  }, []);

  const check = useCallback(async () => {
    const base = normalizeBaseUrl(connection.baseUrl);
    if (!base.ok) {
      setStatus({ ok: false, text: base.reason });
      return;
    }
    setStatus({ ok: true, text: "Checking…" });
    const res = await api.health();
    setStatus(
      res.ok
        ? { ok: true, text: `Connected · engine ${res.data.engineVersion} · Gemini ${res.data.geminiConfigured ? "on" : "off"}` }
        : { ok: false, text: `${res.error.code}: ${res.error.message}` }
    );
  }, [api, connection.baseUrl]);

  const generate = useCallback(
    ({ scenario, count, forceLocal }) => {
      const target = forceLocal || connection.mode === "local" ? localApi.current : api;
      return target.generateCase({ scenario, count, forceLocal: forceLocal || undefined, mandate: mandateForGeneration });
    },
    [api, connection.mode, mandateForGeneration]
  );

  return { connection, status, api, update, check, generate };
}
