import assert from "node:assert/strict";
import { citizenRegistrationGuard } from "../src/server/goLiveSecurity.js";

// Local mock calls only. No HTTP, secrets, external DB, or user writes.
const keys = [
  "NODE_ENV", "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_SERVICE_NAME",
  "RAILWAY_PUBLIC_DOMAIN", "APP_ORIGIN", "SUPABASE_URL",
  "ENABLE_PUBLIC_REGISTRATION", "FISCALIZE_QA_REGISTRATION_ENABLED",
  "FISCALIZE_QA_REGISTRATION_TOKEN"
] as const;
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const origin = "https://fiscalize-homologacao-homologacao.up.railway.app";
const body = {
  nome_completo: "FISCALIZE QA AUTOMATIZADO",
  email: "fiscalize-qa-00000000-0000-0000-0000-000000000000@example.invalid",
  municipio: "Manaus", bairro: "QA AUTOMATIZADO", faixa_etaria: "AGE_25_34",
  aceite_lgpd: true, aceite_codigo: true
};
const token = "X".repeat(48);
function invoke(overrides: Record<string, unknown> = {}, header: string = token) {
  let outcome = 0;
  const req = {
    path: "/api/auth/register/cidadao", method: "POST", body: {...body, ...overrides},
    get: (name: string) => name === "origin" ? origin :
      name === "x-fiscalize-qa-registration-token" ? header : undefined,
  };
  const res = {
    status: (code: number) => { outcome = code; return { json: () => res }; },
    json: () => res
  };
  citizenRegistrationGuard(req as any, res as any, () => { outcome = 200; });
  return outcome;
}
try {
  Object.assign(process.env, {
    NODE_ENV: "production", RAILWAY_ENVIRONMENT_NAME: "homologacao",
    RAILWAY_SERVICE_NAME: "fiscalize-homologacao",
    RAILWAY_PUBLIC_DOMAIN: new URL(origin).host, APP_ORIGIN: origin,
    SUPABASE_URL: "https://zqxouixpokuprqqscnwf.supabase.co",
    ENABLE_PUBLIC_REGISTRATION: "false",
    FISCALIZE_QA_REGISTRATION_ENABLED: "true",
    FISCALIZE_QA_REGISTRATION_TOKEN: token
  });
  assert.equal(invoke(), 200, "Exact synthetic account and token are allowed");
  assert.equal(invoke({}, ""), 503, "Without token registration is closed");
  assert.equal(invoke({}, "Y".repeat(48)), 503, "Wrong token denied");
  assert.equal(invoke({}, "\u00e9".repeat(48)), 503, "Multibyte wrong token denied safely");
  assert.equal(invoke({email:"someone@example.com"}), 503, "Real identity denied");
  assert.equal(invoke({nome_completo:"Real user"}), 503, "Different identity denied");
  assert.equal(invoke({bairro:"Other"}), 503, "Different district denied");
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  assert.equal(invoke(), 503, "Production environment denied");
  process.env.RAILWAY_ENVIRONMENT_NAME = "homologacao";
  process.env.SUPABASE_URL = "https://jnlfmiwczpglojqytrbw.supabase.co";
  assert.equal(invoke(), 503, "Production database project denied");
  process.env.SUPABASE_URL = "https://zqxouixpokuprqqscnwf.supabase.co";
  process.env.FISCALIZE_QA_REGISTRATION_ENABLED = "false";
  assert.equal(invoke(), 503, "QA feature defaults to closed");
  console.log("Synthetic registration guard offline positive and negative checks passed.");
} finally {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
