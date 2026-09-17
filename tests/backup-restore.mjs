import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amazonas-backup-'));
const dbPath = path.join(root, 'civic_platform.db');
const backupDir = path.join(root, 'backups');
const externalDir = path.join(root, 'external');

process.env.CIVIC_DB_PATH = dbPath;
process.env.BACKUP_DIR = backupDir;
process.env.BACKUP_EXTERNAL_DIR = externalDir;

const db = new Database(dbPath);
db.exec('CREATE TABLE qa_restore (id INTEGER PRIMARY KEY, value TEXT NOT NULL);');
db.prepare('INSERT INTO qa_restore(value) VALUES (?)').run('antes-do-backup');
db.close();

const { BackupService } = await import('../dist-server/src/modules/infraestrutura-operacional/infrastructure/backup/BackupService.js');
const service = new BackupService();
const snapshot = await service.createSnapshot();

if (!(await service.validateSnapshot(snapshot))) throw new Error('Snapshot deveria ser válido.');
if (!fs.existsSync(path.join(externalDir, snapshot))) throw new Error('Cópia externa não foi criada.');

const mutated = new Database(dbPath);
mutated.prepare('UPDATE qa_restore SET value = ?').run('depois-do-backup');
mutated.close();

await service.restoreSnapshot(snapshot);
const restored = new Database(dbPath, { readonly: true });
const row = restored.prepare('SELECT value FROM qa_restore LIMIT 1').get();
restored.close();
if (row.value !== 'antes-do-backup') throw new Error(`Restore falhou: ${row.value}`);

fs.rmSync(root, { recursive: true, force: true });
console.log('Backup/restore OK: snapshot real, hash, cópia externa e restore íntegro.');
