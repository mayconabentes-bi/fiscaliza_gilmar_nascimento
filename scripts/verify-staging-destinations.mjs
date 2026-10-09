#!/usr/bin/env node
/**
 * Pré-verificação local, apenas parsing de variáveis. Sem rede, SQL ou escrita.
 * Execute COM as variáveis do serviço de homologação, nunca as de produção.
 *
 * "OK_PARCIAL" não valida posse de bucket/Storage, nem autoriza deploy.
 * Não registra hosts, usuário, URL, credenciais, dados pessoais ou segredos.
 */
const EXPECTED = Object.freeze({
  projectId: "acd59c0a-4723-4162-9bfc-33bab1f096b0",
  environmentId: "32940765-7ef3-41c1-a017-48ad13120d65",
  serviceId: "98959349-60d9-4363-b7c3-e20e04e93a71",
  supabaseProject: "zqxouixpokuprqqscnwf",
});

function classifyIdentity(found) {
  if (found === "CONFLITO") return "DIVERGENTE";
  if (!found) return "INCONCLUSIVO";
  return found === EXPECTED.supabaseProject ? "OK" : "DIVERGENTE";
}

function dbProject(raw) {
  if (!raw) return null;
  let uri;
  try { uri = new URL(raw); } catch { return null; }
  if (uri.protocol !== "postgres:" && uri.protocol !== "postgresql:") return null;
  const hostname = uri.hostname.toLowerCase();
  let username;
  try { username = decodeURIComponent(uri.username).toLowerCase(); }
  catch { return null; }
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
  const tenant = /^postgres\.([a-z0-9]{20})$/.exec(username);
  if (direct) {
    // Negar identidade contraditória, mesmo quando o hostname é oficial.
    if (tenant && tenant[1] !== direct[1]) return "CONFLITO";
    return direct[1];
  }
  // Um usuário "postgres.<ref>" em HOST DESCONHECIDO NÃO comprova isolamento.
  if (!/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(hostname)) return null;
  return tenant ? tenant[1] : null;
}

function apiProject(raw) {
  if (!raw) return null;
  let uri;
  try { uri = new URL(raw); } catch { return null; }
  if (uri.protocol !== "https:" || uri.username || uri.password ||
      uri.port || uri.search || uri.hash || !["", "/"].includes(uri.pathname)) return null;
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(uri.hostname.toLowerCase());
  return match ? match[1] : null;
}

function sameEnvironment(value, expected) {
  if (!value) return "INCONCLUSIVO";
  return value === expected ? "OK" : "DIVERGENTE";
}

const db = dbProject(process.env.DATABASE_URL);
const api = apiProject(process.env.SUPABASE_URL);
const report = {
  RAILWAY_PROJETO: sameEnvironment(process.env.RAILWAY_PROJECT_ID, EXPECTED.projectId),
  RAILWAY_AMBIENTE: sameEnvironment((process.env.RAILWAY_ENVIRONMENT_NAME || "").toLowerCase(), "homologacao"),
  RAILWAY_AMBIENTE_ID: sameEnvironment(process.env.RAILWAY_ENVIRONMENT_ID, EXPECTED.environmentId),
  RAILWAY_SERVICO_ID: sameEnvironment(process.env.RAILWAY_SERVICE_ID, EXPECTED.serviceId),
  SUPABASE_API_PROJETO: classifyIdentity(api),
  POSTGRES_PROJETO: classifyIdentity(db),
  BANCO_API_CONSISTENTES: (db && api && db !== "CONFLITO")
    ? (db === api && db === EXPECTED.supabaseProject ? "OK" : "DIVERGENTE")
    : (db === "CONFLITO" ? "DIVERGENTE" : "INCONCLUSIVO"),
  STORAGE_BUCKET_CONFIGURADO: process.env.SUPABASE_EVIDENCE_BUCKET?.trim() ? "OK" : "INCONCLUSIVO",
  STORAGE_CHAVE_CONFIGURADA: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "OK" : "INCONCLUSIVO",
};

for (const [name, result] of Object.entries(report)) {
  console.log(name + "=" + result);
}
const configOk = Object.values(report).every(v => v === "OK");
console.log("PREFLIGHT_CONFIG=" + (configOk ? "OK_PARCIAL" : "BLOQUEADO"));
console.log("IDENTIDADE_REAL_STORAGE=NAO_COMPROVADA");
console.log("LIBERACAO_IMPLANTACAO=NAO_AUTORIZADA");
process.exitCode = configOk ? 0 : 2;
