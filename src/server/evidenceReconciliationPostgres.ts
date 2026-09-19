import { getPostgres } from "./postgres.js";
import { removeDemandEvidence } from "./evidenceStorage.js";

export const EVIDENCE_ORPHAN_GRACE_HOURS = 24;
const MAX_RECONCILIATION_BATCH = 500;

async function orphanRows(limit = MAX_RECONCILIATION_BATCH) {
  const sql = getPostgres();
  return sql`
    with db_paths as (
      select storage_path as path
      from public.demanda_evidencias
      where storage_path is not null
      union
      select evidencia_foto_path as path
      from public.demandas
      where evidencia_foto_path is not null
    )
    select o.name as storage_path, o.created_at
    from storage.objects o
    left join db_paths d on d.path = o.name
    where o.bucket_id = 'evidencias-demandas'
      and d.path is null
      and o.created_at < now() - (${EVIDENCE_ORPHAN_GRACE_HOURS} * interval '1 hour')
    order by o.created_at asc
    limit ${limit}
  `;
}

export async function previewEvidenceOrphansPostgres() {
  const rows = await orphanRows();
  return {
    eligible: rows.length,
    graceHours: EVIDENCE_ORPHAN_GRACE_HOURS,
    batchLimit: MAX_RECONCILIATION_BATCH,
    oldestCreatedAt: rows[0]?.created_at || null,
    newestCreatedAt: rows.length ? rows[rows.length - 1]?.created_at || null : null,
  };
}

export async function reconcileEvidenceOrphansPostgres() {
  const rows = await orphanRows();
  let removed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await removeDemandEvidence(String(row.storage_path));
      removed += 1;
    } catch (error) {
      failed += 1;
      console.error("Falha ao reconciliar objeto órfão de evidência:", error);
    }
  }

  return {
    examined: rows.length,
    removed,
    failed,
    graceHours: EVIDENCE_ORPHAN_GRACE_HOURS,
    batchLimit: MAX_RECONCILIATION_BATCH,
  };
}
