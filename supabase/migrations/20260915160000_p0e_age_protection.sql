-- P0-E: faixa etária mínima e proteção reforçada para adolescentes
begin;

alter table public.usuarios
  add column if not exists faixa_etaria text;

alter table public.usuarios
  add column if not exists protecao_reforcada boolean not null default false;

alter table public.demandas
  add column if not exists faixa_etaria text;

alter table public.demandas
  add column if not exists revisao_reforcada boolean not null default false;

alter table public.demandas
  add column if not exists revisao_reforcada_motivo text;

alter table public.usuarios
  drop constraint if exists usuarios_faixa_etaria_check;

alter table public.usuarios
  add constraint usuarios_faixa_etaria_check
  check (faixa_etaria is null or faixa_etaria in ('AGE_16_17', 'AGE_18_PLUS'));

alter table public.demandas
  drop constraint if exists demandas_faixa_etaria_check;

alter table public.demandas
  add constraint demandas_faixa_etaria_check
  check (faixa_etaria is null or faixa_etaria in ('AGE_16_17', 'AGE_18_PLUS'));

-- Registros legados permanecem NULL até nova declaração do próprio titular.
-- Nenhuma data de nascimento, documento ou biometria é criada por esta migration.

revoke all on public.usuarios from anon, authenticated;
revoke all on public.demandas from anon, authenticated;

commit;
