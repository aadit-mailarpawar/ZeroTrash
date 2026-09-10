import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(command, ["run", "dev"], { cwd: path.join(root, "backend"), stdio: "inherit" }),
  spawn(command, ["run", "dev"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

for (const child of children) child.on("exit", (code) => { if (!stopping && code) stop(code); });
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
