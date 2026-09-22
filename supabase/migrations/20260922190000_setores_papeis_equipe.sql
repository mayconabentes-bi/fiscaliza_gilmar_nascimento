-- Fase 1: setores do gabinete e papéis da equipe (ADMIN, COORDENADOR, ATENDENTE).
-- Cada setor responde por uma ou mais categorias de demanda.
begin;

create table if not exists private.setores (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Uma categoria pertence a um único setor (unique em categoria).
create table if not exists private.setor_categorias (
  setor_id uuid not null references private.setores(id) on delete cascade,
  categoria text not null unique,
  primary key (setor_id, categoria)
);

alter table private.admins add column if not exists setor_id uuid references private.setores(id);

-- Papéis permitidos. SUPER_ADMIN e ADMIN veem tudo; COORDENADOR e ATENDENTE precisam de setor.
alter table private.admins drop constraint if exists admins_perfil_acesso_check;
alter table private.admins add constraint admins_perfil_acesso_check
  check (perfil_acesso in ('SUPER_ADMIN', 'ADMIN', 'COORDENADOR', 'ATENDENTE'));

alter table private.admins drop constraint if exists admins_setor_obrigatorio_check;
alter table private.admins add constraint admins_setor_obrigatorio_check
  check (perfil_acesso in ('SUPER_ADMIN', 'ADMIN') or setor_id is not null);

create index if not exists idx_admins_setor on private.admins(setor_id);

-- Setores iniciais: um por categoria da taxonomia de demandas.
insert into private.setores (codigo, nome) values
  ('INFRAESTRUTURA_URBANA', 'Infraestrutura Urbana'),
  ('LIMPEZA_URBANA', 'Limpeza Urbana'),
  ('MOBILIDADE_TRANSITO', 'Mobilidade e Trânsito'),
  ('MEIO_AMBIENTE', 'Meio Ambiente'),
  ('SAUDE', 'Saúde'),
  ('EDUCACAO', 'Educação'),
  ('ASSISTENCIA_SOCIAL', 'Assistência Social'),
  ('SEGURANCA_ORDEM_URBANA', 'Segurança e Ordem Urbana'),
  ('OUTRO', 'Atendimento Geral')
on conflict (codigo) do nothing;

insert into private.setor_categorias (setor_id, categoria)
select id, codigo from private.setores
on conflict do nothing;

revoke all on private.setores from anon, authenticated;
revoke all on private.setor_categorias from anon, authenticated;

commit;