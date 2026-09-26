import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getHealthyPostgres } from "./postgres.js";
import { fieldRegistrationEnabled, fieldTicketHash, validUnusedFieldTicket, insertCitizenWithFieldTicket } from "./fieldRegistration.js";
import { cleanEmail, cleanText } from "./requestValidation.js";
import { AgePolicyError, ageBandForActiveParticipation, type AgeBand } from "./agePolicy.js";
import { citizenPasswordFingerprint } from "./citizenSessionSecurity.js";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function consentVersion() {
  return process.env.LGPD_CONSENT_VERSION || "2026-09-v1";
}

function validationError(res: any, message = "Revise os dados informados.") {
  return res.status(400).json({ error: message });
}

const RECOVERY_AUDIENCE = "fiscalize-password-reset";
const RECOVERY_ISSUER = "fiscalize";

function passwordFingerprint(passwordHash: string) {
  return citizenPasswordFingerprint(passwordHash);
}

function passwordRecoveryEnabled() {
  return process.env.ENABLE_PASSWORD_RECOVERY === "true";
}

function recoverySupportEmail() {
  return (process.env.ACCOUNT_SUPPORT_EMAIL || process.env.DPO_CONTACT_EMAIL || "").trim();
}

function recoveryEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("PASSWORD_RECOVERY_EMAIL_NOT_CONFIGURED");
  return { apiKey, from };
}

function recoveryOrigin() {
  const origin = (process.env.APP_ORIGIN || "http://localhost:3000").split(",")[0]?.trim().replace(/\/+$/, "");
  if (!origin) throw new Error("APP_ORIGIN não configurado");
  return origin;
}

async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { apiKey, from } = recoveryEmailConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Recuperação de acesso — FISCALIZE",
      text: [
        "Recebemos um pedido para redefinir a senha da sua conta no FISCALIZE.",
        "",
        "Use o link abaixo em até 20 minutos:",
        resetUrl,
        "",
        "Se você não solicitou essa alteração, ignore esta mensagem."
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    console.error("Falha ao enviar e-mail de recuperação:", response.status);
    throw new Error("PASSWORD_RECOVERY_EMAIL_SEND_FAILED");
  }
}

