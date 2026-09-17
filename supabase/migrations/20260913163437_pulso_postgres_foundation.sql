-- FISCALIZE / CiviTech - PostgreSQL foundation
-- Created for closed pilot migration from SQLite to Supabase/Postgres.
-- Do not apply to production until the backend has been migrated to async Postgres access.

begin;

create schema if not exists private;

-- Prevent automatic Data API exposure for future public objects.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- CIVIC / APPLICATION TABLES
-- Kept in public to reduce the first backend migration surface.
-- Direct Data API access is denied by grants + RLS.
-- ---------------------------------------------------------------------------

create table if not exists public.municipios (
  id text primary key,
  nome text not null,
  microrregiao text,
  mesorregiao text,
  populacao_estimada bigint,
  pib double precision,
  perfil_territorial text,
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios (
  id uuid primary key,
  nome_completo text not null,
  email text unique not null,
  municipio text not null,
  bairro text not null,
  indice_contribuicao_civica double precision not null default 0,
  nivel_verificacao integer not null default 0,
  status text not null default 'ativo',
  consentimento_lgpd boolean not null default false,
  data_consentimento timestamptz,
  versao_consentimento text,
  created_at timestamptz not null default now(),
  password_hash text not null,
  constraint usuarios_status_check
    check (status in ('ativo', 'suspenso', 'excluido'))
);

create table if not exists public.temas_agregados (
  id uuid primary key,
  area_tematica text not null,
  municipio text not null,
  titulo_normalizado text not null,
  score_recorrencia double precision not null default 0,
  total_publicacoes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publicacoes (
  id uuid primary key,
  usuario_id uuid not null references public.usuarios(id),
  tipo_participacao text not null
    check (tipo_participacao in ('avaliacao', 'proposta', 'sugestao', 'relato')),
  area_tematica text not null,
  municipio text not null,
  conteudo text not null,
  status_moderacao text not null default 'pendente'
    check (status_moderacao in ('pendente', 'aprovado', 'rejeitado')),
  tema_agregado_id uuid references public.temas_agregados(id),
  created_at timestamptz not null default now()
);

create table if not exists public.propostas_civicas (
  id uuid primary key,
  autor_id uuid not null references public.usuarios(id),
  municipio text not null,
  area_tematica text not null,
  problema_resumido text not null,
  proposta_solucao text not null,
  impacto_estimado text not null,
  custo_estimado text,
  status text not null default 'ABERTA',
  nivel_apoio integer not null default 0,
  score_prioridade double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  bairro text,
  foto_url text,
  evidencia_texto text,
  evidencia_foto_url text,
  evidencia_data timestamptz
);

create table if not exists public.demandas (
  id uuid primary key,
  protocolo text unique not null,
  nome_solicitante text not null,
  contato text,
  municipio text not null,
  bairro text,
  categoria text not null,
  descricao text not null,
  prioridade text not null default 'MEDIA'
    check (prioridade in ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  status text not null default 'RECEBIDA'
    check (status in (
      'RECEBIDA',
      'EM_TRIAGEM',
      'ENCAMINHADA',
      'EM_ANALISE',
      'EM_EXECUCAO',
      'CONCLUIDA',
      'INDEFERIDA'
    )),
  observacao_interna text,
  usuario_id uuid not null references public.usuarios(id),
  latitude double precision,
  longitude double precision,
  bairro_oficial text,
  geocoding_source text,
  geocoding_confidence double precision,
  evidencia_foto_path text,
  evidencia_foto_mime text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demandas_geocoding_confidence_check
    check (
      geocoding_confidence is null
      or (geocoding_confidence >= 0 and geocoding_confidence <= 1)
    )
);

create table if not exists public.historico_status_demandas (
  id uuid primary key,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  usuario_responsavel_id uuid,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.denuncias (
  id uuid primary key,
  publicacao_id uuid not null references public.publicacoes(id) on delete cascade,
  usuario_denunciante_id uuid not null references public.usuarios(id),
  motivo text not null,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE', 'RESOLVIDA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registros_moderacao (
  id uuid primary key,
  publicacao_id uuid not null references public.publicacoes(id) on delete cascade,
  decisao text not null,
  justificativa text not null,
  moderador_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.apoios_qualificados (
  id uuid primary key,
  proposta_id uuid not null references public.propostas_civicas(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id),
  tipo_apoio text not null,
  justificativa text not null,
  prioridade text not null,
  municipio_autor text not null,
  created_at timestamptz not null default now(),
  unique (proposta_id, autor_id)
);

create table if not exists public.comentarios_tecnicos (
  id uuid primary key,
  proposta_id uuid not null references public.propostas_civicas(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id),
  tipo_autor text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.logs_auditoria (
  id uuid primary key,
  entidade text not null,
  entidade_id text not null,
  acao text not null,
  usuario_responsavel_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dados_transparencia (
  id uuid primary key,
  entidade text not null,
  tipo_dado text not null,
  valor double precision not null,
  descricao text not null,
  data_referencia timestamptz not null,
  link_origem text,
  created_at timestamptz not null default now()
);

create table if not exists public.indicadores_saude_datasus (
  id uuid primary key,
  municipio text not null,
  cod_ibge text,
  indicador text not null,
  valor double precision not null,
  periodo text not null,
  fonte_dados text not null default 'DATASUS',
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_control (
  service_name text primary key,
  last_sync timestamptz not null default now()
);

create table if not exists public.agradecimentos_propostas (
  id uuid primary key,
  proposta_id uuid not null references public.propostas_civicas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id),
  tipo text not null,
  mensagem text,
  created_at timestamptz not null default now(),
  unique (proposta_id, usuario_id, tipo)
);

create table if not exists public.mobile_funil_agregado (
  dia date not null,
  evento text not null,
  src text not null default '',
  acao text not null default '',
  total bigint not null default 0 check (total >= 0),
  primary key (dia, evento, src, acao)
);

-- ---------------------------------------------------------------------------
-- PRIVATE CORE
-- Not intended for Data API exposure.
-- ---------------------------------------------------------------------------

create table if not exists private.admins (
  id uuid primary key,
  nome text not null,
  email text unique not null,
  password_hash text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.intelligence_source_health (
  source_key text primary key,
  availability text not null,
  fetched_at timestamptz not null,
  source_updated_at timestamptz,
  total_records bigint not null default 0,
  classified_records bigint not null default 0,
  unclassified_records bigint not null default 0,
  coverage double precision not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  constraint intelligence_source_health_counts_check check (
    total_records >= 0
    and classified_records >= 0
    and unclassified_records >= 0
  ),
  constraint intelligence_source_health_coverage_check
    check (coverage >= 0 and coverage <= 1)
);

create table if not exists private.intelligence_snapshots (
  id bigint generated by default as identity primary key,
  metric text not null,
  territory text not null,
  period text not null,
  value double precision not null,
  source_keys jsonb not null,
  methodology text not null,
  collected_at timestamptz not null default now(),
  unique (metric, territory, period)
);

create table if not exists private.intelligence_refresh_runs (
  id bigint generated by default as identity primary key,
  trigger_type text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  sources_total integer not null default 0,
  sources_available integer not null default 0,
  sources_degraded integer not null default 0,
  sources_unavailable integer not null default 0,
  sources_not_configured integer not null default 0,
  details_json jsonb not null default '[]'::jsonb,
  error text
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

create index if not exists idx_usuarios_email_lower
  on public.usuarios (lower(email));

create index if not exists idx_usuarios_municipio_bairro
  on public.usuarios (municipio, bairro);

create index if not exists idx_demandas_protocolo
  on public.demandas (protocolo);

create index if not exists idx_demandas_status
  on public.demandas (status);

create index if not exists idx_demandas_municipio
  on public.demandas (municipio);

create index if not exists idx_demandas_bairro
  on public.demandas (bairro);

create index if not exists idx_demandas_categoria
  on public.demandas (categoria);

create index if not exists idx_demandas_usuario_id
  on public.demandas (usuario_id);

create index if not exists idx_demandas_created_at
  on public.demandas (created_at desc);

create index if not exists idx_demandas_bairro_oficial
  on public.demandas (bairro_oficial);

create index if not exists idx_historico_demandas_demanda
  on public.historico_status_demandas (demanda_id, created_at);

create unique index if not exists idx_admins_email_lower
  on private.admins (lower(email));

create index if not exists idx_intelligence_snapshots_metric
  on private.intelligence_snapshots (metric);

create index if not exists idx_intelligence_snapshots_territory
  on private.intelligence_snapshots (territory);

create index if not exists idx_intelligence_refresh_started_at
  on private.intelligence_refresh_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- DATA API HARDENING
-- RLS is defense in depth. No policies are created because the pilot uses
-- browser -> Express API -> Postgres and not browser -> Data API.
-- ---------------------------------------------------------------------------

alter table public.municipios enable row level security;
alter table public.usuarios enable row level security;
alter table public.temas_agregados enable row level security;
alter table public.publicacoes enable row level security;
alter table public.propostas_civicas enable row level security;
alter table public.demandas enable row level security;
alter table public.historico_status_demandas enable row level security;
alter table public.denuncias enable row level security;
alter table public.registros_moderacao enable row level security;
alter table public.apoios_qualificados enable row level security;
alter table public.comentarios_tecnicos enable row level security;
alter table public.logs_auditoria enable row level security;
alter table public.dados_transparencia enable row level security;
alter table public.indicadores_saude_datasus enable row level security;
alter table public.sync_control enable row level security;
alter table public.agradecimentos_propostas enable row level security;
alter table public.mobile_funil_agregado enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

commit;
