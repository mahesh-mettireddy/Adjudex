// Entry point: `npm run server`. Loads .env (if present) with Node's built-in
// loader (no dependency), then starts the API with graceful shutdown.

import { existsSync } from "node:fs";

if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch (err) {
    console.error("Could not read .env:", err.message);
    process.exit(1);
  }
}

const { createApp } = await import("./app.js");
const { config, server } = createApp();

if (!config.host.match(/^(127\.0\.0\.1|localhost|::1)$/) && config.apiKeys.length === 0) {
  console.warn("WARNING: listening on a non-loopback address with no ADJUDEX_API_KEYS set; /api/v1/* is open to anyone who can reach it.");
}

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(config.port, config.host, () => {
  const addr = server.address();
  console.log(`Adjudex API listening on http://${config.host}:${addr.port}`);
  console.log(`  Gemini: ${config.gemini.apiKey ? `enabled (${config.gemini.model})` : "not configured (local generator fallback)"}`);
  console.log(`  Auth:   ${config.apiKeys.length ? `${config.apiKeys.length} API key(s) required for /api/v1/*` : "open (local dev)"}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
