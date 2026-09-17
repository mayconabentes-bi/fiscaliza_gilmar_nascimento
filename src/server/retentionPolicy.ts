import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, getDb } from './db.js';

export const RETENTION = {
  closedDemandContactDays: Number(process.env.RETENTION_CLOSED_DEMAND_CONTACT_DAYS || 180),
  closedDemandEvidenceDays: Number(process.env.RETENTION_CLOSED_DEMAND_EVIDENCE_DAYS || 365),
  inactiveAccountDays: Number(process.env.RETENTION_INACTIVE_ACCOUNT_DAYS || 730),
  auditLogDays: Number(process.env.RETENTION_AUDIT_LOG_DAYS || 1825),
  aggregateAnalyticsDays: Number(process.env.RETENTION_AGGREGATE_ANALYTICS_DAYS || 730),
};

const CLOSED = "('CONCLUIDA','INDEFERIDA')";

function evidenceDir() {
  return process.env.EVIDENCE_DIR || path.join(path.dirname(DB_PATH), 'evidence');
}

export function retentionPreview() {
  const db = getDb();
  try {
    const contact = db.prepare(`SELECT COUNT(*) AS total FROM demandas WHERE status IN ${CLOSED} AND contato IS NOT NULL AND contato <> '' AND datetime(updated_at) < datetime('now', ?)`)
      .get(`-${RETENTION.closedDemandContactDays} days`) as any;
    const evidence = db.prepare(`SELECT COUNT(*) AS total FROM demandas WHERE status IN ${CLOSED} AND evidencia_foto_path IS NOT NULL AND datetime(updated_at) < datetime('now', ?)`)
      .get(`-${RETENTION.closedDemandEvidenceDays} days`) as any;
    const users = db.prepare(`SELECT COUNT(*) AS total FROM usuarios WHERE status = 'excluido' AND datetime(created_at) < datetime('now', ?)`)
      .get(`-${RETENTION.inactiveAccountDays} days`) as any;
    const logs = db.prepare(`SELECT COUNT(*) AS total FROM logs_auditoria WHERE datetime(created_at) < datetime('now', ?)`)
      .get(`-${RETENTION.auditLogDays} days`) as any;
    const analytics = db.prepare(`SELECT COUNT(*) AS total FROM mobile_funil_agregado WHERE date(dia) < date('now', ?)`)
      .get(`-${RETENTION.aggregateAnalyticsDays} days`) as any;
    return { contact: Number(contact?.total || 0), evidence: Number(evidence?.total || 0), users: Number(users?.total || 0), auditLogs: Number(logs?.total || 0), aggregateAnalytics: Number(analytics?.total || 0), policy: RETENTION };
  } finally { db.close(); }
}

export function applyRetention() {
  const db = getDb();
  const removedFiles: string[] = [];
  try {
    const staleEvidence = db.prepare(`SELECT id, evidencia_foto_path FROM demandas WHERE status IN ${CLOSED} AND evidencia_foto_path IS NOT NULL AND datetime(updated_at) < datetime('now', ?)`)
      .all(`-${RETENTION.closedDemandEvidenceDays} days`) as Array<{ id: string; evidencia_foto_path: string }>;

    const result = db.transaction(() => {
      const contacts = db.prepare(`UPDATE demandas SET contato = NULL WHERE status IN ${CLOSED} AND contato IS NOT NULL AND contato <> '' AND datetime(updated_at) < datetime('now', ?)`)
        .run(`-${RETENTION.closedDemandContactDays} days`).changes;

      for (const row of staleEvidence) {
        const file = path.join(evidenceDir(), path.basename(row.evidencia_foto_path));
        try { if (fs.existsSync(file)) { fs.unlinkSync(file); removedFiles.push(path.basename(file)); } } catch (error) { console.error('Falha ao remover evidência expirada:', error); }
      }
      const evidence = db.prepare(`UPDATE demandas SET evidencia_foto_path = NULL, evidencia_foto_mime = NULL, evidencia_moderacao_status = 'EXPIRADA', evidencia_revisada_em = CURRENT_TIMESTAMP WHERE status IN ${CLOSED} AND evidencia_foto_path IS NOT NULL AND datetime(updated_at) < datetime('now', ?)`)
        .run(`-${RETENTION.closedDemandEvidenceDays} days`).changes;

      const users = db.prepare(`UPDATE usuarios SET nome_completo = 'Conta encerrada', email = 'retido-' || id || '@invalid.local', bairro = '', municipio = '', password_hash = '', consentimento_lgpd = 0, data_consentimento = NULL, versao_consentimento = NULL WHERE status = 'excluido' AND datetime(created_at) < datetime('now', ?)`)
        .run(`-${RETENTION.inactiveAccountDays} days`).changes;

      const auditLogs = db.prepare(`DELETE FROM logs_auditoria WHERE datetime(created_at) < datetime('now', ?)`)
        .run(`-${RETENTION.auditLogDays} days`).changes;
      const aggregateAnalytics = db.prepare(`DELETE FROM mobile_funil_agregado WHERE date(dia) < date('now', ?)`)
        .run(`-${RETENTION.aggregateAnalyticsDays} days`).changes;
      return { contacts, evidence, users, auditLogs, aggregateAnalytics };
    })();

    return { ...result, removedFiles, policy: RETENTION };
  } finally { db.close(); }
}
