import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REQUIRED_ADMIN_ENV = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_NAME"] as const;
const configured = REQUIRED_ADMIN_ENV.filter((name) => Boolean(process.env[name]?.trim()));

if (configured.length === 0) {
  console.log("Bootstrap admin: nenhuma conta privada configurada; seguindo sem provisionamento.");
  process.exit(0);
}

const missing = REQUIRED_ADMIN_ENV.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Bootstrap admin: configuração incompleta. Variáveis ausentes: ${missing.join(", ")}.`);
  process.exit(1);
}

const scriptPath = fileURLToPath(new URL("./create_admin.js", import.meta.url));
const result = spawnSync(process.execPath, [scriptPath], {
  env: process.env,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  console.error("Bootstrap admin: não foi possível executar o provisionamento privado.");
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Bootstrap admin: provisionamento falhou com código ${result.status ?? "desconhecido"}.`);
  process.exit(result.status ?? 1);
}

console.log("Bootstrap admin: conta privada configurada e validada.");
