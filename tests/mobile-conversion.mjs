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
    ENABLE_PUBLIC_REGISTRATION: 'true', INTERNAL_PILOT_MODE: 'false', ENABLE_PUBLIC_DEMAND_INTAKE: 'true',
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
  for (const event of ['form_step_location', 'form_step_details', 'form_step_review']) {
    expect((await fetch(`${BASE}/api/mobile-events`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ event, src: 'flyer', acao: 'centro-01' }) })).status, 204, `evento agregado ${event}`);
  }

  const noPrivacy = await fetch(`${BASE}/api/demandas`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ nome_solicitante: 'QA', municipio: 'Manaus', categoria: 'INFRAESTRUTURA_URBANA', tipo_problema: 'BURACO_PAVIMENTACAO', descricao: 'Teste', faixa_etaria: 'AGE_25_34' }) });
  expect(noPrivacy.status, 400, 'privacidade pública obrigatória');

  const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  const demand = await fetch(`${BASE}/api/demandas`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ nome_solicitante: 'QA Mobile', contato: '', municipio: 'Manaus', bairro: 'Centro', categoria: 'INFRAESTRUTURA_URBANA', tipo_problema: 'BURACO_PAVIMENTACAO', descricao: 'Demanda QA mobile', faixa_etaria: 'AGE_25_34', prioridade: 'MEDIA', aviso_privacidade_aceito: true, src: 'flyer', acao: 'centro-01', foto_evidencia_base64: photo }) });
  expect(demand.status, 201, 'demanda pública local');
  const body = await demand.json();

  const citizenEmail = 'mobile-citizen@example.local';
  const citizenPassword = 'SenhaMobile123!';
  const register = await fetch(`${BASE}/api/auth/register/cidadao`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      nome_completo: 'Cidadão Mobile',
      email: citizenEmail,
      municipio: 'Manaus',
      bairro: 'Centro',
      faixa_etaria: 'AGE_25_34',
      password: citizenPassword,
      aceite_codigo: true,
      aceite_lgpd: true,
    }),
  });
  expect(register.status, 201, 'cadastro cidadão local');

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: citizenEmail, password: citizenPassword, type: 'cidadao' }),
  });
  expect(login.status, 200, 'login cidadão local');
  const authCookie = String(login.headers.get('set-cookie') || '').split(';')[0];
  if (!authCookie.includes('token=')) throw new Error('Login cidadão não retornou cookie de sessão.');

  const authenticatedDemand = await fetch(`${BASE}/api/demandas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, cookie: authCookie },
    body: JSON.stringify({
      nome_solicitante: 'Cidadão Mobile',
      contato: citizenEmail,
      municipio: 'Manaus',
      bairro: 'Centro',
      categoria: 'LIMPEZA_URBANA',
      tipo_problema: 'LIXO_ACUMULADO',
      descricao: 'Registro autenticado para Meus registros',
      faixa_etaria: 'AGE_25_34',
      prioridade: 'MEDIA',
      aviso_privacidade_aceito: true,
    }),
  });
  expect(authenticatedDemand.status, 201, 'demanda autenticada local');
  const authenticatedBody = await authenticatedDemand.json();

  const myRecordsResponse = await fetch(`${BASE}/api/minha-conta/demandas`, {
    headers: { origin: BASE, cookie: authCookie },
  });
  expect(myRecordsResponse.status, 200, 'Meus registros autenticado');
  const myRecords = await myRecordsResponse.json();
  expect(myRecords.total, 1, 'quantidade de registros vinculados à conta');
  if (myRecords.registros?.[0]?.protocolo !== authenticatedBody.protocolo) {
    throw new Error('Meus registros não retornou o protocolo da demanda autenticada.');
  }
  if (myRecords.registros.some((item) => item.protocolo === body.protocolo)) {
    throw new Error('Meus registros expôs demanda pública sem vínculo com a conta.');
  }

  await new Promise(r => setTimeout(r, 100));
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT evidencia_foto_path, evidencia_moderacao_status FROM demandas WHERE id = ?').get(body.id);
  const landing = db.prepare("SELECT total FROM mobile_funil_agregado WHERE evento='qr_landing' AND src='flyer' AND acao='centro-01'").get();
  const submitted = db.prepare("SELECT total FROM mobile_funil_agregado WHERE evento='form_submit' AND src='flyer' AND acao='centro-01'").get();
  const steps = db.prepare("SELECT evento, total FROM mobile_funil_agregado WHERE evento LIKE 'form_step_%' AND src='flyer' AND acao='centro-01' ORDER BY evento").all();
  db.close();
  if (!row?.evidencia_foto_path || !fs.existsSync(path.join(evidenceDir, row.evidencia_foto_path))) throw new Error('Evidência fotográfica local não persistida.');
  if (row.evidencia_moderacao_status !== 'PENDENTE') throw new Error('Evidência local não iniciou pendente de moderação.');
  if (landing?.total !== 1 || submitted?.total !== 1) throw new Error('Funil agregado local não persistido corretamente.');
  if (steps.length !== 3 || steps.some(step => step.total !== 1)) throw new Error('Etapas agregadas do formulário não foram persistidas corretamente.');
  console.log('Mobile local OK: config, privacidade, QR, progresso agregado, demanda, evidência pendente e Meus registros autenticado.');
} catch (error) {
  console.error(error); console.error(output); process.exitCode = 1;
} finally {
  server.kill('SIGTERM'); fs.rmSync(root, { recursive: true, force: true });
}
