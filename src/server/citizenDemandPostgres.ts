import type { Express, Request } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";
import { removeDemandEvidence, uploadDemandEvidence } from "./evidenceStorage.js";
import { cleanEnum, cleanProtocol, cleanText } from "./requestValidation.js";
import { AgePolicyError, ageBandForActiveParticipation, type AgeBand } from "./agePolicy.js";

const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET não configurado");
  return "super-secret-key-for-dev";
}

function privacyVersion() {
  return process.env.LGPD_CONSENT_VERSION?.trim() || "2026-09-v1";
}

function demandProtocol() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `AM-${date}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function publicDemandIntakeEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true";
}

function citizenClaims(req: Request) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, jwtSecret()) as any;
    if (claims?.type !== "cidadao" || typeof claims?.id !== "string" || !claims.id.trim()) return null;
    return { id: claims.id as string };
  } catch {
    return null;
  }
}

function validationError(res: any, message = "Revise os dados informados.") {
  return res.status(400).json({ error: message });
}

export function setupCitizenDemandPostgres(app: Express) {
  app.post("/api/demandas", async (req, res) => {
    if (!publicDemandIntakeEnabled()) return res.status(503).json({ error: "Recebimento público de demandas ainda não habilitado neste ambiente." });
    if (req.body?.aviso_privacidade_aceito !== true) return res.status(400).json({ error: "Confirme o aviso de privacidade para registrar a demanda." });

    const claims = citizenClaims(req);
    let nome: string, contato: string, municipio: string, bairro: string, categoria: string, descricao: string, prioridade: string;
    const fotoEvidenciaBase64 = typeof req.body?.foto_evidencia_base64 === "string" ? req.body.foto_evidencia_base64.trim() : "";

    try {
      nome = cleanText(req.body?.nome_solicitante, 160, true);
      contato = cleanText(req.body?.contato, 200);
      municipio = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160);
      categoria = cleanText(req.body?.categoria, 120, true);
      descricao = cleanText(req.body?.descricao, 5000, true);
      prioridade = cleanEnum(req.body?.prioridade, PRIORITIES, "MEDIA");
    } catch {
      return validationError(res);
    }

    try {
      const sql = getPostgres();
      let usuarioId: string | null = null;
      let faixaEtaria: AgeBand | null = null;
      let revisaoReforcada = false;

      if (claims) {
        const [user] = await sql`select id, status, faixa_etaria, protecao_reforcada from public.usuarios where id = ${claims.id} limit 1`;
        if (user && user.status !== "excluido" && user.status !== "suspenso") {
          usuarioId = claims.id;
          if (user.faixa_etaria) {
            const agePolicy = ageBandForActiveParticipation(user.faixa_etaria);
            faixaEtaria = agePolicy.ageBand;
            revisaoReforcada = Boolean(user.protecao_reforcada) || agePolicy.enhancedProtection;
          }
        }
      }

      if (!faixaEtaria) {
        const agePolicy = ageBandForActiveParticipation(req.body?.faixa_etaria);
        faixaEtaria = agePolicy.ageBand;
        revisaoReforcada = agePolicy.enhancedProtection;
      }

      const id = uuidv4();
      const uploadedEvidence = fotoEvidenciaBase64 ? await uploadDemandEvidence(id, fotoEvidenciaBase64) : null;
      const revisaoMotivo = revisaoReforcada ? "Participante adolescente de 16 a 17 anos — proteção reforçada P0-E." : null;
      let protocolo = "";
      let inserted = false;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        protocolo = demandProtocol();
        try {
          await sql.begin(async (transaction) => {
            await transaction`
              insert into public.demandas (
                id, protocolo, nome_solicitante, contato, municipio, bairro, categoria, descricao,
                prioridade, status, usuario_id, evidencia_foto_path, evidencia_foto_mime,
                evidencia_moderacao_status, aviso_privacidade_versao, aviso_privacidade_data,
                faixa_etaria, revisao_reforcada, revisao_reforcada_motivo
              ) values (
                ${id}, ${protocolo}, ${nome}, ${contato || null}, ${municipio}, ${bairro || null}, ${categoria}, ${descricao},
                ${prioridade}, 'RECEBIDA', ${usuarioId}, ${uploadedEvidence?.path || null}, ${uploadedEvidence?.mime || null},
                ${uploadedEvidence ? "PENDENTE" : "NAO_ENVIADA"}, ${privacyVersion()}, ${new Date().toISOString()},
                ${faixaEtaria}, ${revisaoReforcada}, ${revisaoMotivo}
              )
            `;
            await transaction`
              insert into public.historico_status_demandas (id, demanda_id, status_anterior, status_novo, usuario_responsavel_id, observacao)
              values (${uuidv4()}, ${id}, null, 'RECEBIDA', ${usuarioId}, ${revisaoReforcada ? "Registro recebido com proteção reforçada P0-E." : usuarioId ? "Registro recebido por cidadão autenticado." : "Registro recebido pelo formulário público."})
            `;
          });
          inserted = true;
          break;
        } catch (error: any) {
          if (error?.code === "23505") continue;
          if (uploadedEvidence) await removeDemandEvidence(uploadedEvidence.path).catch(() => undefined);
          throw error;
        }
      }

      if (!inserted) {
        if (uploadedEvidence) await removeDemandEvidence(uploadedEvidence.path).catch(() => undefined);
        throw new Error("Não foi possível gerar protocolo único.");
      }
      return res.status(201).json({ id, protocolo, status: "RECEBIDA" });
    } catch (error: any) {
      if (error instanceof AgePolicyError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      console.error("Falha ao registrar demanda:", error);
      if (["Formato de evidência inválido", "Tipo de evidência não permitido", "Tamanho de evidência inválido"].includes(error?.message)) {
        return res.status(400).json({ error: "A foto enviada não pôde ser validada." });
      }
      const configError = ["DATABASE_URL não configurada", "JWT_SECRET não configurado", "Supabase Storage não configurado"].includes(error?.message);
      return res.status(configError ? 503 : 500).json({ error: configError ? "Servidor ainda não configurado para receber demandas." : "Não foi possível registrar a demanda." });
    }
  });

  app.get("/api/demandas/protocolo/:protocolo", async (req, res) => {
    let protocolo: string;
    try { protocolo = cleanProtocol(req.params.protocolo); } catch { return res.status(404).json({ error: "Protocolo não encontrado." }); }
    try {
      const sql = getPostgres();
      const [demanda] = await sql`
        select protocolo, municipio, categoria, status, created_at, updated_at
        from public.demandas where protocolo = ${protocolo} limit 1
      `;
      if (!demanda) return res.status(404).json({ error: "Protocolo não encontrado." });
      const historico = await sql`
        select status_novo, created_at from public.historico_status_demandas
        where demanda_id = (select id from public.demandas where protocolo = ${protocolo} limit 1)
        order by created_at asc
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ demanda, historico });
    } catch (error: any) {
      console.error("Falha ao consultar protocolo:", error);
      const configError = error?.message === "DATABASE_URL não configurada";
      return res.status(configError ? 503 : 500).json({ error: configError ? "Banco de dados ainda não configurado." : "Não foi possível consultar o protocolo." });
    }
  });
}
