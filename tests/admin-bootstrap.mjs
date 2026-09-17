import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-admin-bootstrap-'));
const dbPath = path.join(root, 'civic.db');
const env = {
  ...process.env,
  NODE_ENV: 'test',
  CIVIC_DB_PATH: dbPath,
  ADMIN_EMAIL: 'Admin-Teste@Example.org',
  ADMIN_PASSWORD: 'Senha-Bootstrap-Admin-2026!',
  ADMIN_NAME: 'Administrador Teste',
};

try {
  const run = spawnSync(process.execPath, ['dist-server/src/scripts/bootstrap_admin_on_start.js'], {
    cwd: process.cwd(), env, encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(`bootstrap local falhou:\n${run.stdout}\n${run.stderr}`);

  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT email, nome, ativo FROM admins').get();
  const legacyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orgaos_publicos'").get();
  db.close();

  if (!row) throw new Error('Administrador privado não foi criado no bootstrap local.');
  if (row.email !== 'admin-teste@example.org') throw new Error('E-mail administrativo não foi normalizado.');
  if (row.nome !== 'Administrador Teste' || row.ativo !== 1) throw new Error('Administrador privado criado com dados inválidos.');
  if (legacyTable) throw new Error('Modelo legado de órgãos públicos não deve ser criado em banco novo.');

  console.log('Admin bootstrap local OK: conta privada criada sem modelo institucional legado.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
