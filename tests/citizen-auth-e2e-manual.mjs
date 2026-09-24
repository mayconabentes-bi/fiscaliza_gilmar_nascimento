import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

// Manual-only E2E against an explicitly configured environment.
// The DB connection must point to the SAME database as TARGET_BASE_URL.
// QA DB role has EXECUTE only on two constrained security-definer functions.
const HOMOLOGATION_ORIGIN = "https://fiscalize-homologacao-homologacao.up.railway.app";
const HOMOLOGATION_DB_REF = "zqxouixpokuprqqscnwf";
const EXPECTED_QA_ROLE = "fiscalize_qa_runner";
const base = process.env.FISCALIZE_QA_BASE_URL;
const databaseUrl = process.env.FISCALIZE_QA_DATABASE_URL;
if (!base || !databaseUrl) throw new Error("QA URL and QA database connection are required.");
const url = new URL(base);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
  throw new Error("QA URL must be an HTTPS origin only.");
}
const allowed = process.env.FISCALIZE_QA_ALLOWED_ORIGIN;
if (!allowed || url.origin !== HOMOLOGATION_ORIGIN || allowed !== HOMOLOGATION_ORIGIN) {
  throw new Error("QA target does not exactly match explicit allowlisted origin.");
}

// Refuse to run if configuration points to production or uses a privileged DB account.
const dbConnection = new URL(databaseUrl);
const dbUser = decodeURIComponent(dbConnection.username);
const host = dbConnection.hostname.toLowerCase();
const directHost = host === `db.${HOMOLOGATION_DB_REF}.supabase.co`;
const poolerHost = host.endsWith(".pooler.supabase.com");
if (dbConnection.protocol !== "postgresql:" && dbConnection.protocol !== "postgres:") {
  throw new Error("QA connection must use PostgreSQL.");
}
if (!(directHost && dbUser === EXPECTED_QA_ROLE) &&
    !(poolerHost && dbUser === `${EXPECTED_QA_ROLE}.${HOMOLOGATION_DB_REF}`)) {
  throw new Error("QA DB host, project ref or technical role does not match isolated homologation.");
}
const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require", connect_timeout: 5 });
const id = randomUUID();
const email = `fiscalize-qa-${id}@example.invalid`;
const password = randomBytes(32).toString("base64url");
let createdId = null;
let registered = false;
let outcome = "NOT_STARTED";
let cleanup = "NOT_REQUIRED";
const timeoutMs = 12000;

async function post(path, body) {
  const res = await fetch(new URL(path, url), {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  // Never print raw server payload, cookies, JWT, emails or password.
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, id: typeof payload.id === "string" ? payload.id : null, hasUser: Boolean(payload.user) };
}
try {
  const identity = await sql`select current_user as role`;
  assert.equal(identity[0]?.role, EXPECTED_QA_ROLE, "QA login did not use restricted technical role");
  const existing = await sql`select id from public.fiscalize_qa_lookup_citizen(${email})`;
  assert.equal(existing.length, 0, "QA identity collision");
  const reg = await post("/api/auth/register/cidadao", {
    nome_completo: "FISCALIZE QA AUTOMATIZADO",
    email, password, municipio: "Manaus", bairro: "QA AUTOMATIZADO",
    faixa_etaria: "AGE_25_34", aceite_codigo: true, aceite_lgpd: true,
  });
  outcome = `REGISTER_HTTP_${reg.status}`;
  if (reg.status !== 201 || !reg.id) throw new Error(outcome);
  registered = true;
  createdId = reg.id;
  const rows = await sql`select id, status from public.fiscalize_qa_lookup_citizen(${email})`;
  if (rows.length !== 1) throw new Error("REGISTERED_ACCOUNT_NOT_IN_QA_DATABASE");
  if (rows[0].status !== "ativo") throw new Error("REGISTERED_ACCOUNT_NOT_ACTIVE");
  const login = await post("/api/auth/login", { email, password, type: "cidadao" });
  outcome = `REGISTER_201_LOGIN_${login.status}`;
  if (login.status !== 200 || !login.hasUser) throw new Error(outcome);
  outcome = "REGISTER_201_LOGIN_200";
} catch (error) {
  console.error("QA outcome:", outcome, "reason:", String(error?.message || "UNKNOWN").replace(/fiscalize-qa-[^\\s]+/g, "[QA]"));
  process.exitCode = 1;
} finally {
  // Cleanup by BOTH returned UUID and random QA email. No broad deletion.
  // If registration succeeded but response was interrupted, look up the exact QA email.
  try {
    const rows = await sql`select id from public.fiscalize_qa_lookup_citizen(${email})`;
    if (rows.length > 1 || (createdId && rows.some(row => row.id !== createdId))) {
      throw new Error("QA_CLEANUP_IDENTITY_MISMATCH");
    }
    if (rows.length === 1) {
      const result = await sql`select public.fiscalize_qa_delete_citizen(${rows[0].id}, ${email}) as deleted`;
      if (result[0]?.deleted !== true) throw new Error("QA_CLEANUP_NOT_DELETED");
    }
    const after = await sql`select id from public.fiscalize_qa_lookup_citizen(${email})`;
    if (after.length !== 0) throw new Error("QA_CLEANUP_NOT_VERIFIED");
    cleanup = "VERIFIED";
  } catch (error) {
    cleanup = "FAILED_REQUIRES_MANUAL_REVIEW";
    process.exitCode = 1;
    console.error("QA cleanup requires manual review:", String(error?.message || "UNKNOWN"));
  }
  await sql.end({ timeout: 5 });
  console.log(JSON.stringify({ test: "citizen_registration_login", outcome, cleanup, created: registered }));
}
