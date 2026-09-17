import { IBackupService } from '../../domain/backup/IBackupService.js';
import { logger } from '../observabilidade/StructuredLogger.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class BackupService implements IBackupService {
  private backupDir: string;
  private externalBackupDir?: string;
  private dbPath: string;
  private evidenceDir: string;

  constructor() {
    this.dbPath = path.resolve(process.env.CIVIC_DB_PATH || path.join(process.cwd(), 'civic_platform.db'));
    this.evidenceDir = path.resolve(process.env.EVIDENCE_DIR || path.join(path.dirname(this.dbPath), 'evidence'));
    this.backupDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
    this.externalBackupDir = process.env.BACKUP_EXTERNAL_DIR ? path.resolve(process.env.BACKUP_EXTERNAL_DIR) : undefined;

    // Em Vercel/produção a persistência é Postgres + Supabase Storage. Não criar
    // diretórios locais que possam induzir a falsa impressão de backup persistente.
    if (process.env.NODE_ENV !== 'production') {
      fs.mkdirSync(this.backupDir, { recursive: true });
      if (this.externalBackupDir) fs.mkdirSync(this.externalBackupDir, { recursive: true });
    }
  }

  private assertLocalMode() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Backup SQLite é exclusivo do ambiente local/teste. Em produção use backup gerenciado do Postgres/Supabase e política externa documentada.');
    }
  }

  async createSnapshot(): Promise<string> {
    this.assertLocalMode();
    if (!fs.existsSync(this.dbPath)) throw new Error(`Banco de dados não encontrado em ${this.dbPath}`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotId = `backup-${timestamp}.sqlite`;
    const destPath = path.join(this.backupDir, snapshotId);
    const sourceDb = new Database(this.dbPath, { readonly: true, fileMustExist: true });

    try {
      await sourceDb.backup(destPath);
      const integrityDb = new Database(destPath, { readonly: true, fileMustExist: true });
      const integrity = integrityDb.pragma('integrity_check', { simple: true });
      integrityDb.close();
      if (integrity !== 'ok') throw new Error(`Backup inválido: integrity_check=${integrity}`);

      const hash = await this.calculateHash(destPath);
      fs.writeFileSync(`${destPath}.sha256`, `${hash}  ${snapshotId}\n`, 'utf8');

      const evidenceSnapshot = `${destPath}.evidence`;
      if (fs.existsSync(this.evidenceDir)) {
        fs.rmSync(evidenceSnapshot, { recursive: true, force: true });
        fs.cpSync(this.evidenceDir, evidenceSnapshot, { recursive: true });
      }

      if (this.externalBackupDir) {
        fs.copyFileSync(destPath, path.join(this.externalBackupDir, snapshotId));
        fs.copyFileSync(`${destPath}.sha256`, path.join(this.externalBackupDir, `${snapshotId}.sha256`));
        if (fs.existsSync(evidenceSnapshot)) {
          const externalEvidence = path.join(this.externalBackupDir, `${snapshotId}.evidence`);
          fs.rmSync(externalEvidence, { recursive: true, force: true });
          fs.cpSync(evidenceSnapshot, externalEvidence, { recursive: true });
        }
      }

      logger.info({
        module: 'BackupService', correlation_id: 'backup-job', event_type: 'BACKUP_CREATED',
        message: `Snapshot created: ${snapshotId}`,
        metadata: { hash, size: fs.statSync(destPath).size, external: Boolean(this.externalBackupDir), evidence: fs.existsSync(evidenceSnapshot) }
      });
      return snapshotId;
    } finally {
      sourceDb.close();
    }
  }

  async validateSnapshot(snapshotId: string): Promise<boolean> {
    this.assertLocalMode();
    const filePath = this.resolveSnapshot(snapshotId);
    if (!filePath) return false;
    try {
      const db = new Database(filePath, { readonly: true, fileMustExist: true });
      const integrity = db.pragma('integrity_check', { simple: true });
      db.close();
      if (integrity !== 'ok') return false;

      const hashFile = `${filePath}.sha256`;
      if (!fs.existsSync(hashFile)) return false;
      const expected = fs.readFileSync(hashFile, 'utf8').trim().split(/\s+/)[0];
      const actual = await this.calculateHash(filePath);
      return Boolean(expected) && expected === actual;
    } catch {
      return false;
    }
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    this.assertLocalMode();
    const sourcePath = this.resolveSnapshot(snapshotId);
    if (!sourcePath || !(await this.validateSnapshot(snapshotId))) throw new Error(`Snapshot ${snapshotId} ausente ou inválido.`);

    const tempPath = `${this.dbPath}.restore-${Date.now()}`;
    fs.copyFileSync(sourcePath, tempPath);
    const db = new Database(tempPath, { readonly: true, fileMustExist: true });
    const integrity = db.pragma('integrity_check', { simple: true });
    db.close();
    if (integrity !== 'ok') {
      fs.rmSync(tempPath, { force: true });
      throw new Error(`Restore abortado: integrity_check=${integrity}`);
    }

    fs.renameSync(tempPath, this.dbPath);

    const evidenceSource = `${sourcePath}.evidence`;
    if (fs.existsSync(evidenceSource)) {
      fs.rmSync(this.evidenceDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(this.evidenceDir), { recursive: true });
      fs.cpSync(evidenceSource, this.evidenceDir, { recursive: true });
    }

    logger.warn({
      module: 'BackupService', correlation_id: 'restore-job', event_type: 'BACKUP_RESTORED',
      message: `Database and available evidence restored from snapshot: ${snapshotId}`
    });
  }

  private resolveSnapshot(snapshotId: string): string | null {
    const safeName = path.basename(snapshotId);
    const local = path.join(this.backupDir, safeName);
    if (fs.existsSync(local)) return local;
    if (this.externalBackupDir) {
      const external = path.join(this.externalBackupDir, safeName);
      if (fs.existsSync(external)) return external;
    }
    return null;
  }

  private calculateHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
