import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db.js";
import { cleanDate, cleanEmail, cleanEnum, cleanProtocol, cleanText } from "./requestValidation.js";
import { isValidDemandClassification } from "../shared/demandTaxonomy.js";

const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function demandProtocol() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `AM-${date}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function consentVersion() {
  return process.env.LGPD_CONSENT_VERSION || "2026-09-v1";
}

function publicDemandIntakeEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true";
}

function validationError(res: any, message = "Revise os dados informados.") {
  return res.status(400).json({ error: message });
}

function citizenClaims(req: any) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, jwtSecret()) as any;
    return claims?.type === "cidadao" && claims?.id ? claims : null;
  } catch {
    return null;
  }
}

export function setupRoutes(app: Express) {
  app.post("/api/auth/register/cidadao", async (req, res) => {
    let nomeCompleto: string;
    let normalizedEmail: string;
    let municipio: string;
    let bairro: string;
    let password: string;
    try {
      nomeCompleto = cleanText(req.body?.nome_completo, 160, true);
      normalizedEmail = cleanEmail(req.body?.email);
      municipio = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160, true);
      password = cleanText(req.body?.password, 128, true);
      if (password.length < 8) return validationError(res, "A senha deve ter pelo menos 8 caracteres.");
    } catch {
      return validationError(res);
    }

    const db = getDb();
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const id = uuidv4();
      const acceptedAt = req.body?.aceite_lgpd === true ? new Date().toISOString() : null;
      const version = req.body?.aceite_lgpd === true ? consentVersion() : null;
      const columns = db.prepare("PRAGMA table_info(usuarios)").all() as Array<{ name: string; notnull: number }>;
      const legacyCpf = columns.find((column) => column.name === "cpf_hash" && column.notnull === 1);

      if (legacyCpf) {
        db.prepare(`INSERT INTO usuarios (id, nome_completo, cpf_hash, email, municipio, bairro, password_hash, consentimento_lgpd, data_consentimento, versao_consentimento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, nomeCompleto, crypto.randomBytes(32).toString("hex"), normalizedEmail, municipio, bairro, passwordHash, req.body?.aceite_lgpd === true ? 1 : 0, acceptedAt, version);
      } else {
        db.prepare(`INSERT INTO usuarios (id, nome_completo, email, municipio, bairro, password_hash, consentimento_lgpd, data_consentimento, versao_consentimento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, nomeCompleto, normalizedEmail, municipio, bairro, passwordHash, req.body?.aceite_lgpd === true ? 1 : 0, acceptedAt, version);
      }
      res.status(201).json({ id, message: "Cadastro realizado." });
    } catch (error: any) {
      if (String(error?.code || "").includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "E-mail já cadastrado." });
      console.error("Falha no cadastro cidadão:", error);
      res.status(500).json({ error: "Não foi possível concluir o cadastro." });
    } finally { db.close(); }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (req.body?.type !== "cidadao") return res.status(403).json({ error: "Tipo de acesso não permitido." });
    let normalizedEmail: string;
    let password: string;
    try {
      normalizedEmail = cleanEmail(req.body?.email);
      password = cleanText(req.body?.password, 128, true);
    } catch { return validationError(res, "E-mail e senha são obrigatórios."); }

    const db = getDb();
    try {
      const user = db.prepare(`SELECT * FROM usuarios WHERE lower(email) = lower(?)`).get(normalizedEmail) as any | undefined;
      if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ error: "Credenciais inválidas." });
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: "Credenciais inválidas." });
      const token = jwt.sign({ id: user.id, type: "cidadao", status: user.status || "ativo" }, jwtSecret(), { expiresIn: "24h" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 24 * 60 * 60 * 1000 });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ user: { id: user.id, nome_completo: user.nome_completo, email: user.email, municipio: user.municipio, bairro: user.bairro, type: "cidadao" } });
    } catch (error: any) {
      const configError = error?.message === "JWT_SECRET não configurado";
      res.status(configError ? 503 : 500).json({ error: configError ? "Servidor sem configuração de autenticação." : "Falha ao autenticar." });
    } finally { db.close(); }
  });

  app.get("/api/auth/session", (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ authenticated: false });
    let claims: any;
    try { claims = jwt.verify(token, jwtSecret()) as any; }
    catch { return res.status(401).json({ authenticated: false }); }

    const db = getDb();
    try {
      res.setHeader("Cache-Control", "no-store, private");
      if (claims.type === "admin") {
        const admin = db.prepare("SELECT id, nome, email, ativo FROM admins WHERE id = ?").get(claims.id) as any | undefined;
        if (!admin || admin.ativo !== 1) return res.status(401).json({ authenticated: false });
        return res.json({ authenticated: true, user: { id: admin.id, nome: admin.nome, email: admin.email, type: "admin", perfil_acesso: "ADMIN" } });
      }
      if (claims.type === "cidadao") {
        const user = db.prepare("SELECT id, nome_completo, email, municipio, bairro, status FROM usuarios WHERE id = ?").get(claims.id) as any | undefined;
        if (!user || user.status === "excluido" || user.status === "suspenso") return res.status(401).json({ authenticated: false });
        return res.json({ authenticated: true, user: { id: user.id, nome_completo: user.nome_completo, email: user.email, municipio: user.municipio, bairro: user.bairro, type: "cidadao" } });
      }
      return res.status(401).json({ authenticated: false });
    } finally { db.close(); }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.json({ success: true });
  });

  app.post("/api/compliance/exportar", (req, res) => {
    const claims = citizenClaims(req);
    if (!claims) return res.status(401).json({ error: "Entre na sua conta para exportar os dados." });
    const db = getDb();
    try {
      const user = db.prepare(`SELECT id, nome_completo, email, municipio, bairro, status, consentimento_lgpd, data_consentimento, versao_consentimento, created_at FROM usuarios WHERE id = ?`).get(claims.id) as any;
      if (!user || user.status === "excluido") return res.status(404).json({ error: "Conta não encontrada." });
      const demandas = db.prepare(`SELECT protocolo, municipio, bairro, categoria, descricao, prioridade, status, aviso_privacidade_versao, aviso_privacidade_aceito_em, created_at, updated_at FROM demandas WHERE usuario_id = ? ORDER BY created_at DESC`).all(claims.id);
      const publicacoes = db.prepare(`SELECT tipo_participacao, area_tematica, municipio, conteudo, status_moderacao, created_at FROM publicacoes WHERE usuario_id = ? ORDER BY created_at DESC`).all(claims.id);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ dados: { conta: user, demandas, publicacoes, exportado_em: new Date().toISOString() } });
    } finally { db.close(); }
  });

  app.post("/api/compliance/excluir", (req, res) => {
    const claims = citizenClaims(req);
    if (!claims) return res.status(401).json({ error: "Entre na sua conta para solicitar a exclusão." });
    const db = getDb();
    try {
      const user = db.prepare(`SELECT id, status FROM usuarios WHERE id = ?`).get(claims.id) as any;
      if (!user || user.status === "excluido") return res.status(404).json({ error: "Conta não encontrada." });
      const syntheticEmail = `excluido-${claims.id}@invalid.local`;
      db.transaction(() => {
        db.prepare(`UPDATE demandas SET usuario_id = NULL WHERE usuario_id = ?`).run(claims.id);
        db.prepare(`UPDATE usuarios SET nome_completo = 'Conta excluída', email = ?, municipio = 'Removido', bairro = 'Removido', status = 'excluido', consentimento_lgpd = 0, password_hash = ? WHERE id = ?`)
          .run(syntheticEmail, crypto.randomBytes(48).toString("hex"), claims.id);
        db.prepare(`INSERT INTO logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata) VALUES (?, 'usuario', ?, 'SOLICITACAO_EXCLUSAO', ?, ?)`)
          .run(uuidv4(), claims.id, claims.id, JSON.stringify({ data: new Date().toISOString(), efeito: "conta pseudonimizada e demandas desvinculadas" }));
      })();
      res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
      res.json({ success: true, message: "Conta desativada e dados cadastrais pseudonimizados. Registros cívicos que precisem ser mantidos por integridade, segurança ou obrigação aplicável podem permanecer sem vínculo direto com a conta." });
    } finally { db.close(); }
  });

  app.post("/api/demandas", (req, res) => {
    if (!publicDemandIntakeEnabled()) return res.status(503).json({ error: "Recebimento público de demandas ainda não habilitado neste ambiente." });
    let nome: string, contato: string, municipio: string, bairro: string, categoria: string, tipoProblema: string, descricao: string, prioridade: string;
    try {
      nome = cleanText(req.body?.nome_solicitante, 160, true);
      contato = cleanText(req.body?.contato, 200);
      municipio = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160);
      categoria = cleanText(req.body?.categoria, 120, true).toUpperCase();
      tipoProblema = cleanText(req.body?.tipo_problema, 120, true).toUpperCase();
      if (!isValidDemandClassification(categoria, tipoProblema)) throw new Error("invalid_demand_classification");
      descricao = cleanText(req.body?.descricao, 5000, true);
      prioridade = cleanEnum(req.body?.prioridade, PRIORITIES, "MEDIA");
    } catch { return validationError(res); }

    const claims = citizenClaims(req);
    const db = getDb();
    try {
      const id = uuidv4();
      let protocolo = demandProtocol();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!db.prepare("SELECT 1 FROM demandas WHERE protocolo = ?").get(protocolo)) break;
        protocolo = demandProtocol();
      }
      const noticeVersion = consentVersion();
      const noticeAcceptedAt = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT INTO demandas (id, protocolo, nome_solicitante, contato, municipio, bairro, categoria, tipo_problema, descricao, prioridade, status, usuario_id, aviso_privacidade_versao, aviso_privacidade_aceito_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEBIDA', ?, ?, ?)`)
          .run(id, protocolo, nome, contato || null, municipio, bairro || null, categoria, tipoProblema, descricao, prioridade, claims?.id || null, noticeVersion, noticeAcceptedAt);
        db.prepare(`INSERT INTO historico_status_demandas (id, demanda_id, status_anterior, status_novo, usuario_responsavel_id, observacao) VALUES (?, ?, NULL, 'RECEBIDA', NULL, 'Registro recebido pelo canal público.')`).run(uuidv4(), id);
      })();
      res.status(201).json({ id, protocolo, status: "RECEBIDA" });
    } catch (error) {
      console.error("Falha ao registrar demanda:", error);
      res.status(500).json({ error: "Não foi possível registrar a demanda." });
    } finally { db.close(); }
  });

  app.get("/api/demandas/protocolo/:protocolo", (req, res) => {
    let protocolo: string;
    try { protocolo = cleanProtocol(req.params.protocolo); }
    catch { return res.status(404).json({ error: "Protocolo não encontrado." }); }
    const db = getDb();
    try {
      const demanda = db.prepare(`SELECT protocolo, municipio, categoria, tipo_problema, status, created_at, updated_at FROM demandas WHERE protocolo = ?`).get(protocolo) as any | undefined;
      if (!demanda) return res.status(404).json({ error: "Protocolo não encontrado." });
      const historico = db.prepare(`SELECT status_novo, created_at FROM historico_status_demandas WHERE demanda_id = (SELECT id FROM demandas WHERE protocolo = ?) ORDER BY created_at ASC`).all(protocolo);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ demanda, historico });
    } finally { db.close(); }
  });

  app.get("/api/demandas/metricas", (_req, res) => {
    const db = getDb();
    try {
      const resumo = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS concluidas, SUM(CASE WHEN status NOT IN ('CONCLUIDA','INDEFERIDA') THEN 1 ELSE 0 END) AS pendentes, SUM(CASE WHEN prioridade = 'CRITICA' THEN 1 ELSE 0 END) AS criticas FROM demandas`).get() as any;
      const porStatus = db.prepare("SELECT status, COUNT(*) total FROM demandas GROUP BY status ORDER BY total DESC").all();
      const porMunicipio = db.prepare("SELECT municipio, COUNT(*) total FROM demandas GROUP BY municipio ORDER BY total DESC LIMIT 20").all();
      const porCategoria = db.prepare("SELECT categoria, COUNT(*) total FROM demandas GROUP BY categoria ORDER BY total DESC LIMIT 20").all();
      const porTipoProblema = db.prepare("SELECT categoria, tipo_problema, COUNT(*) total FROM demandas GROUP BY categoria, tipo_problema ORDER BY total DESC LIMIT 30").all();
      const recentes = db.prepare(`SELECT id, protocolo, municipio, bairro, categoria, tipo_problema, prioridade, status, created_at FROM demandas ORDER BY created_at DESC LIMIT 20`).all();
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ resumo: { total: Number(resumo?.total || 0), concluidas: Number(resumo?.concluidas || 0), pendentes: Number(resumo?.pendentes || 0), criticas: Number(resumo?.criticas || 0) }, porStatus, porMunicipio, porCategoria, porTipoProblema, recentes });
    } finally { db.close(); }
  });

  app.post("/api/relatorios/gerar", (req, res) => {
    const filtros = req.body?.filtros && typeof req.body.filtros === "object" ? req.body.filtros : {};
    const allowedColumns = new Set(["protocolo", "municipio", "bairro", "categoria", "tipo_problema", "descricao", "prioridade", "status", "created_at", "updated_at"]);
    const requested = Array.isArray(req.body?.colunas) ? req.body.colunas.filter((column: unknown) => allowedColumns.has(String(column))) : [];
    const columns = requested.length ? requested : ["protocolo", "municipio", "bairro", "categoria", "tipo_problema", "prioridade", "status", "created_at"];
    const conditions: string[] = [];
    const params: unknown[] = [];
    try {
      const dataInicio = cleanDate(filtros.dataInicio);
      const dataFim = cleanDate(filtros.dataFim);
      const municipio = cleanText(filtros.municipio, 120);
      const tema = cleanText(filtros.tema, 120);
      if (dataInicio) { conditions.push("date(created_at) >= date(?)"); params.push(dataInicio); }
      if (dataFim) { conditions.push("date(created_at) <= date(?)"); params.push(dataFim); }
      if (municipio) { conditions.push("municipio LIKE ?"); params.push(`%${municipio}%`); }
      if (tema) { conditions.push("categoria LIKE ?"); params.push(`%${tema}%`); }
    } catch { return validationError(res, "Filtros inválidos."); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const db = getDb();
    try {
      const rows = db.prepare(`SELECT ${columns.join(", ")} FROM demandas ${where} ORDER BY created_at DESC LIMIT 5000`).all(...params);
      res.setHeader("Cache-Control", "no-store, private");
      res.json(rows);
    } catch (error) {
      console.error("Falha ao gerar relatório:", error);
      res.status(500).json({ error: "Não foi possível gerar o relatório." });
    } finally { db.close(); }
  });
}
