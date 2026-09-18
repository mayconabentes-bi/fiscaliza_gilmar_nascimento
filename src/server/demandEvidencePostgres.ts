import { getHealthyPostgres } from "./postgres.js";

let schemaPromise: Promise<void> | null = null;

export async function ensureDemandEvidenceSchema() {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const sql = await getHealthyPostgres();
    await sql`
      create table if not exists public.demanda_evidencias (
        id uuid primary key,
        demanda_id uuid not null references public.demandas(id) on delete cascade,
        storage_path text,
        mime text not null,
        ordem smallint not null check (ordem between 1 and 7),
        moderacao_status text not null default 'PENDENTE',
        revisada_em timestamptz,
        revisada_por text,
        moderacao_observacao text,
        created_at timestamptz not null default now(),
        unique (demanda_id, ordem)
      )
    `;
    await sql`create index if not exists idx_demanda_evidencias_demanda on public.demanda_evidencias(demanda_id, ordem)`;
    await sql`alter table public.demanda_evidencias enable row level security`;
    await sql`revoke all on public.demanda_evidencias from anon, authenticated`;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}
