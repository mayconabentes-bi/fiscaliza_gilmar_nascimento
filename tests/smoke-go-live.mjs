import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const PORT = Number(process.env.GO_LIVE_SMOKE_PORT || 3220);
const BASE = `http://127.0.0.1:${PORT}`;
const APP_ORIGIN = BASE;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amazonas-go-live-'));
const dbPath = path.join(root, 'civic_platform.db');
const backupDir = path.join(root, 'backups');
const externalDir = path.join(root, 'external');
const JWT_SECRET = 'go-live-smoke-jwt-secret-2026-with-32-chars';

// Este smoke valida o modo local/compatibilidade SQLite. O contrato de produção
// Vercel + Postgres/Supabase é validado separadamente por test:p0d.
const server = spawn(process.execPath, ['dist-server/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(PORT),
    APP_ORIGIN,
    APP_URL: APP_ORIGIN,
    JWT_SECRET,
    CIVIC_DB_PATH: dbPath,
    BACKUP_DIR: backupDir,
    BACKUP_EXTERNAL_DIR: externalDir,
    DPO_CONTACT_EMAIL: 'privacidade-qa@fiscalize.local',
    LGPD_CONSENT_VERSION: 'qa-consent-v1',
    ENABLE_PUBLIC_REGISTRATION: 'true',
    ENABLE_PUBLIC_DEMAND_INTAKE: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status === 200) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não iniciou.\n${output}`);
}

function expectStatus(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
}

async function main() {
  await waitForServer();
  expectStatus((await fetch(`${BASE}/health`)).status, 200, 'health local');

  const readyResponse = await fetch(`${BASE}/ready`);
  expectStatus(readyResponse.status, 200, 'ready local');
  const ready = await readyResponse.json();
  if (ready.database !== 'sqlite-local') throw new Error(`ready local deveria reportar sqlite-local, recebeu ${ready.database}`);

  const noConsent = await fetch(`${BASE}/api/auth/register/cidadao`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
    body: JSON.stringify({ aceite_lgpd: false, aceite_codigo: true })
  });
  expectStatus(noConsent.status, 400, 'LGPD obrigatório');

  const payload = {
    nome_completo: 'QA Participante', email: 'qa@example.org',
    municipio: 'Manaus', bairro: 'Centro', password: 'Senha-QA-123!',
    aceite_lgpd: true, aceite_codigo: true
  };
  const registration = await fetch(`${BASE}/api/auth/register/cidadao`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: APP_ORIGIN }, body: JSON.stringify(payload)
  });
  expectStatus(registration.status, 201, 'cadastro local seguro');

  const blockedDemand = await fetch(`${BASE}/api/demandas`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
    body: JSON.stringify({ nome_solicitante: 'QA', municipio: 'Manaus', categoria: 'Teste', descricao: 'Teste de gate' })
  });
  expectStatus(blockedDemand.status, 503, 'intake público desabilitado');

  const db = new Database(dbPath, { readonly: true });
  const user = db.prepare('SELECT nome_completo, email, municipio, bairro, consentimento_lgpd, versao_consentimento FROM usuarios WHERE email = ?').get(payload.email);
  const userColumns = db.prepare('PRAGMA table_info(usuarios)').all().map((column) => column.name);
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  const journal = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
  db.close();

  if (!user || user.consentimento_lgpd !== 1 || user.versao_consentimento !== 'qa-consent-v1') throw new Error('Metadados LGPD locais não persistidos.');
  for (const forbidden of ['cpf_hash', 'rg', 'organizacao_civil']) {
    if (userColumns.includes(forbidden)) throw new Error(`Schema local ainda coleta campo desnecessário: ${forbidden}`);
  }
  if (foreignKeys !== 1) throw new Error('foreign_keys não está ativo na conexão local.');
  if (journal !== 'wal') throw new Error(`journal_mode esperado WAL, recebido ${journal}`);

  console.log('Smoke local OK: health/readiness SQLite, LGPD, intake gate e compatibilidade local endurecida.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  console.error('\nSaída do servidor:\n', output);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  fs.rmSync(root, { recursive: true, force: true });
}
