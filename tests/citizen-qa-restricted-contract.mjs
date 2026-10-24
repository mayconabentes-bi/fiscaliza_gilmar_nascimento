import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("docs/qa-citizen-restricted-functions-REVIEW.sql", "utf8");
const script = readFileSync("tests/citizen-auth-e2e-manual.mjs", "utf8");

assert.match(sql, /SECURITY DEFINER/g, "Functions must be explicit security definers");
assert.match(sql, /SET search_path = pg_catalog, pg_temp/g, "Functions must use a controlled search path");
assert.match(sql, /REVOKE ALL ON FUNCTION public\.fiscalize_qa_lookup_citizen\(text\) FROM PUBLIC/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.fiscalize_qa_delete_citizen\(uuid,text\) FROM PUBLIC/);
assert.match(sql, /p_email !~ '\^fiscalize-qa-/);
assert.doesNotMatch(sql, /p_email <> \('fiscalize-qa-' \|\| p_id/, "Server ID is NOT email random UUID");
assert.match(sql, /u\.id = p_id\s+AND u\.email = p_email/);
assert.match(sql, /u\.nome_completo = 'FISCALIZE QA AUTOMATIZADO'/);
assert.match(sql, /u\.created_at >= pg_catalog\.now\(\) - interval '1 hour'/);
for (const table of ["agradecimentos_propostas","apoios_qualificados","comentarios_tecnicos","demandas","denuncias","propostas_civicas","publicacoes"]) {
  assert.ok(sql.includes("public." + table), "Missing FK dependency guard: " + table);
}
assert.match(script, /FISCALIZE_QA_ALLOWED_ORIGIN/);
assert.match(script, /HOMOLOGATION_ORIGIN/);
assert.match(script, /HOMOLOGATION_DB_REF/);
assert.match(script, /EXPECTED_QA_ROLE/);
assert.match(script, /current_user as role/);
assert.match(script, /FISCALIZE_QA_DB_PASSWORD/);
assert.match(script, /FISCALIZE_QA_REGISTRATION_TOKEN/);
assert.match(script, /x-fiscalize-qa-registration-token/);
const gate = readFileSync("src/server/goLiveSecurity.ts", "utf8");
for (const check of [
  "FISCALIZE_QA_REGISTRATION_ENABLED", "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_SERVICE_NAME", "QA_SUPABASE", "QA_ORIGIN",
  "timingSafeEqual", "QA_EMAIL"
]) assert.ok(gate.includes(check), "QA gate missing " + check);
const workflow = readFileSync(".github/workflows/citizen-auth-e2e-manual.yml", "utf8");
assert.match(workflow, /FISCALIZE_QA_BASE_URL: https:\/\/fiscalize-homologacao-homologacao[.]up[.]railway[.]app/);
assert.doesNotMatch(workflow, /secrets[.]FISCALIZE_QA_BASE_URL|vars[.]FISCALIZE_QA_ALLOWED_ORIGIN/, "Old production URL sources cannot control manual QA target");
assert.match(workflow, /secrets[.]FISCALIZE_QA_DB_PASSWORD/);
assert.match(workflow, /secrets[.]FISCALIZE_QA_REGISTRATION_TOKEN/);
assert.doesNotMatch(workflow, /secrets[.]FISCALIZE_QA_DATABASE_URL/, "Never reuse old DB URL secret");
assert.match(script, /type: "cidadao"/);
assert.match(script, /fiscalize_qa_lookup_citizen/);
assert.match(script, /fiscalize_qa_delete_citizen/);
assert.doesNotMatch(script, /(?:delete from|select id from) public\.usuarios/i, "No direct base table access");
console.log("QA constrained SQL and manual E2E contract OK (static only; no DB/HTTP calls).");
