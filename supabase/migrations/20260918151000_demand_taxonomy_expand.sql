-- Fase expand da taxonomia estruturada de demandas.
-- Compatível com a versão anterior da aplicação: tipo_problema permanece nullable nesta etapa.
begin;

alter table public.demandas
  add column if not exists tipo_problema text;

create index if not exists idx_demandas_tipo_problema
  on public.demandas(tipo_problema);

commit;
