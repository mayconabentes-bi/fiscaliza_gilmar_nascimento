import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

let client: SqlClient | null = null;
let lastHealthCheckAt = 0;
let healthCheckInFlight: Promise<SqlClient> | null = null;

const HEALTH_TTL_MS = 5_000;

function createPostgresClient() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  return postgres(connectionString, {
    // O projeto usa o Transaction Pooler do Supabase (porta 6543). Mantemos
    // um pool local pequeno, mas maior que 1, porque as telas privadas fazem
    // algumas leituras concorrentes na mesma instância.
    max: 3,
    prepare: false,
    ssl: "require",
    // Em serverless, conexões persistentes podem voltar de um congelamento com
    // socket obsoleto. Fechamos conexões agressivamente e renovamos sua vida útil.
    idle_timeout: 5,
    max_lifetime: 60,
    connect_timeout: 4,
  });
}

export function getPostgres() {
  if (!client) client = createPostgresClient();
  return client;
}

async function probeConnection(sql: SqlClient, timeoutMs: number) {
  const query = sql`select 1 as ok`.execute();
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const result = await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DB_PREFLIGHT_TIMEOUT")), timeoutMs);
      }),
    ]);
    return Number(result?.[0]?.ok) === 1;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function destroyClient(expected?: SqlClient) {
  if (!client) return;
  if (expected && client !== expected) return;

  const stale = client;
  client = null;
  lastHealthCheckAt = 0;
  try {
    // timeout 0 destrói imediatamente conexões pendentes/obsoletas.
    await stale.end({ timeout: 0 });
  } catch {
    // O próximo getPostgres() criará um cliente novo independentemente do erro.
  }
}

/**
 * Retorna um cliente Postgres validado para o ambiente serverless.
 *
 * A checagem é compartilhada entre chamadas concorrentes e mantida por alguns
 * segundos. Se a conexão aquecida estiver obsoleta, ela é descartada e uma nova
 * conexão é testada antes de liberar a requisição da API.
 */
export async function getHealthyPostgres() {
  if (client && Date.now() - lastHealthCheckAt < HEALTH_TTL_MS) return client;
  if (healthCheckInFlight) return healthCheckInFlight;

  healthCheckInFlight = (async () => {
    let sql = getPostgres();

    try {
      const ok = await probeConnection(sql, 1_500);
      if (!ok) throw new Error("DB_PREFLIGHT_FAILED");
      lastHealthCheckAt = Date.now();
      return sql;
    } catch {
      await destroyClient(sql);
      sql = getPostgres();
      try {
        const ok = await probeConnection(sql, 3_000);
        if (!ok) throw new Error("DB_PREFLIGHT_FAILED_AFTER_RECYCLE");
        lastHealthCheckAt = Date.now();
        return sql;
      } catch (error) {
        await destroyClient(sql);
        throw error;
      }
    }
  })();

  try {
    return await healthCheckInFlight;
  } finally {
    healthCheckInFlight = null;
  }
}

export async function checkPostgresConnection() {
  const sql = await getHealthyPostgres();
  const [result] = await sql`select 1 as ok`;
  return Number(result?.ok) === 1;
}

export async function closePostgres() {
  if (!client) return;
  const current = client;
  client = null;
  lastHealthCheckAt = 0;
  healthCheckInFlight = null;
  await current.end({ timeout: 5 });
}
