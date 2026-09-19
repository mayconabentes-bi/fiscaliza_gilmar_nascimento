-- P1.1: idempotência do registro público de demandas
-- Compatível com registros existentes: novas colunas são opcionais para linhas históricas.
begin;

alter table public.demandas
  add column if not exists idempotency_key uuid;

alter table public.demandas
  add column if not exists request_fingerprint varchar(64);

create unique index if not exists idx_demandas_idempotency_key
  on public.demandas (idempotency_key)
  where idempotency_key is not null;

commit;
