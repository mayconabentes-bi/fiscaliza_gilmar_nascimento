import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const PORT = Number(process.env.PUBLIC_JOURNEY_PORT || 3250);
const BASE = `http://127.0.0.1:${PORT}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "fiscalize-public-journey-"));
const dbPath = path.join(root, "civic_platform.db");
const evidenceDir = path.join(root, "evidence");
const JWT_SECRET = "public-journey-runtime-secret-2026-with-32-chars";

const server = spawn(process.execPath, ["dist-server/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(PORT),
    APP_ORIGIN: BASE,
    APP_URL: BASE,
    JWT_SECRET,
    CIVIC_DB_PATH: dbPath,
    EVIDENCE_DIR: evidenceDir,
    BACKUP_DIR: path.join(root, "backups"),
    BACKUP_EXTERNAL_DIR: path.join(root, "external"),
    DPO_CONTACT_EMAIL: "privacidade-runtime@fiscalize.local",
    LGPD_CONSENT_VERSION: "runtime-journey-v1",
    ENABLE_PUBLIC_REGISTRATION: "true",
    ENABLE_PUBLIC_DEMAND_INTAKE: "true",
    INTERNAL_PILOT_MODE: "false",
    INTELLIGENCE_AUTO_REFRESH: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

function expectStatus(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não iniciou no prazo.\n${output}`);
}

async function jsonRequest(pathname, init = {}) {
  const response = await fetch(`${BASE}${pathname}`, init);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  return { response, body };
}

