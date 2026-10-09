import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/verify-staging-destinations.mjs");
const STAGE = "zqxouixpokuprqqscnwf";
const PROD = "jnlfmiwczpglojqytrbw";
const LEAK_TEST = "FAKE_SECRET_MUST_NOT_BE_PRINTED";
const pooler = "@aws-0-us-west-2.pooler.supabase.com:6543/postgres";
const fake = {
  RAILWAY_PROJECT_ID: "acd59c0a-4723-4162-9bfc-33bab1f096b0",
  RAILWAY_ENVIRONMENT_NAME: "homologacao",
  RAILWAY_ENVIRONMENT_ID: "32940765-7ef3-41c1-a017-48ad13120d65",
  RAILWAY_SERVICE_ID: "98959349-60d9-4363-b7c3-e20e04e93a71",
  SUPABASE_URL: "https://" + STAGE + ".supabase.co",
  DATABASE_URL: "postgresql://postgres." + STAGE + ":" + LEAK_TEST + pooler + "?sslmode=require",
  SUPABASE_EVIDENCE_BUCKET: "evidencias-qa",
  SUPABASE_SERVICE_ROLE_KEY: LEAK_TEST
};

function run(patch = {}) {
  const env = { ...process.env, ...fake, ...patch };
  for (const [k, v] of Object.entries(env)) {
    if (v == null) delete env[k];
  }
  const result = spawnSync(process.execPath, [script], {
    env, encoding: "utf8", timeout: 7000, maxBuffer: 128 * 1024
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(LEAK_TEST));
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\//);
  return result;
}

test("homologação sintética: banco/API consistentes, mas implantação não autorizada", () => {
  const x = run();
  assert.equal(x.status, 0, x.stderr);
  assert.match(x.stdout, /PREFLIGHT_CONFIG=OK_PARCIAL/);
  assert.match(x.stdout, /IDENTIDADE_REAL_STORAGE=NAO_COMPROVADA/);
  assert.match(x.stdout, /LIBERACAO_IMPLANTACAO=NAO_AUTORIZADA/);
});

test("banco e API de produção bloqueiam", () => {
  const x = run({
    SUPABASE_URL: "https://" + PROD + ".supabase.co",
    DATABASE_URL: "postgresql://postgres." + PROD + ":secret" + pooler
  });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /SUPABASE_API_PROJETO=DIVERGENTE/);
  assert.match(x.stdout, /POSTGRES_PROJETO=DIVERGENTE/);
});

test("pooler sem tenant no login falha fechado", () => {
  const x = run({ DATABASE_URL: "postgresql://postgres:fake" + pooler });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /POSTGRES_PROJETO=INCONCLUSIVO/);
});

test("hostname desconhecido não é aceito mesmo com tenant correto no login", () => {
  const x = run({ DATABASE_URL: "postgresql://postgres." + STAGE + ":fake@host-nao-oficial.example:6543/postgres" });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /POSTGRES_PROJETO=INCONCLUSIVO/);
});

test("tenant conflitante entre hostname direto e username bloqueia", () => {
  const x = run({ DATABASE_URL: "postgresql://postgres." + PROD + ":fake@db." + STAGE + ".supabase.co:5432/postgres" });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /POSTGRES_PROJETO=DIVERGENTE/);
  assert.match(x.stdout, /BANCO_API_CONSISTENTES=DIVERGENTE/);
});

test("hostname direto oficial é reconhecido com login postgres", () => {
  const x = run({ DATABASE_URL: "postgresql://postgres:fake@db." + STAGE + ".supabase.co:5432/postgres" });
  assert.equal(x.status, 0);
  assert.match(x.stdout, /POSTGRES_PROJETO=OK/);
});

test("ID do ambiente Railway errado é bloqueado", () => {
  const x = run({ RAILWAY_ENVIRONMENT_ID: "f98f4dbc-569c-4f8d-bbe9-2933fa59f06e" });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /RAILWAY_AMBIENTE_ID=DIVERGENTE/);
});

test("bucket não configurado bloqueia mesmo se o banco corresponder", () => {
  const x = run({ SUPABASE_EVIDENCE_BUCKET: "" });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /STORAGE_BUCKET_CONFIGURADO=INCONCLUSIVO/);
});

test("URL de API não oficial é inconclusiva", () => {
  const x = run({ SUPABASE_URL: "https://" + STAGE + ".supabase.co.evil.example" });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /SUPABASE_API_PROJETO=INCONCLUSIVO/);
});

test("sem variáveis Railway, negar por padrão", () => {
  const x = run({
    RAILWAY_PROJECT_ID: null, RAILWAY_ENVIRONMENT_NAME: null,
    RAILWAY_ENVIRONMENT_ID: null, RAILWAY_SERVICE_ID: null,
    DATABASE_URL: null, SUPABASE_URL: null,
    SUPABASE_EVIDENCE_BUCKET: null, SUPABASE_SERVICE_ROLE_KEY: null
  });
  assert.equal(x.status, 2);
  assert.match(x.stdout, /PREFLIGHT_CONFIG=BLOQUEADO/);
});
