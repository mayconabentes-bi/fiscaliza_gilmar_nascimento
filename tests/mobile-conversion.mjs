import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const PORT = 3240;
const BASE = `http://127.0.0.1:${PORT}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-mobile-'));
const dbPath = path.join(root, 'civic.db');
const evidenceDir = path.join(root, 'evidence');
const server = spawn(process.execPath, ['dist-server/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'test', PORT: String(PORT), APP_ORIGIN: BASE, APP_URL: BASE,
    JWT_SECRET: 'mobile-conversion-jwt-secret-2026-strong-value',
    CIVIC_DB_PATH: dbPath, EVIDENCE_DIR: evidenceDir,
    BACKUP_EXTERNAL_DIR: path.join(root, 'external'), BACKUP_DIR: path.join(root, 'backup'),
    DPO_CONTACT_EMAIL: 'privacidade-mobile@fiscalize.local', LGPD_CONSENT_VERSION: 'mobile-qa-v1',
    ENABLE_PUBLIC_REGISTRATION: 'false', INTERNAL_PILOT_MODE: 'false', ENABLE_PUBLIC_DEMAND_INTAKE: 'true',
  }, stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
server.stdout.on('data', c => output += c.toString()); server.stderr.on('data', c => output += c.toString());

async function wait() {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); }
  throw new Error(`Servidor não iniciou\n${output}`);
}
function expect(actual, expected, label) { if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`); }

try {
  await wait();
  const config = await (await fetch(`${BASE}/api/public-config`)).json();
  if (!config.publicDemandIntake || !config.photoEvidence || config.privacyNoticeVersion !== 'mobile-qa-v1') throw new Error('Config pública não refletiu flags/privacidade.');

  expect((await fetch(`${BASE}/api/mobile-events`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ event: 'qr_landing', src: 'flyer', acao: 'centro-01' }) })).status, 204, 'evento agregado local');

  const noPrivacy = await fetch(`${BASE}/api/demandas`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ nome_solicitante: 'QA', municipio: 'Manaus', categoria: 'Infraestrutura', descricao: 'Teste' }) });
  expect(noPrivacy.status, 400, 'privacidade pública obrigatória');

  const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  const demand = await fetch(`${BASE}/api/demandas`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ nome_solicitante: 'QA Mobile', contato: '', municipio: 'Manaus', bairro: 'Centro', categoria: 'Infraestrutura', descricao: 'Demanda QA mobile', prioridade: 'MEDIA', aviso_privacidade_aceito: true, src: 'flyer', acao: 'centro-01', foto_evidencia_base64: photo }) });
  expect(demand.status, 201, 'demanda pública local');
  const body = await demand.json();

  await new Promise(r => setTimeout(r, 100));
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT evidencia_foto_path, evidencia_moderacao_status FROM demandas WHERE id = ?').get(body.id);
  const landing = db.prepare("SELECT total FROM mobile_funil_agregado WHERE evento='qr_landing' AND src='flyer' AND acao='centro-01'").get();
  const submitted = db.prepare("SELECT total FROM mobile_funil_agregado WHERE evento='form_submit' AND src='flyer' AND acao='centro-01'").get();
  db.close();
  if (!row?.evidencia_foto_path || !fs.existsSync(path.join(evidenceDir, row.evidencia_foto_path))) throw new Error('Evidência fotográfica local não persistida.');
  if (row.evidencia_moderacao_status !== 'PENDENTE') throw new Error('Evidência local não iniciou pendente de moderação.');
  if (landing?.total !== 1 || submitted?.total !== 1) throw new Error('Funil agregado local não persistido corretamente.');
  console.log('Mobile local OK: config, privacidade, QR agregado, demanda e evidência pendente.');
} catch (error) {
  console.error(error); console.error(output); process.exitCode = 1;
} finally {
  server.kill('SIGTERM'); fs.rmSync(root, { recursive: true, force: true });
}
