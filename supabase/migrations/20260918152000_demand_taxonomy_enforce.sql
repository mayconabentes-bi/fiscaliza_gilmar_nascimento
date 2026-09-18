-- Fase enforce da taxonomia estruturada.
-- Aplicar somente depois que a aplicação que envia categoria + tipo_problema estiver em produção.
begin;

alter table public.demandas
  drop constraint if exists demandas_categoria_taxonomia_check;

alter table public.demandas
  drop constraint if exists demandas_tipo_problema_taxonomia_check;

alter table public.demandas
  add constraint demandas_categoria_taxonomia_check
  check (
    categoria in (
      'INFRAESTRUTURA_URBANA',
      'LIMPEZA_URBANA',
      'MOBILIDADE_TRANSITO',
      'MEIO_AMBIENTE',
      'SAUDE',
      'EDUCACAO',
      'ASSISTENCIA_SOCIAL',
      'SEGURANCA_ORDEM_URBANA',
      'OUTRO'
    )
  ) not valid;

alter table public.demandas
  add constraint demandas_tipo_problema_taxonomia_check
  check (
    (categoria = 'INFRAESTRUTURA_URBANA' and tipo_problema in ('BURACO_PAVIMENTACAO','ILUMINACAO_PUBLICA','DRENAGEM_ALAGAMENTO','CALCADA','ACESSIBILIDADE','OBRA_PUBLICA','ESTRUTURA_DANIFICADA'))
    or (categoria = 'LIMPEZA_URBANA' and tipo_problema in ('LIXO_ACUMULADO','COLETA_NAO_REALIZADA','ENTULHO','DESCARTE_IRREGULAR','LIMPEZA_VIA','LIXEIRA_EQUIPAMENTO'))
    or (categoria = 'MOBILIDADE_TRANSITO' and tipo_problema in ('SEMAFORO','SINALIZACAO','TRANSPORTE_COLETIVO','PARADA_ONIBUS','VIA_BLOQUEADA','TRANSITO','ACESSIBILIDADE_MOBILIDADE'))
    or (categoria = 'MEIO_AMBIENTE' and tipo_problema in ('ARVORE_RISCO','PODA','QUEIMADA','POLUICAO','AREA_VERDE','IGARAPE_CORPO_DAGUA','DESCARTE_AMBIENTAL_IRREGULAR'))
    or (categoria = 'SAUDE' and tipo_problema in ('UNIDADE_SAUDE','ESTRUTURA_EQUIPAMENTO_SAUDE','ACESSO_SERVICO_SAUDE','VIGILANCIA_SANITARIA','OUTRO_PROBLEMA_COLETIVO_SAUDE'))
    or (categoria = 'EDUCACAO' and tipo_problema in ('ESCOLA_ESTRUTURA','MANUTENCAO_ESCOLAR','ACESSO_EDUCACAO','TRANSPORTE_ESCOLAR','EQUIPAMENTO_EDUCACIONAL'))
    or (categoria = 'ASSISTENCIA_SOCIAL' and tipo_problema in ('EQUIPAMENTO_SOCIAL','ATENDIMENTO_SOCIAL','ACESSO_SERVICO_SOCIAL','VULNERABILIDADE_COLETIVA'))
    or (categoria = 'SEGURANCA_ORDEM_URBANA' and tipo_problema in ('ILUMINACAO_SEGURANCA','ESPACO_PUBLICO_DEGRADADO','OCUPACAO_IRREGULAR','PERTURBACAO_URBANA','RISCO_EQUIPAMENTO_PUBLICO'))
    or (categoria = 'OUTRO' and tipo_problema = 'OUTRO_PROBLEMA')
  ) not valid;

alter table public.demandas validate constraint demandas_categoria_taxonomia_check;
alter table public.demandas validate constraint demandas_tipo_problema_taxonomia_check;

alter table public.demandas
  alter column tipo_problema set not null;

commit;
