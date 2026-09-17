import "dotenv/config";
import { spawnSync } from "node:child_process";

const REQUIRED_ADMIN_ENV = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_NAME"] as const;
process.env.NODE_ENV = "development";

const configured = REQUIRED_ADMIN_ENV.filter((name) => Boolean(process.env[name]?.trim()));
if (configured.length > 0) {
  const missing = REQUIRED_ADMIN_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(`Dev admin: configuração incompleta. Variáveis ausentes: ${missing.join(", ")}.`);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", "src/scripts/create_admin.ts"], {
    env: { ...process.env, NODE_ENV: "development" },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) {
    console.error("Dev admin: não foi possível executar o provisionamento privado.");
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
} else {
  console.log("Dev admin: nenhuma conta privada configurada no .env; seguindo sem provisionamento.");
}

await import("../../server.js");
