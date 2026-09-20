import type { Express, Request } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getHealthyPostgres } from "./postgres.js";
import { removeDemandEvidence, uploadDemandEvidence } from "./evidenceStorage.js";
import { ensureDemandEvidenceSchema } from "./demandEvidencePostgres.js";
import { cleanProtocol, cleanText } from "./requestValidation.js";
import { AgePolicyError, ageBandForActiveParticipation, type AgeBand } from "./agePolicy.js";
import { isValidDemandClassification } from "../shared/demandTaxonomy.js";
import { demandRequestFingerprint, hashDemandEvidence, isIdempotentReplay, normalizeIdempotencyKey } from "./demandIdempotency.js";
import { evidenceUploadWarning, isEvidenceValidationFailure, persistedEvidenceSummary, summarizeEvidenceUpload, type EvidenceUploadSummary } from "./demandEvidenceResilience.js";
import { isCitizenSessionCurrent } from "./citizenSessionSecurity.js";

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

function cleanCep(value: unknown) {
  const cep = String(value || "").replace(/\D/g, "");
  if (!cep) return "";
  if (!/^\d{8}$/.test(cep)) throw new Error("invalid_cep");
  return cep;
}

function cleanUf(value: unknown) {
  const uf = cleanText(value, 2).toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error("invalid_uf");
  return uf;
}

function cleanIbge(value: unknown) {
  const code = cleanText(value, 16);
  if (code && !/^\d{6,16}$/.test(code)) throw new Error("invalid_ibge");
  return code;
}

function citizenClaims(req: Request) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, jwtSecret()) as any;
    if (
      claims?.type !== "cidadao"
      || typeof claims?.id !== "string"
      || !claims.id.trim()
      || typeof claims?.pwd !== "string"
      || !claims.pwd
    ) return null;
    return { id: claims.id as string, pwd: claims.pwd as string };
  } catch {
    return null;
  }
}

function validationError(res: any, message = "Revise os dados informados.") {
  return res.status(400).json({ error: message });
}

function evidenceResponse(summary: EvidenceUploadSummary) {
  const warning = evidenceUploadWarning(summary);
  return {
    evidencias: summary,
    ...(warning ? { warning } : {}),
  };
}

function persistedDemandResponse(row: Record<string, unknown>, replay = false) {
  const summary = persistedEvidenceSummary(row);
  return {
    id: row.id,
    protocolo: row.protocolo,
    status: row.status,
    ...(replay ? { idempotent_replay: true } : {}),
    ...evidenceResponse(summary),
  };
}

