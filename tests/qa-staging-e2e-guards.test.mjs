import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { checkTarget, labels } from "../scripts/qa-staging-sector-e2e.mjs";

const base = {
  RAILWAY_PROJECT_ID:"acd59c0a-4723-4162-9bfc-33bab1f096b0",
  RAILWAY_ENVIRONMENT_ID:"32940765-7ef3-41c1-a017-48ad13120d65",
  RAILWAY_SERVICE_ID:"98959349-60d9-4363-b7c3-e20e04e93a71",
  RAILWAY_ENVIRONMENT_NAME:"homologacao",
  SUPABASE_URL:"https://zqxouixpokuprqqscnwf.supabase.co",
  DATABASE_URL:"postgres://postgres.zqxouixpokuprqqscnwf:synthetic@aws-0-us-west-2.pooler.supabase.com:6543/postgres"
};
test("guard aceita somente identidade exata de homologacao",()=>{
  assert.equal(checkTarget(base),true);
});
for (const [label,patch] of [
  ["ambiente de producao",{RAILWAY_ENVIRONMENT_NAME:"production"}],
  ["ambiente ID errado",{RAILWAY_ENVIRONMENT_ID:"f98f4dbc-569c-4f8d-bbe9-2933fa59f06e"}],
  ["servico incorreto",{RAILWAY_SERVICE_ID:"f8736bdd-496d-4c6f-8736-d4b421b45406"}],
  ["projeto incorreto",{RAILWAY_PROJECT_ID:"other"}],
  ["endpoint de producao",{SUPABASE_URL:"https://jnlfmiwczpglojqytrbw.supabase.co"}],
  ["pooler do tenant de producao",{DATABASE_URL:"postgres://postgres.jnlfmiwczpglojqytrbw:synthetic@aws-0-us-west-2.pooler.supabase.com:6543/postgres"}],
  ["credencial DB ausente",{DATABASE_URL:"postgres://postgres.zqxouixpokuprqqscnwf@aws-0-us-west-2.pooler.supabase.com:6543/postgres"}],
  ["host DB externo",{DATABASE_URL:"postgres://postgres.zqxouixpokuprqqscnwf:synthetic@evil.invalid:6543/postgres"}],
  ["SSL explicitamente desabilitado",{DATABASE_URL:base.DATABASE_URL+"?sslmode=disable"}]
]) {
  test("guard bloqueia "+label,()=>{
    assert.equal(checkTarget({...base,...patch}),false);
  });
}
test("fixture gera apenas dois marcadores deterministas e inconfundiveis",()=>{
  const v=labels("0123456789abcdef");
  assert.equal(v.emails.length,2);
  assert(v.emails.every(x=>x.endsWith("@example.invalid")));
  assert(v.protocols.every(x=>x.includes("0123456789abcdef")));
  assert.throws(()=>labels("malformed"),/BAD_RUN/);
});
test("processo sem identidade Railway correta falha fechado sem rede",()=>{
  const r=spawnSync(process.execPath,["scripts/qa-staging-sector-e2e.mjs","--execute"],{
    env:{...process.env,RAILWAY_PROJECT_ID:"invalid",DATABASE_URL:base.DATABASE_URL},
    encoding:"utf8",timeout:7000
  });
  assert.equal(r.status,2);
  assert.match(r.stdout,/QA_GUARDA=BLOQUEADO/);
  assert.doesNotMatch(r.stdout,/QA_FIXTURES=CRIADAS/);
});
