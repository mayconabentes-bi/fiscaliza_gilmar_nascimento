// Isolated diagnostic: prove current shared-IP limit collisions before field rollout.
// No production traffic, Supabase credentials, real people or persistent QA data.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const port = 3258;
const base = `http://127.0.0.1:${port}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "fiscalize-field-qa-"));
const dbPath = path.join(root, "local-test-only.sqlite");
const env = {
  ...process.env,
  NODE_ENV: "test", PORT: String(port),
  APP_ORIGIN: base, APP_URL: base, CIVIC_DB_PATH: dbPath,
  DATABASE_URL: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "",
  JWT_SECRET: "isolated-field-qa-jwt-secret-2026-at-least-32-chars",
  DPO_CONTACT_EMAIL: "field-qa@example.invalid",
  LGPD_CONSENT_VERSION: "field-qa-local-v1",
  ENABLE_PUBLIC_REGISTRATION: "true", ENABLE_PUBLIC_DEMAND_INTAKE: "false",
  INTELLIGENCE_AUTO_REFRESH: "false",
  BACKUP_DIR: path.join(root, "backup"),
  BACKUP_EXTERNAL_DIR: path.join(root, "external"),
  EVIDENCE_DIR: path.join(root, "evidence"),
};
const server = spawn(process.execPath, ["dist-server/server.js"], {
  env, stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", b => { output += b.toString(); });
server.stderr.on("data", b => { output += b.toString(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function awaitReady() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).status === 200) return; }
    catch {}
    await delay(200);
  }
  throw new Error(`Local QA service unavailable; output: ${output.slice(-1200)}`);
}
async function post(endpoint, payload) {
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  return response.status;
}
function assertResults(results, successes, successCode, label) {
  const expected = [
    ...Array(successes).fill(successCode),
    ...Array(results.length - successes).fill(429),
  ];
  if (results.some((value, i) => value !== expected[i])) {
    throw new Error(`${label} unexpected statuses: ${JSON.stringify(results)}`);
  }
}
try {
  await awaitReady();
  // 50 independently identified synthetic staff, one shared NAT/IP.
  const password = "Only-Local-QA-Fake-Password-2026";
  const hash = bcrypt.hashSync(password, 4); // local-only fixture; never use in real accounts
  const db = new Database(dbPath);
  try {
    const insert = db.prepare("INSERT INTO admins (id, nome, email, password_hash, ativo) VALUES (?, ?, ?, ?, 1)");
    const batch = db.transaction(() => {
      for (let i = 0; i < 50; i++) {
        insert.run(randomUUID(), `Field QA ${i}`, `field-qa-staff-${i}@example.invalid`, hash);
      }
    });
    batch();
  } finally { db.close(); }
  const staffResults = [];
  for (let i = 0; i < 50; i++) {
    staffResults.push(await post("/api/auth/admin/login", {
      email: `field-qa-staff-${i}@example.invalid`, password,
    }));
  }
  assertResults(staffResults, 10, 200, "50 independent staff sharing one IP");
  // 15 synthetic citizens register on the very same connection, no personal data.
  const citizenResults = [];
  for (let i = 0; i < 15; i++) {
    citizenResults.push(await post("/api/auth/register/cidadao", {
      nome_completo: `FISCALIZE TESTE SINTETICO ${i}`,
      email: `field-qa-citizen-${i}@example.invalid`,
      password,
      municipio: "Manaus",
      bairro: "BAIRRO TESTE",
      faixa_etaria: "AGE_25_34",
      aceite_codigo: true,
      aceite_lgpd: true,
    }));
  }
  assertResults(citizenResults, 10, 201, "15 synthetic field registrations sharing one IP");
  console.log("FIELD_QA_DIAGNOSTIC=PASS: local app accurately reproduces launch block.");
  console.log("STAFF_SHARED_IP: 10 authenticated / 40 HTTP 429 of 50 synthetic accounts.");
  console.log("CITIZEN_SHARED_IP: 10 registered / 5 HTTP 429 of 15 synthetic accounts.");
  console.log("GO_LIVE_SHARED_NAT=BLOCKED until safe scoped limiter and repeat QA.");
} finally {
  server.kill("SIGTERM");
  fs.rmSync(root, { recursive: true, force: true });
}