export function setupCitizenDemandPostgres(app: Express) {
  app.post("/api/demandas", async (req, res) => {
    if (!publicDemandIntakeEnabled()) return res.status(503).json({ error: "Recebimento público de demandas ainda não habilitado neste ambiente." });
    if (req.body?.aviso_privacidade_aceito !== true) return res.status(400).json({ error: "Confirme o aviso de privacidade para registrar a demanda." });

    const claims = citizenClaims(req);
    let idempotencyKey: string;
    try {
      idempotencyKey = normalizeIdempotencyKey(req.get("Idempotency-Key")) || uuidv4();
    } catch {
      return res.status(400).json({ error: "Chave de idempotência inválida.", code: "INVALID_IDEMPOTENCY_KEY" });
    }
    let nome: string, contato: string, municipio: string, bairro: string, categoria: string, tipoProblema: string, descricao: string, prioridade: string;
    let cep: string, logradouro: string, numero: string, complemento: string, uf: string, codigoIbge: string;
    const legacyPhoto = typeof req.body?.foto_evidencia_base64 === "string" ? req.body.foto_evidencia_base64.trim() : "";
    const photoCandidates = Array.isArray(req.body?.foto_evidencias_base64)
      ? req.body.foto_evidencias_base64
      : legacyPhoto ? [legacyPhoto] : [];
    const fotoEvidenciasBase64 = photoCandidates
      .filter((value: unknown) => typeof value === "string" && value.trim())
      .map((value: string) => value.trim());
    if (fotoEvidenciasBase64.length > 7) {
      return res.status(400).json({ error: "É permitido enviar no máximo 7 fotos por demanda." });
    }

    try {
      nome = cleanText(req.body?.nome_solicitante, 160, true);
      contato = cleanText(req.body?.contato, 200);
      const municipioInformado = cleanText(req.body?.municipio, 120, true);
      bairro = cleanText(req.body?.bairro, 160);
      cep = cleanCep(req.body?.cep);
      logradouro = cleanText(req.body?.logradouro, 180);
      numero = cleanText(req.body?.numero, 80);
      complemento = cleanText(req.body?.complemento, 180);
      const ufInformada = cleanUf(req.body?.uf);
      const codigoIbgeInformado = cleanIbge(req.body?.codigo_ibge);
      if (municipioInformado.toLowerCase() !== "manaus") throw new Error("invalid_municipio");
      if (ufInformada && ufInformada !== "AM") throw new Error("invalid_uf");
      if (codigoIbgeInformado && codigoIbgeInformado !== "1302603") throw new Error("invalid_ibge_manaus");
      municipio = "Manaus";
      uf = "AM";
      codigoIbge = codigoIbgeInformado;
      categoria = cleanText(req.body?.categoria, 120, true).toUpperCase();
      tipoProblema = cleanText(req.body?.tipo_problema, 120, true).toUpperCase();
      if (!isValidDemandClassification(categoria, tipoProblema)) throw new Error("invalid_demand_classification");
      descricao = cleanText(req.body?.descricao, 5000, true);
      prioridade = "MEDIA";
    } catch {
      return validationError(res);
    }

    try {
      const sql = await getHealthyPostgres();
      const requestFingerprint = demandRequestFingerprint({
        actor: claims?.id || null,
        nome,
        contato: contato || null,
        municipio,
        bairro: bairro || null,
        cep: cep || null,
        logradouro: logradouro || null,
        numero: numero || null,
        complemento: complemento || null,
        uf,
        codigo_ibge: codigoIbge || null,
        categoria,
        tipo_problema: tipoProblema,
        descricao,
        faixa_etaria: String(req.body?.faixa_etaria || ""),
        aviso_privacidade_aceito: true,
        evidencias: fotoEvidenciasBase64.map(hashDemandEvidence),
      });

      const [existingDemand] = await sql`
        select id, protocolo, status, request_fingerprint,
               evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas
        from public.demandas
        where idempotency_key = ${idempotencyKey}
        limit 1
      `;
      if (existingDemand) {
        if (!isIdempotentReplay(existingDemand.request_fingerprint, requestFingerprint)) {
          return res.status(409).json({
            error: "Esta tentativa de envio já foi usada com dados diferentes. Revise o formulário e envie novamente.",
            code: "IDEMPOTENCY_KEY_REUSED",
          });
        }
        res.setHeader("Idempotent-Replay", "true");
        return res.status(200).json(persistedDemandResponse(existingDemand, true));
      }

      let usuarioId: string | null = null;
      let faixaEtaria: AgeBand | null = null;
      let revisaoReforcada = false;

      if (claims) {
        const [user] = await sql`select id, status, faixa_etaria, protecao_reforcada, password_hash from public.usuarios where id = ${claims.id} limit 1`;
        if (
          !user
          || user.status === "excluido"
          || user.status === "suspenso"
          || !isCitizenSessionCurrent(claims.pwd, user.password_hash)
        ) {
          res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
          return res.status(401).json({ error: "Sessão inválida. Entre novamente para vincular o registro à sua conta." });
        }
        usuarioId = claims.id;
        if (user.faixa_etaria) {
          const agePolicy = ageBandForActiveParticipation(user.faixa_etaria);
          faixaEtaria = agePolicy.ageBand;
          revisaoReforcada = Boolean(user.protecao_reforcada) || agePolicy.enhancedProtection;
        }
      }

      if (!faixaEtaria) {
        const agePolicy = ageBandForActiveParticipation(req.body?.faixa_etaria);
        faixaEtaria = agePolicy.ageBand;
        revisaoReforcada = agePolicy.enhancedProtection;
      }

      const id = uuidv4();
      let uploadedEvidences: Array<{ path: string; mime: string; ordem: number }> = [];
      let evidenceSummary = summarizeEvidenceUpload(fotoEvidenciasBase64.length, 0);
      if (fotoEvidenciasBase64.length) {
        await ensureDemandEvidenceSchema();
        const uploads = await Promise.allSettled(
          fotoEvidenciasBase64.map((photo) => uploadDemandEvidence(id, photo))
        );

        const fulfilledUploads = uploads.flatMap((result, index) =>
          result.status === "fulfilled" ? [{ ...result.value, ordem: index + 1 }] : []
        );
        const validationFailure = uploads.find(
          (result): result is PromiseRejectedResult => result.status === "rejected" && isEvidenceValidationFailure(result.reason)
        );
        if (validationFailure) {
          await Promise.all(fulfilledUploads.map((item) => removeDemandEvidence(item.path).catch(() => undefined)));
          throw validationFailure.reason;
        }

        uploadedEvidences = fulfilledUploads;
        evidenceSummary = summarizeEvidenceUpload(fotoEvidenciasBase64.length, uploadedEvidences.length);
        if (evidenceSummary.falhas > 0) {
          console.warn("Registro seguirá com falha técnica de evidência:", {
            demandaId: id,
            solicitadas: evidenceSummary.solicitadas,
            anexadas: evidenceSummary.anexadas,
            falhas: evidenceSummary.falhas,
          });
        }
      }
      const firstEvidence = uploadedEvidences[0] || null;
      const revisaoMotivo = revisaoReforcada ? "Participante adolescente de 16 a 17 anos — proteção reforçada P0-E." : null;
      let protocolo = "";
      let inserted = false;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        protocolo = demandProtocol();
        try {
          await sql.begin(async (transaction) => {
            await transaction`
              insert into public.demandas (
                id, protocolo, nome_solicitante, contato, municipio, bairro, cep, logradouro, numero, complemento, uf, codigo_ibge,
                categoria, tipo_problema, descricao, prioridade, status, usuario_id, evidencia_foto_path, evidencia_foto_mime,
                evidencia_moderacao_status, aviso_privacidade_versao, aviso_privacidade_data,
                faixa_etaria, revisao_reforcada, revisao_reforcada_motivo,
                idempotency_key, request_fingerprint,
                evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas
              ) values (
                ${id}, ${protocolo}, ${nome}, ${contato || null}, ${municipio}, ${bairro || null}, ${cep || null}, ${logradouro || null},
                ${numero || null}, ${complemento || null}, ${uf || null}, ${codigoIbge || null}, ${categoria}, ${tipoProblema}, ${descricao},
                ${prioridade}, 'RECEBIDA', ${usuarioId}, ${firstEvidence?.path || null}, ${firstEvidence?.mime || null},
                ${uploadedEvidences.length ? "PENDENTE" : "NAO_ENVIADA"}, ${privacyVersion()}, ${new Date().toISOString()},
                ${faixaEtaria}, ${revisaoReforcada}, ${revisaoMotivo},
                ${idempotencyKey}, ${requestFingerprint},
                ${evidenceSummary.status}, ${evidenceSummary.solicitadas}, ${evidenceSummary.anexadas}, ${evidenceSummary.falhas}
              )
            `;
            const baseObservation = revisaoReforcada
              ? "Registro recebido com proteção reforçada P0-E."
              : usuarioId
                ? "Registro recebido por cidadão autenticado."
                : "Registro recebido pelo formulário público.";
            const evidenceObservation = evidenceSummary.falhas > 0
              ? ` Evidências: ${evidenceSummary.anexadas}/${evidenceSummary.solicitadas} anexadas; ${evidenceSummary.falhas} com falha técnica de upload.`
              : "";
            await transaction`
              insert into public.historico_status_demandas (id, demanda_id, status_anterior, status_novo, usuario_responsavel_id, observacao)
              values (${uuidv4()}, ${id}, null, 'RECEBIDA', ${usuarioId}, ${baseObservation + evidenceObservation})
            `;
            for (let index = 0; index < uploadedEvidences.length; index += 1) {
              const evidence = uploadedEvidences[index];
              await transaction`
                insert into public.demanda_evidencias (id, demanda_id, storage_path, mime, ordem, moderacao_status)
                values (${uuidv4()}, ${id}, ${evidence.path}, ${evidence.mime}, ${evidence.ordem}, 'PENDENTE')
              `;
            }
          });
          inserted = true;
          break;
        } catch (error: any) {
          if (error?.code === "23505") {
            const [existingDemand] = await sql`
              select id, protocolo, status, request_fingerprint,
                     evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas
              from public.demandas
              where idempotency_key = ${idempotencyKey}
              limit 1
            `;
            if (existingDemand) {
              if (uploadedEvidences.length) {
                await Promise.all(uploadedEvidences.map((item) => removeDemandEvidence(item.path).catch(() => undefined)));
              }
              if (!isIdempotentReplay(existingDemand.request_fingerprint, requestFingerprint)) {
                return res.status(409).json({
                  error: "Esta tentativa de envio já foi usada com dados diferentes. Revise o formulário e envie novamente.",
                  code: "IDEMPOTENCY_KEY_REUSED",
                });
              }
              res.setHeader("Idempotent-Replay", "true");
              return res.status(200).json(persistedDemandResponse(existingDemand, true));
            }
            continue;
          }
          if (uploadedEvidences.length) await Promise.all(uploadedEvidences.map((item) => removeDemandEvidence(item.path).catch(() => undefined)));
          throw error;
        }
      }

      if (!inserted) {
        if (uploadedEvidences.length) await Promise.all(uploadedEvidences.map((item) => removeDemandEvidence(item.path).catch(() => undefined)));
        throw new Error("Não foi possível gerar protocolo único.");
      }
      return res.status(201).json({ id, protocolo, status: "RECEBIDA", ...evidenceResponse(evidenceSummary) });
    } catch (error: any) {
      if (error instanceof AgePolicyError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      console.error("Falha ao registrar demanda:", error);
      if (isEvidenceValidationFailure(error)) {
        return res.status(400).json({ error: "A foto enviada não pôde ser validada." });
      }
      const configError = ["DATABASE_URL não configurada", "JWT_SECRET não configurado", "Supabase Storage não configurado"].includes(error?.message);
      return res.status(configError ? 503 : 500).json({ error: configError ? "Servidor ainda não configurado para receber demandas." : "Não foi possível registrar a demanda." });
    }
  });

  app.get("/api/minha-conta/demandas", async (req, res) => {
    const claims = citizenClaims(req);
    if (!claims) return res.status(401).json({ error: "Entre na sua conta para ver seus registros." });

    try {
      const sql = await getHealthyPostgres();
      const [user] = await sql`
        select id, status, password_hash
        from public.usuarios
        where id = ${claims.id}
        limit 1
      `;
      if (
        !user
        || user.status === "excluido"
        || user.status === "suspenso"
        || !isCitizenSessionCurrent(claims.pwd, user.password_hash)
      ) {
        res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
      }

      const registros = await sql`
        select protocolo, municipio, bairro, categoria, tipo_problema, prioridade, status, created_at, updated_at
        from public.demandas
        where usuario_id = ${claims.id}
        order by created_at desc
        limit 100
      `;

      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ total: registros.length, registros });
    } catch (error: any) {
      console.error("Falha ao carregar registros do cidadão:", error);
      const configError = error?.message === "DATABASE_URL não configurada";
      return res.status(configError ? 503 : 500).json({
        error: configError ? "Banco de dados ainda não configurado." : "Não foi possível carregar seus registros.",
      });
    }
  });

  app.get("/api/demandas/protocolo/:protocolo", async (req, res) => {
    let protocolo: string;
    try { protocolo = cleanProtocol(req.params.protocolo); } catch { return res.status(404).json({ error: "Protocolo não encontrado." }); }
    try {
      const sql = await getHealthyPostgres();
      const [demanda] = await sql`
        select protocolo, municipio, categoria, tipo_problema, status, created_at, updated_at
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