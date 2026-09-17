import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";
import { cleanEmail, cleanText } from "./requestValidation.js";
import { AgePolicyError, ageBandForActiveParticipation } from "./agePolicy.js";

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

export function setupCitizenAuthPostgres(app: Express) {
  app.post("/api/auth/register/cidadao", async (req, res) => {
    let nomeCompleto: string;
    let normalizedEmail: string;
    let municipio: string;
    let bairro: string;
    let password: string;
    let faixaEtaria: "AGE_16_17" | "AGE_18_PLUS";
    let protecaoReforcada = false;

    try {
      nomeCompleto = cleanText(req.body?.nome_completo, 160, true);
      normalizedEmail = cleanEmail(req.body?.email);
      municipio = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160, true);
      password = cleanText(req.body?.password, 128, true);
      if (password.length < 8) return validationError(res, "A senha deve ter pelo menos 8 caracteres.");
      const agePolicy = ageBandForActiveParticipation(req.body?.faixa_etaria);
      faixaEtaria = agePolicy.ageBand as "AGE_16_17" | "AGE_18_PLUS";
      protecaoReforcada = agePolicy.enhancedProtection;
    } catch (error: any) {
      if (error instanceof AgePolicyError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return validationError(res);
    }

    try {
      const sql = getPostgres();
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      const consentimento = req.body?.aceite_lgpd === true;
      const acceptedAt = consentimento ? new Date().toISOString() : null;
      const version = consentimento ? consentVersion() : null;
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
      const sql = getPostgres();
      const [user] = await sql`
        select id, nome_completo, email, municipio, bairro, status, password_hash, faixa_etaria, protecao_reforcada
        from public.usuarios where lower(email) = lower(${normalizedEmail}) limit 1
      `;
      if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ error: "Credenciais inválidas." });
      const passwordValid = await bcrypt.compare(password, String(user.password_hash));
      if (!passwordValid) return res.status(401).json({ error: "Credenciais inválidas." });
      const token = jwt.sign({ id: user.id, type: "cidadao", status: user.status || "ativo" }, jwtSecret(), { expiresIn: "24h" });
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
      const sql = getPostgres();
      const [user] = await sql`
        select id, nome_completo, email, municipio, bairro, status, faixa_etaria, protecao_reforcada
        from public.usuarios where id = ${claims.id} limit 1
      `;
      if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ authenticated: false });
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ authenticated: true, user: { id: user.id, nome_completo: user.nome_completo, email: user.email, municipio: user.municipio, bairro: user.bairro, faixa_etaria: user.faixa_etaria, protecao_reforcada: Boolean(user.protecao_reforcada), type: "cidadao" } });
    } catch (error: any) {
      console.error("Falha ao validar sessão cidadã:", error);
      const configError = error?.message === "DATABASE_URL não configurada";
      return res.status(configError ? 503 : 500).json({ error: configError ? "Banco de dados ainda não configurado." : "Falha ao validar sessão." });
    }
  });
}
