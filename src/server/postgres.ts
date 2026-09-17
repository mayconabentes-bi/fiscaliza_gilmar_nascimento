import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function getPostgres() {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  client = postgres(connectionString, {
    // Vercel executa a API em funções serverless. Mantemos uma única conexão
    // por instância quente para evitar esgotar o pool remoto do Postgres.
    max: 1,
    // Necessário ao usar o Transaction Pooler (Supavisor) do Supabase.
    prepare: false,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return client;
}

export async function checkPostgresConnection() {
  const sql = getPostgres();
  const [result] = await sql`select 1 as ok`;
  return Number(result?.ok) === 1;
}

export async function closePostgres() {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = null;
}
