import fs from "node:fs";
import postgres from "postgres";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL não configurada.");

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: false,
  connect_timeout: 5,
});

const migrations = [
  "supabase/migrations/20260913163437_pulso_postgres_foundation.sql",
  "supabase/migrations/20260915040000_p0d_production_persistence.sql",
  "supabase/migrations/20260915160000_p0e_age_protection.sql",
  "supabase/migrations/20260917123000_demand_location_cep.sql",
  "supabase/migrations/20260918110000_demand_multi_evidence.sql",
  "supabase/migrations/20260918133926_p0_security_hardening_private_rls.sql",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function scalar(query) {
  const rows = await sql.unsafe(query);
  return rows?.[0] ? Object.values(rows[0])[0] : undefined;
}

try {
  await sql.unsafe(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end
    $$;
  `);

  await sql.unsafe(`
    create or replace function public.rls_auto_enable()
    returns void
    language sql
    security definer
    set search_path = pg_catalog
    as 'select null::void';
  `);

  for (const file of migrations) {
    const migration = fs.readFileSync(file, "utf8");
    await sql.unsafe(migration);
  }

  const expectedTables = [
    ["public", "usuarios"],
    ["public", "demandas"],
    ["public", "historico_status_demandas"],
    ["public", "demanda_evidencias"],
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
    ["public", "demandas", "revisao_reforcada"],
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

  const rlsTables = [
    "usuarios",
    "demandas",
    "historico_status_demandas",
    "demanda_evidencias",
  ];
  for (const table of rlsTables) {
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
      const privileges = await sql.unsafe(`
        select
          has_table_privilege('${role}', 'public.${table}', 'select') as sel,
          has_table_privilege('${role}', 'public.${table}', 'insert') as ins,
          has_table_privilege('${role}', 'public.${table}', 'update') as upd,
          has_table_privilege('${role}', 'public.${table}', 'delete') as del
      `);
      const row = privileges[0];
      assert(!row.sel && !row.ins && !row.upd && !row.del, `${role} possui privilégio direto indevido em public.${table}`);
    }
  }

  for (const table of ["admins", "intelligence_source_health", "intelligence_snapshots", "intelligence_refresh_runs"]) {
    const enabled = await scalar(`
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relname = '${table}'
    `);
    assert(enabled === true, `RLS não habilitado em private.${table}`);
  }

  const anonFunctionExecute = await scalar("select has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') as ok");
  const authFunctionExecute = await scalar("select has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') as ok");
  const postgresFunctionExecute = await scalar("select has_function_privilege('postgres', 'public.rls_auto_enable()', 'execute') as ok");
  const serviceFunctionExecute = await scalar("select has_function_privilege('service_role', 'public.rls_auto_enable()', 'execute') as ok");
  assert(anonFunctionExecute === false && authFunctionExecute === false, "Função SECURITY DEFINER exposta a anon/authenticated.");
  assert(postgresFunctionExecute === true && serviceFunctionExecute === true, "Papéis backend perderam execução da função protegida.");

  const privateUsageAnon = await scalar("select has_schema_privilege('anon', 'private', 'usage') as ok");
  const privateUsageAuth = await scalar("select has_schema_privilege('authenticated', 'private', 'usage') as ok");
  assert(privateUsageAnon === false && privateUsageAuth === false, "Schema private exposto a anon/authenticated.");

  const userId = "11111111-1111-4111-8111-111111111111";
  const demandId = "22222222-2222-4222-8222-222222222222";

  await sql.unsafe(`
    insert into public.usuarios (
      id, nome_completo, email, municipio, bairro, password_hash,
      consentimento_lgpd, faixa_etaria, protecao_reforcada
    ) values (
      '${userId}', 'QA Production Like', 'qa-prodlike@example.org',
      'Manaus', 'Centro', 'hash-qa', true, 'AGE_18_PLUS', false
    )
  `);

  await sql.unsafe(`
    insert into public.demandas (
      id, protocolo, nome_solicitante, municipio, bairro, categoria,
      descricao, prioridade, status, usuario_id, faixa_etaria,
      aviso_privacidade_versao, aviso_privacidade_data, cep, uf, codigo_ibge
    ) values (
      '${demandId}', 'AM-20990101-AAAAAAAAAAAAAAAA', 'QA Production Like',
      'Manaus', 'Centro', 'Infraestrutura', 'Teste production-like',
      'ALTA', 'RECEBIDA', '${userId}', 'AGE_18_PLUS',
      'qa-prodlike-v1', now(), '69000000', 'AM', '1302603'
    )
  `);

  for (let ordem = 1; ordem <= 7; ordem += 1) {
    await sql.unsafe(`
      insert into public.demanda_evidencias (
        id, demanda_id, storage_path, mime, ordem, moderacao_status
      ) values (
        gen_random_uuid(), '${demandId}', 'qa/${demandId}/${ordem}.jpg',
        'image/jpeg', ${ordem}, 'PENDENTE'
      )
    `);
  }

  const count = Number(await scalar(`select count(*)::int as total from public.demanda_evidencias where demanda_id = '${demandId}'`));
  assert(count === 7, `Esperadas 7 evidências, encontradas ${count}.`);

  let eighthRejected = false;
  try {
    await sql.unsafe(`
      insert into public.demanda_evidencias (
        id, demanda_id, storage_path, mime, ordem
      ) values (
        gen_random_uuid(), '${demandId}', 'qa/${demandId}/8.jpg',
        'image/jpeg', 8
      )
    `);
  } catch {
    eighthRejected = true;
  }
  assert(eighthRejected, "Banco aceitou evidência com ordem 8.");

  let duplicateRejected = false;
  try {
    await sql.unsafe(`
      insert into public.demanda_evidencias (
        id, demanda_id, storage_path, mime, ordem
      ) values (
        gen_random_uuid(), '${demandId}', 'qa/${demandId}/1-duplicada.jpg',
        'image/jpeg', 1
      )
    `);
  } catch {
    duplicateRejected = true;
  }
  assert(duplicateRejected, "Banco aceitou ordem duplicada de evidência.");

  await sql.unsafe(`delete from public.demandas where id = '${demandId}'`);
  const afterCascade = Number(await scalar(`select count(*)::int as total from public.demanda_evidencias where demanda_id = '${demandId}'`));
  assert(afterCascade === 0, "Cascade de demanda_evidencias não removeu registros filhos.");

  console.log("Postgres production-like OK: migrations zero-to-current, RLS, grants, 1-7 evidências e cascade.");
} finally {
  await sql.end({ timeout: 2 });
}
