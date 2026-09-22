import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const telemedicineRoot = resolve(repoRoot, "apps/telemedicine");
const patientRoot = resolve(telemedicineRoot, "packages/patient-portal");
const surface = process.argv[2];

if (!["health", "emr", "pharmacy", "command-center", "telemedicine"].includes(surface)) {
  throw new Error("Choose one deployment: health, emr, pharmacy, command-center, or telemedicine.");
}

function run(label, script, args, cwd, env = {}) {
  if (!existsSync(script)) throw new Error(`${label} dependencies are missing. Install them before building: ${script}`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const typeScript = resolve(repoRoot, "node_modules/typescript/bin/tsc");
const vite = resolve(repoRoot, "node_modules/vite/bin/vite.js");
const output = resolve(repoRoot, `dist-${surface}`);
const patientVite = resolve(telemedicineRoot, "node_modules/vite/bin/vite.js");

if (surface === "telemedicine") {
  if (!existsSync(patientVite)) {
    throw new Error("Telemedicine dependencies are missing. Run: npm ci --prefix apps/telemedicine");
  }
  const healthOrigin = process.env.VITE_SABI_HEALTH_URL?.trim().replace(/\/$/, "");
  run("Telemedicine", patientVite, ["build", "--base", "/", "--outDir", output, "--emptyOutDir"], patientRoot, {
    VITE_HOSPITAL_ONBOARDING_URL: process.env.VITE_HOSPITAL_ONBOARDING_URL || (healthOrigin ? `${healthOrigin}/register/organization` : "/register/organization"),
  });
  console.log(`Prepared ${surface} deployment in ${output}`);
  process.exit(0);
}

run("Root", typeScript, ["-b", "--pretty", "false"], repoRoot);
run("Root", vite, ["build", "--outDir", output], repoRoot, {
  VITE_DEPLOYMENT_SURFACE: surface,
  VITE_TELEMEDICINE_SIGN_IN_URL: process.env.VITE_TELEMEDICINE_SIGN_IN_URL || (process.env.VITE_SABI_TELEMEDICINE_URL ? `${process.env.VITE_SABI_TELEMEDICINE_URL.trim().replace(/\/$/, "")}/login` : "/telemedicine/login"),
});

if (surface === "health") {
  if (!existsSync(patientVite)) {
    throw new Error("Telemedicine dependencies are missing. Run: npm ci --prefix apps/telemedicine");
  }
  mkdirSync(output, { recursive: true });
  run("Telemedicine", patientVite, ["build", "--base", "/telemedicine/", "--outDir", resolve(output, "telemedicine"), "--emptyOutDir"], patientRoot, {
    VITE_HOSPITAL_ONBOARDING_URL: process.env.VITE_HOSPITAL_ONBOARDING_URL || "/register/organization",
  });
}

console.log(`Prepared ${surface} deployment in ${output}`);
