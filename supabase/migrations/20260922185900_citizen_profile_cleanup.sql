-- Remove campos legados de pontuação/verificação individual do perfil cidadão.
-- A base operacional foi reiniciada e estes campos não possuem uso ativo na aplicação.
begin;

alter table public.usuarios
  drop column if exists indice_contribuicao_civica;

alter table public.usuarios
  drop column if exists nivel_verificacao;

commit;
