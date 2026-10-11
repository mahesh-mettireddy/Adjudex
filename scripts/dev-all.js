// Runs the API and the Vite dev server together (cross-platform, no deps).
import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: isWin });
const children = [run("node", ["server/index.js"]), run(isWin ? "npx.cmd" : "npx", ["vite"])];

const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", (code) => { stop(); process.exit(code ?? 0); }));
