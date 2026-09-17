import { getPostgres } from "./postgres.js";
import { removeDemandEvidence } from "./evidenceStorage.js";

export const RETENTION_PG = {
  closedDemandContactDays: Number(process.env.RETENTION_CLOSED_DEMAND_CONTACT_DAYS || 180),
  closedDemandEvidenceDays: Number(process.env.RETENTION_CLOSED_DEMAND_EVIDENCE_DAYS || 365),
  inactiveAccountDays: Number(process.env.RETENTION_INACTIVE_ACCOUNT_DAYS || 730),
  auditLogDays: Number(process.env.RETENTION_AUDIT_LOG_DAYS || 1825),
  aggregateAnalyticsDays: Number(process.env.RETENTION_AGGREGATE_ANALYTICS_DAYS || 730),
};

export async function retentionPreviewPostgres() {
  const sql = getPostgres();
  const [contact] = await sql`select count(*)::bigint as total from public.demandas where status in ('CONCLUIDA','INDEFERIDA') and nullif(contato,'') is not null and updated_at < now() - (${RETENTION_PG.closedDemandContactDays} * interval '1 day')`;
  const [evidence] = await sql`select count(*)::bigint as total from public.demandas where status in ('CONCLUIDA','INDEFERIDA') and evidencia_foto_path is not null and updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')`;
  const [users] = await sql`select count(*)::bigint as total from public.usuarios where status = 'excluido' and created_at < now() - (${RETENTION_PG.inactiveAccountDays} * interval '1 day')`;
  const [logs] = await sql`select count(*)::bigint as total from public.logs_auditoria where created_at < now() - (${RETENTION_PG.auditLogDays} * interval '1 day')`;
  const [analytics] = await sql`select count(*)::bigint as total from public.mobile_funil_agregado where dia < current_date - ${RETENTION_PG.aggregateAnalyticsDays}`;
  return {
    contact: Number(contact?.total || 0),
    evidence: Number(evidence?.total || 0),
    users: Number(users?.total || 0),
    auditLogs: Number(logs?.total || 0),
    aggregateAnalytics: Number(analytics?.total || 0),
    policy: RETENTION_PG,
  };
}

export async function applyRetentionPostgres() {
  const sql = getPostgres();
  const staleEvidence = await sql`
    select id, evidencia_foto_path from public.demandas
    where status in ('CONCLUIDA','INDEFERIDA') and evidencia_foto_path is not null
      and updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')
  `;

  const removedFiles: string[] = [];
  for (const row of staleEvidence) {
    try {
      await removeDemandEvidence(String(row.evidencia_foto_path));
      removedFiles.push(String(row.evidencia_foto_path));
    } catch (error) {
      console.error("Falha ao remover evidência expirada no Storage:", error);
    }
  }

  const result = await sql.begin(async (tx) => {
    const contacts = await tx`
      update public.demandas set contato = null
      where status in ('CONCLUIDA','INDEFERIDA') and nullif(contato,'') is not null
        and updated_at < now() - (${RETENTION_PG.closedDemandContactDays} * interval '1 day')
      returning id
    `;
    const evidence = await tx`
      update public.demandas
      set evidencia_foto_path = null, evidencia_foto_mime = null,
          evidencia_moderacao_status = 'EXPIRADA', evidencia_revisada_em = now()
      where status in ('CONCLUIDA','INDEFERIDA') and evidencia_foto_path is not null
        and updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')
      returning id
    `;
    const users = await tx`
      update public.usuarios
      set nome_completo = 'Conta encerrada', email = 'retido-' || id::text || '@invalid.local',
          bairro = '', municipio = '', password_hash = '', consentimento_lgpd = false,
          data_consentimento = null, versao_consentimento = null
      where status = 'excluido' and created_at < now() - (${RETENTION_PG.inactiveAccountDays} * interval '1 day')
      returning id
    `;
    const auditLogs = await tx`delete from public.logs_auditoria where created_at < now() - (${RETENTION_PG.auditLogDays} * interval '1 day') returning id`;
    const aggregateAnalytics = await tx`delete from public.mobile_funil_agregado where dia < current_date - ${RETENTION_PG.aggregateAnalyticsDays} returning dia`;
    return {
      contacts: contacts.length,
      evidence: evidence.length,
      users: users.length,
      auditLogs: auditLogs.length,
      aggregateAnalytics: aggregateAnalytics.length,
    };
  });

  return { ...result, removedFiles, policy: RETENTION_PG };
}
