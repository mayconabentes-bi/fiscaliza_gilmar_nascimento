import { getPostgres } from "./postgres.js";
import { removeDemandEvidence } from "./evidenceStorage.js";

export const RETENTION_PG = {
  closedDemandContactDays: Number(process.env.RETENTION_CLOSED_DEMAND_CONTACT_DAYS || 180),
  closedDemandEvidenceDays: Number(process.env.RETENTION_CLOSED_DEMAND_EVIDENCE_DAYS || 365),
  inactiveAccountDays: Number(process.env.RETENTION_INACTIVE_ACCOUNT_DAYS || 730),
  auditLogDays: Number(process.env.RETENTION_AUDIT_LOG_DAYS || 1825),
  aggregateAnalyticsDays: Number(process.env.RETENTION_AGGREGATE_ANALYTICS_DAYS || 730),
};

async function staleEvidencePaths() {
  const sql = getPostgres();
  return sql`
    with stale_demands as (
      select id, evidencia_foto_path
      from public.demandas
      where status in ('CONCLUIDA','INDEFERIDA')
        and updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')
    )
    select distinct path
    from (
      select de.storage_path as path
      from public.demanda_evidencias de
      join stale_demands d on d.id = de.demanda_id
      where de.storage_path is not null
      union
      select evidencia_foto_path as path
      from stale_demands
      where evidencia_foto_path is not null
    ) candidates
    where path is not null
  `;
}

export async function retentionPreviewPostgres() {
  const sql = getPostgres();
  const [contact] = await sql`select count(*)::bigint as total from public.demandas where status in ('CONCLUIDA','INDEFERIDA') and nullif(contato,'') is not null and updated_at < now() - (${RETENTION_PG.closedDemandContactDays} * interval '1 day')`;
  const [evidence] = await sql`select count(*)::bigint as total from public.demandas where status in ('CONCLUIDA','INDEFERIDA') and (evidencia_foto_path is not null or exists (select 1 from public.demanda_evidencias de where de.demanda_id = public.demandas.id and de.storage_path is not null)) and updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')`;
  const evidenceObjects = await staleEvidencePaths();
  const [users] = await sql`select count(*)::bigint as total from public.usuarios where status = 'excluido' and created_at < now() - (${RETENTION_PG.inactiveAccountDays} * interval '1 day')`;
  const [logs] = await sql`select count(*)::bigint as total from public.logs_auditoria where created_at < now() - (${RETENTION_PG.auditLogDays} * interval '1 day')`;
  const [analytics] = await sql`select count(*)::bigint as total from public.mobile_funil_agregado where dia < current_date - ${RETENTION_PG.aggregateAnalyticsDays}`;
  return {
    contact: Number(contact?.total || 0),
    evidence: Number(evidence?.total || 0),
    evidenceObjects: evidenceObjects.length,
    users: Number(users?.total || 0),
    auditLogs: Number(logs?.total || 0),
    aggregateAnalytics: Number(analytics?.total || 0),
    policy: RETENTION_PG,
  };
}

export async function applyRetentionPostgres() {
  const sql = getPostgres();
  const candidates = await staleEvidencePaths();
  const removedPaths: string[] = [];
  let failedEvidenceObjects = 0;

  for (const row of candidates) {
    try {
      await removeDemandEvidence(String(row.path));
      removedPaths.push(String(row.path));
    } catch (error) {
      failedEvidenceObjects += 1;
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

    let evidenceRowsExpired = 0;
    for (const path of removedPaths) {
      const rows = await tx`
        update public.demanda_evidencias
        set storage_path = null,
            moderacao_status = 'EXPIRADA',
            revisada_em = now()
        where storage_path = ${path}
        returning id
      `;
      evidenceRowsExpired += rows.length;

      await tx`
        update public.demandas
        set evidencia_foto_path = null,
            evidencia_foto_mime = null
        where evidencia_foto_path = ${path}
      `;
    }

    const evidence = await tx`
      update public.demandas d
      set evidencia_moderacao_status = 'EXPIRADA',
          evidencia_revisada_em = now()
      where d.status in ('CONCLUIDA','INDEFERIDA')
        and d.updated_at < now() - (${RETENTION_PG.closedDemandEvidenceDays} * interval '1 day')
        and d.evidencia_foto_path is null
        and not exists (
          select 1 from public.demanda_evidencias de
          where de.demanda_id = d.id and de.storage_path is not null
        )
        and (
          d.evidencia_moderacao_status <> 'NAO_ENVIADA'
          or exists (select 1 from public.demanda_evidencias de2 where de2.demanda_id = d.id)
        )
      returning d.id
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
      evidenceRowsExpired,
      evidenceObjectsRemoved: removedPaths.length,
      evidenceObjectsFailed: failedEvidenceObjects,
      users: users.length,
      auditLogs: auditLogs.length,
      aggregateAnalytics: aggregateAnalytics.length,
    };
  });

  return { ...result, policy: RETENTION_PG };
}
