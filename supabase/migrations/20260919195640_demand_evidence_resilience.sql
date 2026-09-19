-- P1.2: resiliência do registro quando o Storage de evidências falha
begin;

alter table public.demandas
  add column if not exists evidencia_upload_status text not null default 'NAO_SOLICITADO';

alter table public.demandas
  add column if not exists evidencia_upload_solicitadas smallint not null default 0;

alter table public.demandas
  add column if not exists evidencia_upload_anexadas smallint not null default 0;

alter table public.demandas
  add column if not exists evidencia_upload_falhas smallint not null default 0;

with evidence_counts as (
  select demanda_id, count(*)::smallint as total
  from public.demanda_evidencias
  where storage_path is not null
  group by demanda_id
)
update public.demandas d
set evidencia_upload_status = 'COMPLETO',
    evidencia_upload_solicitadas = e.total,
    evidencia_upload_anexadas = e.total,
    evidencia_upload_falhas = 0
from evidence_counts e
where d.id = e.demanda_id;

update public.demandas
set evidencia_upload_status = 'COMPLETO',
    evidencia_upload_solicitadas = 1,
    evidencia_upload_anexadas = 1,
    evidencia_upload_falhas = 0
where evidencia_foto_path is not null
  and evidencia_upload_anexadas = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'demandas_evidencia_upload_status_check'
  ) then
    alter table public.demandas
      add constraint demandas_evidencia_upload_status_check
      check (evidencia_upload_status in ('NAO_SOLICITADO','COMPLETO','PARCIAL','FALHA'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'demandas_evidencia_upload_counts_check'
  ) then
    alter table public.demandas
      add constraint demandas_evidencia_upload_counts_check
      check (
        evidencia_upload_solicitadas between 0 and 7
        and evidencia_upload_anexadas between 0 and evidencia_upload_solicitadas
        and evidencia_upload_falhas = evidencia_upload_solicitadas - evidencia_upload_anexadas
      );
  end if;
end $$;

commit;