try {
  await waitForServer();

  const registrationPayload = {
    nome_completo: "QA Jornada Pública",
    email: "qa-jornada@example.org",
    municipio: "Manaus",
    bairro: "Centro",
    password: "Senha-QA-2026!",
    faixa_etaria: "AGE_18_PLUS",
    aceite_codigo: true,
    aceite_lgpd: true,
  };

  const registration = await jsonRequest("/api/auth/register/cidadao", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify(registrationPayload),
  });
  expectStatus(registration.response.status, 201, "cadastro cidadão");
  if (!registration.body?.id) throw new Error("Cadastro não retornou id.");

  const badLogin = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: registrationPayload.email, password: "senha-incorreta", type: "cidadao" }),
  });
  expectStatus(badLogin.response.status, 401, "login inválido");

  const login = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: registrationPayload.email, password: registrationPayload.password, type: "cidadao" }),
  });
  expectStatus(login.response.status, 200, "login cidadão");
  if (login.body?.user?.type !== "cidadao") throw new Error("Login não retornou identidade cidadã.");

  const setCookie = login.response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie.startsWith("token=")) throw new Error("Login não definiu cookie de sessão.");

  const session = await jsonRequest("/api/auth/session", {
    headers: { Cookie: cookie },
  });
  expectStatus(session.response.status, 200, "sessão autenticada");
  if (session.body?.authenticated !== true || session.body?.user?.email !== registrationPayload.email) {
    throw new Error("Sessão autenticada não corresponde ao cidadão cadastrado.");
  }

  const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==";
  const privateDescription = "Descrição privada QA que não pode aparecer na consulta pública.";
  const privateContact = "qa-contato-privado@example.org";
  const demand = await jsonRequest("/api/demandas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      Cookie: cookie,
    },
    body: JSON.stringify({
      nome_solicitante: registrationPayload.nome_completo,
      contato: privateContact,
      municipio: "Manaus",
      bairro: "Centro",
      categoria: "Infraestrutura",
      descricao: privateDescription,
      prioridade: "ALTA",
      faixa_etaria: "AGE_18_PLUS",
      aviso_privacidade_aceito: true,
      src: "qa",
      acao: "runtime",
      foto_evidencias_base64: Array.from({ length: 7 }, () => photo),
    }),
  });
  expectStatus(demand.response.status, 201, "registro de demanda com 7 fotos");
  if (!demand.body?.id || !/^AM-\d{8}-[A-F0-9]{16}$/.test(String(demand.body?.protocolo || ""))) {
    throw new Error("Demanda não retornou protocolo válido.");
  }
  if (demand.body?.status !== "RECEBIDA") throw new Error("Demanda deve iniciar como RECEBIDA.");

  const db = new Database(dbPath, { readonly: true });
  const storedDemand = db.prepare(
    "SELECT usuario_id, evidencia_foto_path, evidencia_moderacao_status FROM demandas WHERE id = ?"
  ).get(demand.body.id);
  const storedUser = db.prepare(
    "SELECT consentimento_lgpd, versao_consentimento FROM usuarios WHERE id = ?"
  ).get(registration.body.id);
  db.close();

  if (storedDemand?.usuario_id !== registration.body.id) {
    throw new Error("Demanda autenticada não foi vinculada ao cidadão.");
  }
  if (!storedDemand?.evidencia_foto_path || storedDemand?.evidencia_moderacao_status !== "PENDENTE") {
    throw new Error("Evidência local não foi persistida como pendente.");
  }
  if (storedUser?.consentimento_lgpd !== 1 || storedUser?.versao_consentimento !== "runtime-journey-v1") {
    throw new Error("Consentimento LGPD não foi persistido com a versão ativa.");
  }

  const evidenceFiles = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).filter((name) => name.startsWith(`${demand.body.id}-`))
    : [];
  if (evidenceFiles.length !== 7) {
    throw new Error(`Esperadas 7 evidências locais, encontradas ${evidenceFiles.length}.`);
  }

  const protocolResponse = await fetch(`${BASE}/api/demandas/protocolo/${encodeURIComponent(demand.body.protocolo)}`);
  expectStatus(protocolResponse.status, 200, "consulta pública por protocolo");
  const protocolRaw = await protocolResponse.text();
  const protocolBody = JSON.parse(protocolRaw);
  if (protocolBody?.demanda?.protocolo !== demand.body.protocolo) throw new Error("Consulta retornou protocolo divergente.");
  if (!Array.isArray(protocolBody?.historico) || protocolBody.historico[0]?.status_novo !== "RECEBIDA") {
    throw new Error("Consulta pública não retornou histórico real inicial.");
  }
  for (const forbiddenField of ["descricao", "contato", "bairro", "nome_solicitante", "usuario_id", "evidencia_foto_path"]) {
    if (Object.prototype.hasOwnProperty.call(protocolBody.demanda || {}, forbiddenField)) {
      throw new Error(`Consulta pública expôs campo privado: ${forbiddenField}`);
    }
  }
  if (protocolRaw.includes(privateDescription) || protocolRaw.includes(privateContact)) {
    throw new Error("Consulta pública vazou conteúdo privado da demanda.");
  }

  const missingProtocol = await jsonRequest("/api/demandas/protocolo/AM-20000101-0000000000000000");
  expectStatus(missingProtocol.response.status, 404, "protocolo inexistente");

  const privateMetrics = await jsonRequest("/api/demandas/metricas");
  expectStatus(privateMetrics.response.status, 401, "métricas privadas sem autenticação administrativa");

  const logout = await jsonRequest("/api/auth/logout", {
    method: "POST",
    headers: { origin: BASE, Cookie: cookie },
  });
  expectStatus(logout.response.status, 200, "logout cidadão");
  if (!/token=;/.test(logout.response.headers.get("set-cookie") || "")) {
    throw new Error("Logout não limpou o cookie de sessão.");
  }

  const anonymousSession = await jsonRequest("/api/auth/session");
  expectStatus(anonymousSession.response.status, 401, "sessão anônima após logout");

  console.log("Public journey runtime OK: cadastro, login, sessão, 7 fotos, protocolo privado por desenho e logout.");
} catch (error) {
  console.error(error);
  console.error("\nSaída do servidor:\n", output);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  fs.rmSync(root, { recursive: true, force: true });
}
