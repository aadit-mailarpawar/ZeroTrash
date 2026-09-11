import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function startDevServer(cwd) {
  const options = { cwd, stdio: "inherit" };
  return process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run dev"], options)
    : spawn("npm", ["run", "dev"], options);
}

const children = [
  startDevServer(path.join(root, "backend")),
  startDevServer(root),
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
