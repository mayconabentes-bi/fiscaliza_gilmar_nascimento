import http from "node:http";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import postgres from "postgres";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL não configurada.");

const PORT = 3261;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = "account-recovery-runtime-secret-2026-with-32-chars";
const EMAIL = "qa-recovery-runtime@example.org";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OLD_PASSWORD = "Senha-Antiga-QA-2026!";
const NEW_PASSWORD = "Senha-Nova-QA-2026!";

process.env.NODE_ENV = "production";
process.env.PORT = String(PORT);
process.env.APP_ORIGIN = ORIGIN;
process.env.APP_URL = ORIGIN;
process.env.JWT_SECRET = JWT_SECRET;
process.env.DATABASE_URL = databaseUrl;
process.env.DPO_CONTACT_EMAIL = "privacidade-runtime@fiscalize.local";
process.env.LGPD_CONSENT_VERSION = "runtime-recovery-v1";
process.env.ENABLE_PUBLIC_REGISTRATION = "true";
process.env.ENABLE_PUBLIC_DEMAND_INTAKE = "true";
process.env.ENABLE_PASSWORD_RECOVERY = "true";
process.env.ACCOUNT_SUPPORT_EMAIL = "suporte-runtime@fiscalize.local";
process.env.RESEND_API_KEY = "re_test_runtime";
process.env.PASSWORD_RESET_FROM_EMAIL = "FISCALIZE <acesso@fiscalize.local>";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_runtime_placeholder";
process.env.SUPABASE_EVIDENCE_BUCKET = "evidencias-demandas";
process.env.INTERNAL_PILOT_MODE = "false";
process.env.INTELLIGENCE_AUTO_REFRESH = "false";

const sql = postgres(databaseUrl, { max: 2, prepare: false, ssl: false });

let resendCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://api.resend.com/emails") {
    resendCalls += 1;
    return new Response(JSON.stringify({ message: "provider unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

function passwordFingerprint(hash: string) {
  return crypto.createHash("sha256").update(hash).digest("base64url");
}

function request(pathname: string, options: {
  method?: string;
  body?: unknown;
  cookie?: string;
} = {}) {
  return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = http.request({
      hostname: "127.0.0.1",
      port: PORT,
      path: pathname,
      method: options.method || "GET",
      headers: {
        Origin: ORIGIN,
        ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        let parsed: any = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode || 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const { createApp } = await import("../src/server/app.ts");
const app = createApp();
const server = app.listen(PORT, "127.0.0.1");

try {
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const oldHash = await bcrypt.hash(OLD_PASSWORD, 12);
  await sql`delete from public.usuarios where id = ${USER_ID} or lower(email) = lower(${EMAIL})`;
  await sql`
    insert into public.usuarios (
      id, nome_completo, email, municipio, bairro, password_hash, status,
      consentimento_lgpd, data_consentimento, versao_consentimento,
      faixa_etaria, protecao_reforcada
    ) values (
      ${USER_ID}, 'QA Recovery Runtime', ${EMAIL}, 'Manaus', 'Centro', ${oldHash}, 'ativo',
      true, now(), 'runtime-recovery-v1', 'AGE_18_PLUS', false
    )
  `;

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: OLD_PASSWORD, type: "cidadao" },
  });
  assert(login.status === 200, `Login inicial falhou: ${login.status}`);
  const sessionCookie = String(login.headers["set-cookie"]?.[0] || "").split(";")[0];
  assert(sessionCookie.startsWith("token="), "Login não retornou cookie de sessão.");

  const missing = await request("/api/auth/recovery/request", {
    method: "POST",
    body: { email: "nao-existe-runtime@example.org" },
  });
  const existing = await request("/api/auth/recovery/request", {
    method: "POST",
    body: { email: EMAIL },
  });
  assert(missing.status === 202 && existing.status === 202, "Recovery request deve responder 202 de forma genérica.");
  assert(JSON.stringify(missing.body) === JSON.stringify(existing.body), "Resposta permite enumeração de conta.");
  assert(resendCalls === 1, "Falha simulada do provedor de e-mail não foi exercitada.");

  const [stored] = await sql`select password_hash from public.usuarios where id = ${USER_ID}`;
  const currentHash = String(stored.password_hash);
  const validToken = jwt.sign(
    { type: "password_reset", pwd: passwordFingerprint(currentHash) },
    JWT_SECRET,
    { subject: USER_ID, expiresIn: "20m", audience: "fiscalize-password-reset", issuer: "fiscalize" },
  );

  const tampered = validToken.slice(0, -2) + "xx";
  const tamperedResponse = await request("/api/auth/recovery/reset", {
    method: "POST",
    body: { token: tampered, password: NEW_PASSWORD },
  });
  assert(tamperedResponse.status === 400, "Token adulterado deveria ser rejeitado.");

  const expiredToken = jwt.sign(
    { type: "password_reset", pwd: passwordFingerprint(currentHash) },
    JWT_SECRET,
    { subject: USER_ID, expiresIn: -1, audience: "fiscalize-password-reset", issuer: "fiscalize" },
  );
  const expiredResponse = await request("/api/auth/recovery/reset", {
    method: "POST",
    body: { token: expiredToken, password: NEW_PASSWORD },
  });
  assert(expiredResponse.status === 400, "Token expirado deveria ser rejeitado.");

  const reset = await request("/api/auth/recovery/reset", {
    method: "POST",
    body: { token: validToken, password: NEW_PASSWORD },
    cookie: sessionCookie,
  });
  assert(reset.status === 200, `Reset válido falhou: ${reset.status}`);
  assert(String(reset.headers["set-cookie"]?.[0] || "").includes("token="), "Reset não limpou cookie de sessão.");

  const [afterReset] = await sql`select password_hash from public.usuarios where id = ${USER_ID}`;
  assert(await bcrypt.compare(NEW_PASSWORD, String(afterReset.password_hash)), "Nova senha não foi persistida.");
  assert(!(await bcrypt.compare(OLD_PASSWORD, String(afterReset.password_hash))), "Senha antiga permaneceu válida.");

  const reused = await request("/api/auth/recovery/reset", {
    method: "POST",
    body: { token: validToken, password: "Outra-Senha-QA-2026!" },
  });
  assert(reused.status === 400, "Token de recuperação reutilizado deveria ser invalidado.");

  const oldSession = await request("/api/auth/session", { cookie: sessionCookie });
  assert(oldSession.status === 401, "Sessão anterior à troca de senha deveria ser invalidada.");

  const oldLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: OLD_PASSWORD, type: "cidadao" },
  });
  assert(oldLogin.status === 401, "Senha antiga ainda autentica após reset.");

  const newLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: NEW_PASSWORD, type: "cidadao" },
  });
  assert(newLogin.status === 200, "Nova senha não autentica após reset.");

  for (let i = 0; i < 4; i += 1) {
    const response = await request("/api/auth/recovery/request", {
      method: "POST",
      body: { email: `invalido-${i}@example.org` },
    });
    assert(response.status === 202, `Rate limit antecipado na tentativa ${i + 3}.`);
  }
  const limited = await request("/api/auth/recovery/request", {
    method: "POST",
    body: { email: "limite@example.org" },
  });
  assert(limited.status === 429, `Rate limit não bloqueou a 7ª solicitação: ${limited.status}`);

  console.log("Account recovery runtime OK: anti-enumeração, outage, token inválido/expirado, reset único, sessão e rate limit.");
} finally {
  await sql`delete from public.usuarios where id = ${USER_ID} or lower(email) = lower(${EMAIL})`;
  await sql.end({ timeout: 2 });
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
