-- Inteligência etária detalhada com compatibilidade histórica.
-- Não cria data de nascimento, idade exata, documento, biometria ou qualquer identificador adicional.
begin;

alter table public.usuarios
  drop constraint if exists usuarios_faixa_etaria_check;

alter table public.usuarios
  add constraint usuarios_faixa_etaria_check
  check (
    faixa_etaria is null or faixa_etaria in (
      'AGE_16_17',
      'AGE_18_24',
      'AGE_25_34',
      'AGE_35_44',
      'AGE_45_59',
      'AGE_60_PLUS',
      'AGE_18_PLUS'
    )
  );

alter table public.demandas
  drop constraint if exists demandas_faixa_etaria_check;

alter table public.demandas
  add constraint demandas_faixa_etaria_check
  check (
    faixa_etaria is null or faixa_etaria in (
      'AGE_16_17',
      'AGE_18_24',
      'AGE_25_34',
      'AGE_35_44',
      'AGE_45_59',
      'AGE_60_PLUS',
      'AGE_18_PLUS'
    )
  );

-- AGE_18_PLUS permanece válido apenas para preservar contas e demandas anteriores.
-- Novos formulários passam a usar as faixas detalhadas.
commit;
