import assert from "node:assert/strict";
import postgres from "postgres";

// Read-only probe. Never emit credentials, database host or connection errors
// containing URLs. Exit before connecting if ANY target-identity check fails.
// Build the URI from the raw restricted-role password to eliminate URL encoding errors.
// The host/project/role are pinned to the isolated homologation database.
const qaPassword = process.env.FISCALIZE_QA_DB_PASSWORD;
if (!qaPassword) throw new Error("QA_DB_PASSWORD_SECRET_MISSING");
const raw = new URL("postgresql://aws-0-us-west-2.pooler.supabase.com:5432/postgres");
raw.username = "fiscalize_qa_runner.zqxouixpokuprqqscnwf";
raw.password = qaPassword;
raw.searchParams.set("sslmode", "require");
const databaseUrl = raw.toString();
let target;
try { target = new URL(databaseUrl); } catch { throw new Error("QA_DATABASE_URL_INVALID"); }
const ref = "zqxouixpokuprqqscnwf";
const user = decodeURIComponent(target.username);
const direct = target.hostname === `db.${ref}.supabase.co` && user === "fiscalize_qa_runner";
const pooler = target.hostname.endsWith(".pooler.supabase.com") && user === `fiscalize_qa_runner.${ref}`;
assert.ok(["postgres:", "postgresql:"].includes(target.protocol), "QA_DB_INVALID_PROTOCOL");
// Non-sensitive diagnostics only: never log host, user, URL or credential.
if (!direct && !pooler) {
  console.error("QA_DB_TARGET_CLASSIFICATION", JSON.stringify({
    expectedDirectHost: target.hostname === `db.${ref}.supabase.co`,
    isSupabasePoolerHost: target.hostname.endsWith(".pooler.supabase.com"),
    isRestrictedDirectUser: user === "fiscalize_qa_runner",
    isRestrictedPoolerUser: user === `fiscalize_qa_runner.${ref}`,
    hasPassword: Boolean(target.password)
  }));
}
assert.ok(direct || pooler, "QA_DB_IS_NOT_STAGING_RESTRICTED_ROLE");
assert.equal(target.pathname, "/postgres", "QA_DB_UNEXPECTED_DATABASE");
assert.equal(target.searchParams.get("sslmode"), "require", "QA_DB_MUST_REQUIRE_SSL");

const sql = postgres(databaseUrl, {
  max: 1, prepare: false, ssl: "require", connect_timeout: 6,
  idle_timeout: 1
});
try {
  const [row] = await sql`
    select current_user as db_role,
      has_table_privilege(current_user, 'public.usuarios', 'SELECT') as direct_read,
      has_table_privilege(current_user, 'public.usuarios', 'DELETE') as direct_delete,
      has_function_privilege(current_user, 'public.fiscalize_qa_lookup_citizen(text)', 'EXECUTE') as qa_lookup,
      has_function_privilege(current_user, 'public.fiscalize_qa_delete_citizen(uuid,text)', 'EXECUTE') as qa_delete
  `;
  assert.equal(row.db_role, "fiscalize_qa_runner", "QA_DB_WRONG_LOGIN_ROLE");
  assert.equal(row.direct_read, false, "QA_DB_DIRECT_READ_FORBIDDEN");
  assert.equal(row.direct_delete, false, "QA_DB_DIRECT_DELETE_FORBIDDEN");
  assert.equal(row.qa_lookup, true, "QA_DB_LOOKUP_PERMISSION_MISSING");
  assert.equal(row.qa_delete, true, "QA_DB_CLEANUP_PERMISSION_MISSING");
  const found = await sql`select id from public.fiscalize_qa_lookup_citizen(
    'fiscalize-qa-00000000-0000-0000-0000-000000000000@example.invalid')`;
  assert.equal(found.length, 0, "QA_DB_TEST_IDENTITY_NOT_EMPTY");
  console.log("QA_DB_READ_ONLY_CHECK_PASS: restricted role, permissions, staging target, no test identity");
} catch (err) {
  // Deliberately never print raw database error, which may embed endpoint details.
  // Log only a fixed diagnostic category, never the raw message, URL, user or password.
  const safeCategory = {
    "28P01": "AUTH_INVALID_PASSWORD",
    "28000": "AUTH_OR_POOLER_TENANT",
    "42501": "DATABASE_PERMISSION_DENIED",
    "3D000": "DATABASE_NAME_REJECTED",
    "ENOTFOUND": "DNS_LOOKUP_FAILED",
    "EAI_AGAIN": "DNS_TEMPORARY_FAILURE",
    "ETIMEDOUT": "NETWORK_TIMEOUT",
    "ECONNREFUSED": "NETWORK_CONNECTION_REFUSED",
    "SELF_SIGNED_CERT_IN_CHAIN": "TLS_CERTIFICATE_REJECTED"
  }[err?.code] || (err?.name === "AssertionError"
      ? "RESTRICTED_ROLE_OR_PERMISSION_ASSERTION"
      : "OTHER_CONNECTION_OR_QUERY_FAILURE");
  console.error("QA_DB_READ_ONLY_CHECK_FAILED:", safeCategory);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 }).catch(() => {});
}
