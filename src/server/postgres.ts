import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function getPostgres() {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  client = postgres(connectionString, {
    max: 5,
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
