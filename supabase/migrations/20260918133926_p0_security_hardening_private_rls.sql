-- P0 security hardening: defense in depth for private schema and function privileges
begin;

alter table private.admins enable row level security;
alter table private.intelligence_source_health enable row level security;
alter table private.intelligence_snapshots enable row level security;
alter table private.intelligence_refresh_runs enable row level security;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to postgres, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
