-- P0-D: persistência de produção para Vercel + Supabase/Postgres
begin;

create schema if not exists private;

create table if not exists public.usuarios (
  id uuid primary key,
  nome_completo text not null,
  email text unique not null,
  municipio text not null,
  bairro text not null,
  status text not null default 'ativo',
  consentimento_lgpd boolean not null default false,
  data_consentimento timestamptz,
  versao_consentimento text,
  created_at timestamptz not null default now(),
  password_hash text not null
);

create table if not exists private.admins (
  id uuid primary key,
  nome text not null,
  email text unique not null,
  password_hash text not null,
  ativo boolean not null default true,
  perfil_acesso text not null default 'ADMIN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.admins add column if not exists perfil_acesso text not null default 'ADMIN';

create table if not exists public.demandas (
  id uuid primary key,
  protocolo text unique not null,
  nome_solicitante text not null,
  contato text,
  municipio text not null,
  bairro text,
  categoria text not null,
  descricao text not null,
  prioridade text not null default 'MEDIA',
  status text not null default 'RECEBIDA',
  observacao_interna text,
  usuario_id uuid references public.usuarios(id),
  evidencia_foto_path text,
  evidencia_foto_mime text,
  evidencia_moderacao_status text not null default 'NAO_ENVIADA',
  evidencia_revisada_em timestamptz,
  evidencia_revisada_por text,
  evidencia_moderacao_observacao text,
  aviso_privacidade_versao text,
  aviso_privacidade_data timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.demandas add column if not exists evidencia_foto_path text;
alter table public.demandas add column if not exists evidencia_foto_mime text;
alter table public.demandas add column if not exists evidencia_moderacao_status text not null default 'NAO_ENVIADA';
alter table public.demandas add column if not exists evidencia_revisada_em timestamptz;
alter table public.demandas add column if not exists evidencia_revisada_por text;
alter table public.demandas add column if not exists evidencia_moderacao_observacao text;
alter table public.demandas add column if not exists aviso_privacidade_versao text;
alter table public.demandas add column if not exists aviso_privacidade_data timestamptz;
alter table public.demandas alter column usuario_id drop not null;

create table if not exists public.historico_status_demandas (
  id uuid primary key,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  usuario_responsavel_id uuid,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.mobile_funil_agregado (
  dia date not null,
  evento text not null,
  src text not null default '',
  acao text not null default '',
  total bigint not null default 0,
  primary key (dia, evento, src, acao)
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

alter table public.usuarios enable row level security;
alter table public.demandas enable row level security;
alter table public.historico_status_demandas enable row level security;
alter table public.mobile_funil_agregado enable row level security;
alter table public.logs_auditoria enable row level security;

revoke all on public.usuarios from anon, authenticated;
revoke all on public.demandas from anon, authenticated;
revoke all on public.historico_status_demandas from anon, authenticated;
revoke all on public.mobile_funil_agregado from anon, authenticated;
revoke all on public.logs_auditoria from anon, authenticated;
revoke all on schema private from anon, authenticated;
revoke all on private.admins from anon, authenticated;

commit;
