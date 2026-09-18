import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const PORT = Number(process.env.SMOKE_PORT || 3210);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "smoke-test-secret-only-for-ci-2028-with-32-chars";
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amazonas-radar-'));
const dbPath = path.join(root, 'civic_platform.db');
const productionRadarSource = fs.readFileSync(new URL("../src/server/productionRadarRoutes.ts", import.meta.url), "utf8");
const radarPageSource = fs.readFileSync(new URL("../src/pages/RadarTerritorial.tsx", import.meta.url), "utf8");
const endpoints = [
  "/api/radar/manaus/fontes",
  "/api/radar/manaus/bairros",
  "/api/radar/manaus/obras?status=PARALISADA",
  "/api/radar/manaus/equipamentos",
  "/api/radar/manaus/legislativo?ano=2026",
  "/api/radar/manaus/demandas",
  "/api/radar/manaus/resumo",
  "/api/radar/manaus/mapa/bairros",
  "/api/radar/manaus/externas",
  "/api/radar/manaus/indicadores-externos",
  "/api/radar/manaus/territorios",
];

// P0-D: esta suíte valida explicitamente o radar legado local/SQLite.
// Em produção Vercel, esses módulos permanecem fail-closed até sua migração
// específica para Postgres; portanto não devemos simular NODE_ENV=production aqui.
const server = spawn(process.execPath, ["dist-server/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(PORT),
    APP_ORIGIN: BASE,
    APP_URL: BASE,
    JWT_SECRET,
    CPF_PEPPER: 'radar-smoke-cpf-pepper-2026-with-32-characters',
    CIVIC_DB_PATH: dbPath,
    BACKUP_DIR: path.join(root, 'backups'),
    BACKUP_EXTERNAL_DIR: path.join(root, 'external'),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

function cookie(payload) {
  return `token=${jwt.sign(payload, JWT_SECRET, { expiresIn: "5m" })}`;
}

const adminCookie = cookie({ id: "smoke-admin", type: "admin", status: "ativo", perfil_acesso: "ADMIN" });
const citizenCookie = cookie({ id: "smoke-cidadao", type: "cidadao", status: "ativo" });
const legacyManagerCookie = cookie({ id: "smoke-legacy", type: "orgao", status: "aprovado", perfil_acesso: "GESTOR" });

async function request(pathname, authCookie) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    return await fetch(`${BASE}${pathname}`, { headers: authCookie ? { Cookie: authCookie } : {}, signal: controller.signal });
  } finally { clearTimeout(timeout); }
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status === 200) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Servidor não iniciou no prazo.\n${output}`);
}

function seedAdminAndDemand() {
  const db = new Database(dbPath);
  db.prepare("INSERT INTO admins (id, nome, email, password_hash, ativo) VALUES (?, ?, ?, ?, 1)")
    .run("smoke-admin", "Smoke Admin", "smoke-admin@example.org", "not-used-by-cookie-smoke");
  db.prepare("INSERT INTO demandas (id, protocolo, nome_solicitante, municipio, bairro, categoria, descricao, prioridade, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("smoke-demand", "AM-20260912-ABCDEF123456", "QA", "Manaus", "Centro", "Infraestrutura", "Demanda de teste", "ALTA", "CONCLUIDA");
  db.close();
}

function assertStatus(actual, expected, label) {
  if (!expected.includes(actual)) throw new Error(`${label}: esperado ${expected.join(" ou ")}, recebido ${actual}`);
}

async function main() {
  if (!productionRadarSource.includes('safeLoad(loadNeighborhoods, "bairros")')) {
    throw new Error("Diagnóstico territorial de produção deve carregar a base oficial de bairros.");
  }
  if (!productionRadarSource.includes('baseTerritorial: bairrosOficiais.length ? "geomanaus" : "demandas_fallback"')) {
    throw new Error("Diagnóstico territorial deve declarar GeoManaus como base e preservar fallback.");
  }
  if (!productionRadarSource.includes("const baseBairros = bairrosOficiais.length")) {
    throw new Error("Diagnóstico territorial deve partir dos bairros oficiais, não apenas das demandas existentes.");
  }
  if (!radarPageSource.includes("Nenhuma demanda registrada neste bairro até o momento")) {
    throw new Error("UI deve explicar explicitamente bairros sem demandas.");
  }
  if (!radarPageSource.includes("<title>{shape.bairro}</title>") || !radarPageSource.includes('aria-live="polite"')) {
    throw new Error("Mapa deve identificar bairros e anunciar a seleção de forma acessível.");
  }
  if (!radarPageSource.includes('data-bairro={shape.bairro || undefined}') || !radarPageSource.includes('onPointerUp={(event) => {')) {
    throw new Error("Mapa deve selecionar bairros por evento pointer delegado no SVG.");
  }
  if (!productionRadarSource.includes('classificados: features.filter') || !productionRadarSource.includes('bairro: featureNeighborhood(feature)')) {
    throw new Error("Payload do mapa deve enviar bairro normalizado explicitamente por feature.");
  }

  await waitForServer();
  seedAdminAndDemand();
  for (const endpoint of endpoints) {
    assertStatus((await request(endpoint)).status, [401], `anônimo ${endpoint}`);
    assertStatus((await request(endpoint, citizenCookie)).status, [403], `cidadão ${endpoint}`);
    assertStatus((await request(endpoint, legacyManagerCookie)).status, [403], `perfil legado ${endpoint}`);
  }

  for (const endpoint of ["/api/radar/manaus/fontes", "/api/radar/manaus/demandas", "/api/radar/manaus/externas", "/api/radar/manaus/indicadores-externos", "/api/radar/manaus/territorios"]) {
    assertStatus((await request(endpoint, adminCookie)).status, [200], `ADMIN ${endpoint}`);
  }

  const territorial = await (await request("/api/radar/manaus/territorios?bairro=Centro", adminCookie)).json();
  if (!Array.isArray(territorial.territorios) || territorial.territorios[0]?.bairro !== "Centro" || territorial.territorios[0]?.demandas !== 1) {
    throw new Error("Cruzamento territorial não preservou a demanda agregada do bairro Centro.");
  }

  const external = endpoints.filter((endpoint) => !endpoint.endsWith("/fontes") && !endpoint.endsWith("/demandas") && !endpoint.endsWith("/externas") && !endpoint.endsWith("/indicadores-externos") && !endpoint.endsWith("/territorios"));
  for (const endpoint of external) {
    const status = (await request(endpoint, adminCookie)).status;
    assertStatus(status, [200, 502], `ADMIN ${endpoint}`);
  }

  const db = new Database(dbPath);
  db.prepare("UPDATE admins SET ativo = 0 WHERE id = ?").run("smoke-admin");
  db.close();
  assertStatus((await request("/api/radar/manaus/fontes", adminCookie)).status, [403], "ADMIN desativado");
  console.log("Smoke Radar OK: perímetro ADMIN, cruzamento territorial e indicadores externos normalizados.");
}

try { await main(); }
catch (error) { console.error(error); console.error("\nSaída do servidor:\n", output); process.exitCode = 1; }
finally { server.kill("SIGTERM"); fs.rmSync(root, { recursive: true, force: true }); }
