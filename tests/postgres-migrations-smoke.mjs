import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL não configurada.");

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
  connect_timeout: 5,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function scalar(query) {
  const rows = await sql.unsafe(query);
  return rows?.[0] ? Object.values(rows[0])[0] : undefined;
}

const migrationDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationDir)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort();

assert(files.length > 0, "Nenhuma migration SQL encontrada.");

try {
  await sql.unsafe(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end
    $$;
  `);

  for (const file of files) {
    const source = fs.readFileSync(path.join(migrationDir, file), "utf8");
    try {
      await sql.unsafe(source);
    } catch (error) {
      throw new Error(`Migration falhou: ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const expectedTables = [
    ["public", "usuarios"],
    ["public", "demandas"],
    ["public", "historico_status_demandas"],
    ["public", "demanda_evidencias"],
    ["public", "logs_auditoria"],
    ["private", "admins"],
  ];

  for (const [schema, table] of expectedTables) {
    const exists = await scalar(`
      select exists(
        select 1
        from information_schema.tables
        where table_schema = '${schema}' and table_name = '${table}'
      ) as ok
    `);
    assert(exists === true, `Tabela ausente após migrations: ${schema}.${table}`);
  }

  const expectedColumns = [
    ["private", "admins", "perfil_acesso"],
    ["public", "usuarios", "faixa_etaria"],
    ["public", "usuarios", "protecao_reforcada"],
    ["public", "demandas", "cep"],
    ["public", "demandas", "codigo_ibge"],
    ["public", "demandas", "tipo_problema"],
    ["public", "demandas", "idempotency_key"],
    ["public", "demandas", "request_fingerprint"],
    ["public", "demandas", "evidencia_upload_status"],
    ["public", "demandas", "evidencia_upload_solicitadas"],
    ["public", "demandas", "evidencia_upload_anexadas"],
    ["public", "demandas", "evidencia_upload_falhas"],
  ];

  for (const [schema, table, column] of expectedColumns) {
    const exists = await scalar(`
      select exists(
        select 1
        from information_schema.columns
        where table_schema = '${schema}'
          and table_name = '${table}'
          and column_name = '${column}'
      ) as ok
    `);
    assert(exists === true, `Coluna ausente após migrations: ${schema}.${table}.${column}`);
  }

  for (const table of ["usuarios", "demandas", "historico_status_demandas", "demanda_evidencias", "logs_auditoria"]) {
    const enabled = await scalar(`
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = '${table}'
    `);
    assert(enabled === true, `RLS não habilitado em public.${table}`);
  }

  for (const role of ["anon", "authenticated"]) {
    for (const table of ["usuarios", "demandas", "demanda_evidencias", "logs_auditoria"]) {
      const [row] = await sql.unsafe(`
        select
          has_table_privilege('${role}', 'public.${table}', 'select') as sel,
          has_table_privilege('${role}', 'public.${table}', 'insert') as ins,
          has_table_privilege('${role}', 'public.${table}', 'update') as upd,
          has_table_privilege('${role}', 'public.${table}', 'delete') as del
      `);
      assert(!row.sel && !row.ins && !row.upd && !row.del, `${role} possui privilégio direto em public.${table}`);
    }
  }

  for (const role of ["anon", "authenticated"]) {
    const privateUsage = await scalar(`select has_schema_privilege('${role}', 'private', 'usage') as ok`);
    assert(privateUsage === false, `Schema private exposto ao papel ${role}`);
  }

  const idempotencyIndex = await scalar(`
    select exists(
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'demandas'
        and indexname = 'idx_demandas_idempotency_key'
    ) as ok
  `);
  assert(idempotencyIndex === true, "Índice único de idempotência ausente.");

  for (const constraint of [
    "demandas_categoria_taxonomia_check",
    "demandas_tipo_problema_taxonomia_check",
    "demandas_evidencia_upload_status_check",
    "demandas_evidencia_upload_counts_check",
  ]) {
    const [row] = await sql.unsafe(`
      select convalidated
      from pg_constraint
      where conname = '${constraint}'
      limit 1
    `);
    assert(row?.convalidated === true, `Constraint ausente ou não validada: ${constraint}`);
  }

  console.log(`PostgreSQL migration smoke OK: ${files.length} migrations aplicadas em ordem, schema/RLS/grants essenciais validados.`);
} finally {
  await sql.end({ timeout: 2 });
}