async function waitForGenericRecoveryTiming(startedAt: number) {
  const remaining = 750 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export function setupCitizenAuthPostgres(app: Express) {
  app.get("/api/auth/recovery/config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ enabled: passwordRecoveryEnabled(), supportEmail: recoverySupportEmail() || null });
  });

  app.post("/api/auth/recovery/request", async (req, res) => {
    const startedAt = Date.now();
    const genericMessage = "Se houver uma conta com esse e-mail, enviaremos instruções para redefinir a senha.";

    if (process.env.NODE_ENV === "production" && !passwordRecoveryEnabled()) {
      return res.status(503).json({ error: "Recuperação de acesso ainda não habilitada." });
    }
    try { recoveryEmailConfig(); }
    catch { return res.status(503).json({ error: "Recuperação de acesso temporariamente indisponível." }); }

    let normalizedEmail = "";
    try { normalizedEmail = cleanEmail(req.body?.email); }
    catch {
      await waitForGenericRecoveryTiming(startedAt);
      return res.status(202).json({ message: genericMessage });
    }

    try {
      const sql = await getHealthyPostgres();
      const [user] = await sql`
        select id, email, status, password_hash
        from public.usuarios
        where lower(email) = lower(${normalizedEmail})
        limit 1
      `;

      if (user && user.status !== "excluido" && user.status !== "suspenso") {
        const token = jwt.sign(
          { type: "password_reset", pwd: passwordFingerprint(String(user.password_hash)) },
          jwtSecret(),
          {
            subject: String(user.id),
            expiresIn: "20m",
            audience: RECOVERY_AUDIENCE,
            issuer: RECOVERY_ISSUER,
          },
        );
        const resetUrl = `${recoveryOrigin()}/recuperar-acesso#token=${encodeURIComponent(token)}`;
        try { await sendPasswordResetEmail(String(user.email), resetUrl); }
        catch (error) {
          console.error("Falha operacional na recuperação de senha:", error instanceof Error ? error.message : "erro desconhecido");
        }
      }

      await waitForGenericRecoveryTiming(startedAt);
      res.setHeader("Cache-Control", "no-store");
      return res.status(202).json({ message: genericMessage });
    } catch (error: any) {
      console.error("Falha ao processar recuperação de senha:", error);
      const configError = error?.message === "DATABASE_URL não configurada" || error?.message === "JWT_SECRET não configurado";
      return res.status(configError ? 503 : 500).json({
        error: configError ? "Serviço de recuperação sem configuração completa." : "Não foi possível processar a solicitação agora.",
      });
    }
  });

  app.post("/api/auth/recovery/reset", async (req, res) => {
    if (process.env.NODE_ENV === "production" && !passwordRecoveryEnabled()) {
      return res.status(503).json({ error: "Recuperação de acesso ainda não habilitada." });
    }

    let token: string;
    let newPassword: string;
    try {
      token = cleanText(req.body?.token, 4096, true);
      newPassword = cleanText(req.body?.password, 128, true);
      if (newPassword.length < 8) return validationError(res, "A nova senha deve ter pelo menos 8 caracteres.");
    } catch {
      return validationError(res, "Link de recuperação ou nova senha inválidos.");
    }

    let claims: any;
    try {
      claims = jwt.verify(token, jwtSecret(), { audience: RECOVERY_AUDIENCE, issuer: RECOVERY_ISSUER }) as any;
    } catch {
      return res.status(400).json({ error: "Este link de recuperação é inválido ou expirou." });
    }
    if (claims?.type !== "password_reset" || !claims?.sub || !claims?.pwd) {
      return res.status(400).json({ error: "Este link de recuperação é inválido ou expirou." });
    }

    try {
      const sql = await getHealthyPostgres();
      const [user] = await sql`
        select id, status, password_hash
        from public.usuarios
        where id = ${String(claims.sub)}
        limit 1
      `;
      if (!user || user.status === "excluido" || user.status === "suspenso") {
        return res.status(400).json({ error: "Este link de recuperação é inválido ou expirou." });
      }

      const currentHash = String(user.password_hash);
      if (claims.pwd !== passwordFingerprint(currentHash)) {
        return res.status(400).json({ error: "Este link de recuperação já foi utilizado ou não é mais válido." });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      const updated = await sql`
        update public.usuarios
        set password_hash = ${newHash}
        where id = ${String(user.id)} and password_hash = ${currentHash}
        returning id
      `;
      if (!updated.length) {
        return res.status(400).json({ error: "Este link de recuperação já foi utilizado ou não é mais válido." });
      }

      res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ message: "Senha alterada com sucesso. Entre novamente com a nova senha." });
    } catch (error: any) {
      console.error("Falha ao redefinir senha:", error);
      const configError = error?.message === "DATABASE_URL não configurada" || error?.message === "JWT_SECRET não configurado";
      return res.status(configError ? 503 : 500).json({
        error: configError ? "Serviço de recuperação sem configuração completa." : "Não foi possível redefinir a senha agora.",
      });
    }
  });

  app.post(["/api/auth/register/cidadao", "/api/field/register/cidadao"], async (req, res) => {
    const fieldMode = req.path === "/api/field/register/cidadao";
    if (fieldMode && !fieldRegistrationEnabled()) {
      return res.status(404).json({ error: "Indisponível." });
    }
    // The public flow keeps its existing consent guard. The separate field
    // route requires the exact same recorded, versioned consent.
    if (fieldMode && (req.body?.aceite_lgpd !== true || req.body?.aceite_codigo !== true)) {
      return res.status(400).json({ error: "Aceite das regras e da Política de Privacidade obrigatório." });
    }
    let nomeCompleto: string;
    let normalizedEmail: string;
    let municipio: string;
    let bairro: string;
    let password: string;
    let faixaEtaria: AgeBand;
    let protecaoReforcada = false;

    try {
      nomeCompleto = cleanText(req.body?.nome_completo, 160, true);
      normalizedEmail = cleanEmail(req.body?.email);
      municipio = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160, true);
      password = cleanText(req.body?.password, 128, true);
      if (password.length < 8) return validationError(res, "A senha deve ter pelo menos 8 caracteres.");
      const agePolicy = ageBandForActiveParticipation(req.body?.faixa_etaria);
      faixaEtaria = agePolicy.ageBand;
      protecaoReforcada = agePolicy.enhancedProtection;
    } catch (error: any) {
      if (error instanceof AgePolicyError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return validationError(res);
    }

    try {
      // Refuse unknown/replayed tickets before doing expensive password hashing.
      // The check is only preflight; a row lock and atomic consumption below
      // make the final insertion safe against a concurrent replay.
      const hash = fieldMode ? fieldTicketHash(req.get("x-fiscalize-field-ticket")) : null;
      if (fieldMode && (!hash || !(await validUnusedFieldTicket(hash)))) {
        return res.status(403).json({ error: "Convite de cadastro inválido ou expirado." });
      }
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      const consentimento = req.body?.aceite_lgpd === true;
      const acceptedAt = consentimento ? new Date().toISOString() : null;
      const version = consentimento ? consentVersion() : null;
      if (fieldMode) {
        const inserted = await insertCitizenWithFieldTicket(hash!, {
          id, nomeCompleto, email: normalizedEmail, municipio, bairro, passwordHash,
          consentimento, acceptedAt, version, faixaEtaria, protecaoReforcada,
        });
        if (!inserted) return res.status(409).json({ error: "Convite já utilizado ou expirado." });
      } else {
        const sql = await getHealthyPostgres();
        await sql`
          insert into public.usuarios (
            id, nome_completo, email, municipio, bairro, password_hash,
            consentimento_lgpd, data_consentimento, versao_consentimento,
            faixa_etaria, protecao_reforcada
          ) values (
            ${id}, ${nomeCompleto}, ${normalizedEmail}, ${municipio}, ${bairro}, ${passwordHash},
            ${consentimento}, ${acceptedAt}, ${version}, ${faixaEtaria}, ${protecaoReforcada}
          )
        `;
      }
      return res.status(201).json({ id, message: "Cadastro realizado." });
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ error: "E-mail já cadastrado." });
      console.error("Falha no cadastro cidadão:", error);
      const configError = error?.message === "DATABASE_URL não configurada";
      return res.status(configError ? 503 : 500).json({ error: configError ? "Banco de dados ainda não configurado." : "Não foi possível concluir o cadastro." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (req.body?.type !== "cidadao") return res.status(403).json({ error: "Tipo de acesso não permitido." });
    let normalizedEmail: string;
    let password: string;
    try {
      normalizedEmail = cleanEmail(req.body?.email);
      password = cleanText(req.body?.password, 128, true);
    } catch {
      return validationError(res, "E-mail e senha são obrigatórios.");
    }

    try {
      const sql = await getHealthyPostgres();
      const [user] = await sql`
        select id, nome_completo, email, municipio, bairro, status, password_hash, faixa_etaria, protecao_reforcada
        from public.usuarios where lower(email) = lower(${normalizedEmail}) limit 1
      `;
      if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ error: "Credenciais inválidas." });
      const passwordValid = await bcrypt.compare(password, String(user.password_hash));
      if (!passwordValid) return res.status(401).json({ error: "Credenciais inválidas." });
      const token = jwt.sign({ id: user.id, type: "cidadao", status: user.status || "ativo", pwd: passwordFingerprint(String(user.password_hash)) }, jwtSecret(), { expiresIn: "24h" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 24 * 60 * 60 * 1000 });
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ user: { id: user.id, nome_completo: user.nome_completo, email: user.email, municipio: user.municipio, bairro: user.bairro, faixa_etaria: user.faixa_etaria, protecao_reforcada: Boolean(user.protecao_reforcada), type: "cidadao" } });
    } catch (error: any) {
      const configError = error?.message === "DATABASE_URL não configurada" || error?.message === "JWT_SECRET não configurado";
      console.error("Falha ao autenticar cidadão:", error);
      return res.status(configError ? 503 : 500).json({ error: configError ? "Servidor sem configuração de autenticação." : "Falha ao autenticar." });
    }
  });

  app.get("/api/auth/session", async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return next();
    let claims: any;
    try { claims = jwt.verify(token, jwtSecret()) as any; } catch { return next(); }
    if (claims.type !== "cidadao") return next();
    try {
      const sql = await getHealthyPostgres();
      const [user] = await sql`
        select id, nome_completo, email, municipio, bairro, status, faixa_etaria, protecao_reforcada, password_hash
        from public.usuarios where id = ${claims.id} limit 1
      `;
      if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ authenticated: false });
      if (!claims.pwd || claims.pwd !== passwordFingerprint(String(user.password_hash))) {
        res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(401).json({ authenticated: false });
      }
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ authenticated: true, user: { id: user.id, nome_completo: user.nome_completo, email: user.email, municipio: user.municipio, bairro: user.bairro, faixa_etaria: user.faixa_etaria, protecao_reforcada: Boolean(user.protecao_reforcada), type: "cidadao" } });
    } catch (error: any) {
      console.error("Falha ao validar sessão cidadã:", error);
      const configError = error?.message === "DATABASE_URL não configurada";
      return res.status(configError ? 503 : 500).json({ error: configError ? "Banco de dados ainda não configurado." : "Falha ao validar sessão." });
    }
  });
}
