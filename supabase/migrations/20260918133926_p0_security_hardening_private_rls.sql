-- Hardening aplicado em produção em 2026-09-18 (versão 20260918133926) e trazido ao repositório
-- para que o histórico local seja igual ao do Supabase.
-- rls_auto_enable() é criada pela própria plataforma Supabase; por isso o bloco é condicional
-- (no Postgres puro da CI a função não existe).
begin;

alter table private.admins enable row level security;
alter table private.intelligence_source_health enable row level security;
alter table private.intelligence_snapshots enable row level security;
alter table private.intelligence_refresh_runs enable row level security;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      grant execute on function public.rls_auto_enable() to postgres, service_role;
    else
      grant execute on function public.rls_auto_enable() to postgres;
    end if;
  end if;
end
$$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
