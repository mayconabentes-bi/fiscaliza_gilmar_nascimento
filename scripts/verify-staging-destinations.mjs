#!/usr/bin/env node
/**
 * Preflight sem rede/SQL/side effects; executar SOMENTE no contexto de homologacao.
 * Imprime estados, nunca valores/hosts/portas/credenciais. Falha fechada.
 * Um "OK" verifica consistencia textual, NAO comprova acesso real nem bucket ownership.
 */
const expected = "zqxouixpokuprqqscnwf";
const production = "jnlfmiwczpglojqytrbw";
const result = {};
function check(name, fn) {
  try { result[name] = fn(); }
  catch { result[name] = "INCONCLUSIVO"; }
}
function verdict(ok, bad = false) { return bad ? "DIVERGENTE" : ok ? "OK" : "INCONCLUSIVO"; }
function projectFromDbConnection(value) {
  if (!value) return null;
  let u;
  try { u = new URL(value); }
  catch { return null; }
  if (!["postgres:", "postgresql:"].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const user = decodeURIComponent(u.username).toLowerCase();
  let m = host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (m) return m[1];
  m = user.match(/^postgres\.([a-z0-9]{20})$/);
  if (m) return m[1];
  // Pooler compartilhado sem tenant no username: nao inferir projeto.
  return null;
}
function projectFromApi(value) {
  if (!value) return null;
  let u;
  try { u = new URL(value); }
  catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return null;
  const m = u.hostname.toLowerCase().match(/^([a-z0-9]{20})\.supabase\.co$/);
  return m ? m[1] : null;
}
check("RAILWAY_AMBIENTE", () => {
  const env = (process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase();
  return verdict(env === "homologacao", env === "production");
});
check("SUPABASE_URL_PROJETO", () => {
  const id = projectFromApi(process.env.SUPABASE_URL);
  return verdict(id === expected, id === production || (!!id && id !== expected));
});
check("DATABASE_URL_PROJETO", () => {
  const id = projectFromDbConnection(process.env.DATABASE_URL);
  return verdict(id === expected, id === production || (!!id && id !== expected));
});
check("BUCKET_CONFIGURADO", () => verdict(Boolean((process.env.SUPABASE_EVIDENCE_BUCKET || "").trim())));
check("SERVICE_KEY_CONFIGURADA", () => verdict(Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim())));
check("CONSISTENCIA_BANCO_API", () => {
  const db = projectFromDbConnection(process.env.DATABASE_URL);
  const api = projectFromApi(process.env.SUPABASE_URL);
  return verdict(Boolean(db && api && db === api && api === expected),Boolean(db && api && db !== api));
});
for(const [key, value] of Object.entries(result)) console.log(key + "=" + value);
const passed = ["RAILWAY_AMBIENTE","SUPABASE_URL_PROJETO","DATABASE_URL_PROJETO","CONSISTENCIA_BANCO_API"].every(k=>result[k]==="OK");
console.log("PRECHECK=" + (passed?"OK":"BLOQUEADO"));
console.log("STORAGE_DESTINO_REAL=NAO_COMPROVADO");
process.exitCode = passed ? 0 : 2;
