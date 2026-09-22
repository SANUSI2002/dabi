import { spawn } from "node:child_process";

// On Windows, spawning npm.cmd directly can fail with EINVAL on newer Node
// releases. npm exposes the JavaScript CLI used to launch this script, so run
// that through the current Node executable instead.
const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const npmArgs = (args) => (npmCli ? [npmCli, ...args] : args);
const processes = [
  spawn(npmCommand, npmArgs(["run", "dev:main"]), { stdio: "inherit" }),
  spawn(npmCommand, npmArgs(["run", "dev:telemedicine"]), { stdio: "inherit" }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (!stopping && code !== 0) stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
