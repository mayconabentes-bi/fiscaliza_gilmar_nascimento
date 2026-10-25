-- Central de encaminhamentos cívicos: registros privados, sem acesso direto público.
create schema if not exists private;
create table if not exists private.encaminhamentos_civicos (
  id uuid primary key,
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  destinatario varchar(180) not null,
  canal varchar(40) not null check (canal in ('OUVIDORIA','PORTAL','EMAIL','PRESENCIAL','OFICIO','OUTRO')),
  referencia_externa varchar(160),
  situacao varchar(32) not null default 'PREPARADO'
    check (situacao in ('PREPARADO','ENVIADO','PROTOCOLADO','AGUARDANDO_RESPOSTA','RESPONDIDO','ENCERRADO')),
  resumo text not null,
  retorno_publico text,
  observacao_privada text,
  data_envio timestamptz,
  data_protocolo timestamptz,
  proxima_verificacao timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocolo_externo_requires_reference
    check (situacao <> 'PROTOCOLADO' or nullif(btrim(referencia_externa), '') is not null)
);
create index if not exists idx_encaminhamentos_demanda on private.encaminhamentos_civicos(demanda_id, created_at desc);
create index if not exists idx_encaminhamentos_proxima on private.encaminhamentos_civicos(proxima_verificacao)
 where situacao not in ('RESPONDIDO','ENCERRADO');

create table if not exists private.encaminhamentos_civicos_eventos (
 id uuid primary key,
 encaminhamento_id uuid not null references private.encaminhamentos_civicos(id) on delete cascade,
 autor_id uuid,
 situacao_anterior varchar(32),
 situacao_nova varchar(32) not null,
 nota_privada text,
 created_at timestamptz not null default now()
);
create index if not exists idx_encaminhamentos_eventos on private.encaminhamentos_civicos_eventos(encaminhamento_id, created_at desc);

alter table private.encaminhamentos_civicos enable row level security;
alter table private.encaminhamentos_civicos_eventos enable row level security;
revoke all on private.encaminhamentos_civicos from public, anon, authenticated;
revoke all on private.encaminhamentos_civicos_eventos from public, anon, authenticated;
