-- Garante bucket privado para evidências fotográficas de demandas.
-- Mantém a configuração idempotente e alinhada ao limite do backend (2 MiB).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias-demandas',
  'evidencias-demandas',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
