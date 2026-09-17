begin;

alter table public.demandas add column if not exists cep text;
alter table public.demandas add column if not exists logradouro text;
alter table public.demandas add column if not exists numero text;
alter table public.demandas add column if not exists complemento text;
alter table public.demandas add column if not exists uf text;
alter table public.demandas add column if not exists codigo_ibge text;

comment on column public.demandas.cep is 'CEP da localização da ocorrência, não necessariamente endereço residencial do solicitante.';
comment on column public.demandas.logradouro is 'Logradouro da ocorrência, quando informado ou resolvido por CEP.';
comment on column public.demandas.numero is 'Número ou referência curta da localização da ocorrência.';
comment on column public.demandas.complemento is 'Complemento opcional da localização da ocorrência.';
comment on column public.demandas.uf is 'UF da localização da ocorrência.';
comment on column public.demandas.codigo_ibge is 'Código IBGE do município retornado pela consulta de CEP.';

create index if not exists idx_demandas_cep on public.demandas (cep) where cep is not null;
create index if not exists idx_demandas_codigo_ibge on public.demandas (codigo_ibge) where codigo_ibge is not null;

commit;
