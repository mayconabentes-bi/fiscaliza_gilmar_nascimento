import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const PORT = Number(process.env.INTELLIGENCE_SMOKE_PORT || 3212);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "intelligence-smoke-secret-2026-with-more-than-32-chars";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "pulso-intelligence-"));
const dbPath = path.join(root, "civic_platform.db");

// P0-D: esta suíte cobre o motor legado local/SQLite. Em produção, o
// endpoint /api/intelligence fica fail-closed até a migração Postgres própria.
const server = spawn(process.execPath, ["dist-server/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(PORT),
    APP_ORIGIN: BASE,
    APP_URL: BASE,
    JWT_SECRET,
    CPF_PEPPER: "intelligence-smoke-cpf-pepper-2026-with-32-chars",
    CIVIC_DB_PATH: dbPath,
    BACKUP_DIR: path.join(root, "backups"),
    BACKUP_EXTERNAL_DIR: path.join(root, "external"),
    INTELLIGENCE_AUTO_REFRESH: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

function cookie(payload) { return `token=${jwt.sign(payload, JWT_SECRET, { expiresIn: "5m" })}`; }
const adminCookie = cookie({ id: "intelligence-admin", type: "admin", status: "ativo", perfil_acesso: "ADMIN" });
const citizenCookie = cookie({ id: "intelligence-citizen", type: "cidadao", status: "ativo" });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/health`)).status === 200) return; } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não iniciou.\n${output}`);
}

async function request(pathname, authCookie) {
  return fetch(`${BASE}${pathname}`, { headers: authCookie ? { Cookie: authCookie } : {} });
}

function assert(actual, expected, label) {
  if (!expected.includes(actual)) throw new Error(`${label}: esperado ${expected.join("/")}, recebido ${actual}`);
}

try {
  await waitForServer();
  const db = new Database(dbPath);
  db.prepare("INSERT INTO admins (id, nome, email, password_hash, ativo) VALUES (?, ?, ?, ?, 1)").run("intelligence-admin", "Intelligence Admin", "intelligence-admin@example.org", "unused");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'intelligence_%'").all().map((row) => row.name);
  for (const table of ["intelligence_source_health", "intelligence_snapshots", "intelligence_refresh_runs"]) {
    if (!tables.includes(table)) throw new Error(`Schema intelligence não inicializado: ${table}.`);
  }

  const insertSnapshot = db.prepare(`
    INSERT INTO intelligence_snapshots (metric, territory, period, value, source_keys, methodology, collected_at)
    VALUES (?, 'MANAUS', ?, ?, ?, ?, ?)
  `);
  insertSnapshot.run("obras", "2026-09-11", 300, '["seminf_obras"]', "Teste determinístico", "2026-09-11T12:00:00.000Z");
  insertSnapshot.run("obras", "2026-09-12", 306, '["seminf_obras"]', "Teste determinístico", "2026-09-12T12:00:00.000Z");
  db.close();

  for (const endpoint of ["/api/intelligence/trends", "/api/intelligence/compare?bairros=Centro,Adrianopolis", "/api/intelligence/sources/health", "/api/intelligence/insights"]) {
    assert((await request(endpoint)).status, [401], `anônimo ${endpoint}`);
    assert((await request(endpoint, citizenCookie)).status, [403], `cidadão ${endpoint}`);
  }

  assert((await request("/api/intelligence/trends", adminCookie)).status, [200], "ADMIN trends");
  assert((await request("/api/intelligence/compare?bairros=Centro", adminCookie)).status, [400], "compare exige dois bairros");

  const insightsResponse = await request("/api/intelligence/insights", adminCookie);
  assert(insightsResponse.status, [200], "ADMIN insights");
  const insights = await insightsResponse.json();
  if (!insights.hasComparison || insights.currentPeriod !== "2026-09-12" || insights.previousPeriod !== "2026-09-11") {
    throw new Error("Insights não retornaram os dois snapshots esperados.");
  }
  const obras = insights.changes.find((item) => item.metric === "obras");
  if (!obras || obras.current !== 306 || obras.previous !== 300 || obras.delta !== 6) {
    throw new Error("Delta de obras incorreto no contrato de insights.");
  }

  console.log("Smoke Intelligence OK: schema, RBAC, histórico e insights determinísticos validados.");
} catch (error) {
  console.error(error);
  console.error("\nSaída do servidor:\n", output);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  fs.rmSync(root, { recursive: true, force: true });
}
