-- Registra versão e data do aceite dos Termos de Uso no cadastro cidadão.
begin;

alter table public.usuarios
  add column if not exists termos_uso_aceito boolean not null default false;

alter table public.usuarios
  add column if not exists data_aceite_termos timestamptz;

alter table public.usuarios
  add column if not exists versao_termos text;

revoke all on public.usuarios from anon, authenticated;

commit;
