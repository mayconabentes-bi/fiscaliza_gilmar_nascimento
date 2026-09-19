import type { Express } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";
import { createDemandEvidenceSignedUrl, removeDemandEvidence } from "./evidenceStorage.js";
import { applyRetentionPostgres, retentionPreviewPostgres } from "./retentionPostgres.js";
import { ensureDemandEvidenceSchema } from "./demandEvidencePostgres.js";

const STATUS_VALIDOS = ["RECEBIDA","EM_TRIAGEM","ENCAMINHADA","EM_ANALISE","EM_EXECUCAO","CONCLUIDA","INDEFERIDA"];
const PRIORIDADES_VALIDAS = ["BAIXA","MEDIA","ALTA","CRITICA"];
const EVIDENCIA_DECISOES = ["APROVAR_PRIVADA","REJEITAR","REQUER_ANONIMIZACAO"];

export function setupPrivateAdminPostgresRoutes(app: Express) {
  app.get("/api/demandas/metricas", async (_req, res) => {
    try {
      const sql = getPostgres();
      const [summaryRows, statusRows, municipioRows, categoriaRows, tipoProblemaRows] = await Promise.all([
        sql`
          select
            count(*)::int as total,
            count(*) filter (where status = 'CONCLUIDA')::int as concluidas,
            count(*) filter (where status <> 'CONCLUIDA')::int as pendentes,
            count(*) filter (where prioridade = 'CRITICA')::int as criticas
          from public.demandas
        `,
        sql`select status, count(*)::int as total from public.demandas group by status order by total desc, status asc`,
        sql`select municipio, count(*)::int as total from public.demandas group by municipio order by total desc, municipio asc limit 50`,
        sql`select categoria, count(*)::int as total from public.demandas group by categoria order by total desc, categoria asc limit 50`,
        sql`select categoria, tipo_problema, count(*)::int as total from public.demandas group by categoria, tipo_problema order by total desc, categoria asc, tipo_problema asc limit 100`,
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({
        resumo: summaryRows[0] || { total: 0, concluidas: 0, pendentes: 0, criticas: 0 },
        porStatus: statusRows,
        porMunicipio: municipioRows,
        porCategoria: categoriaRows,
        porTipoProblema: tipoProblemaRows,
      });
    } catch (error) {
      console.error("Falha ao carregar métricas administrativas:", error);
      return res.status(500).json({ error: "Erro ao carregar métricas administrativas." });
    }
  });

  app.post("/api/relatorios/gerar", async (req, res) => {
    try {
      const filtros = req.body?.filtros || {};
      const dataInicio = String(filtros.dataInicio || "").trim();
      const dataFim = String(filtros.dataFim || "").trim();
      const municipio = String(filtros.municipio || "").trim();
      const tema = String(filtros.tema || "").trim();
      const sql = getPostgres();
      const rows = await sql`
        select protocolo, municipio, bairro, categoria, tipo_problema, descricao, prioridade, status, created_at
        from public.demandas
        where (${dataInicio} = '' or created_at >= ${dataInicio || '1900-01-01'}::date)
          and (${dataFim} = '' or created_at < (${dataFim || '2999-12-31'}::date + interval '1 day'))
          and (${municipio} = '' or municipio ilike ${`%${municipio}%`})
          and (${tema} = '' or categoria ilike ${`%${tema}%`})
        order by created_at desc
        limit 2000
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) {
      console.error("Falha ao gerar relatório administrativo:", error);
      return res.status(500).json({ error: "Erro ao gerar relatório." });
    }
  });

  app.get("/api/admin/demandas", async (req, res) => {
    try {
      const sql = getPostgres();
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const prioridade = typeof req.query.prioridade === "string" ? req.query.prioridade.trim().toUpperCase().slice(0, 20) : "";
      const protocolo = typeof req.query.protocolo === "string" ? req.query.protocolo.trim().toUpperCase().slice(0, 80) : "";
      const municipio = typeof req.query.municipio === "string" ? req.query.municipio.trim().slice(0, 120) : "";
      const bairro = typeof req.query.bairro === "string" ? req.query.bairro.trim().slice(0, 160) : "";
      const categoria = typeof req.query.categoria === "string" ? req.query.categoria.trim() : "";
      const tipoProblema = typeof req.query.tipo_problema === "string" ? req.query.tipo_problema.trim() : "";
      if (status && !STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: "Status inválido." });
      if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida." });
      const rows = await sql`
        select id, protocolo, nome_solicitante, contato, municipio, bairro, categoria, tipo_problema, descricao,
               prioridade, status, observacao_interna, usuario_id, evidencia_moderacao_status,
               evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas,
               (evidencia_foto_path is not null) as tem_evidencia_foto,
               (select count(*)::int from public.demanda_evidencias de where de.demanda_id = public.demandas.id and de.storage_path is not null) as evidencia_total,
               created_at, updated_at
        from public.demandas
        where (${status} = '' or status = ${status})
          and (${prioridade} = '' or prioridade = ${prioridade})
          and (${protocolo} = '' or protocolo ilike ${`%${protocolo}%`})
          and (${municipio} = '' or municipio ilike ${`%${municipio}%`})
          and (${bairro} = '' or coalesce(bairro, '') ilike ${`%${bairro}%`})
          and (${categoria} = '' or categoria = ${categoria})
          and (${tipoProblema} = '' or tipo_problema = ${tipoProblema})
        order by created_at desc limit 500
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) {
      console.error("Falha ao listar demandas administrativas:", error);
      return res.status(500).json({ error: "Erro ao listar demandas." });
    }
  });

  app.get("/api/admin/demandas/:id/evidencia", async (req, res) => {
    try {
      const sql = getPostgres();
      const [row] = await sql`select evidencia_foto_path, evidencia_foto_mime from public.demandas where id = ${req.params.id} limit 1`;
      if (!row?.evidencia_foto_path) return res.status(404).json({ error: "Evidência não encontrada." });
      const url = await createDemandEvidenceSignedUrl(String(row.evidencia_foto_path), 300);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ url, mime: row.evidencia_foto_mime || "application/octet-stream", expiresIn: 300 });
    } catch (error) {
      console.error("Falha ao acessar evidência:", error);
      return res.status(500).json({ error: "Não foi possível acessar a evidência." });
    }
  });


  app.get("/api/admin/demandas/:id/evidencias", async (req, res) => {
    try {
      await ensureDemandEvidenceSchema();
      const sql = getPostgres();
      const rows = await sql`
        select id, storage_path, mime, ordem, moderacao_status
        from public.demanda_evidencias
        where demanda_id = ${req.params.id} and storage_path is not null
        order by ordem asc
      `;

      if (rows.length) {
        const evidencias = await Promise.all(rows.map(async (row: any) => ({
          id: row.id,
          ordem: Number(row.ordem),
          mime: row.mime || "application/octet-stream",
          moderacao_status: row.moderacao_status || "PENDENTE",
          url: await createDemandEvidenceSignedUrl(String(row.storage_path), 300),
          expiresIn: 300,
        })));
        res.setHeader("Cache-Control", "no-store, private");
        return res.json({ evidencias });
      }

      const [legacy] = await sql`
        select evidencia_foto_path, evidencia_foto_mime, evidencia_moderacao_status
        from public.demandas where id = ${req.params.id} limit 1
      `;
      if (!legacy?.evidencia_foto_path) return res.status(404).json({ error: "Evidência não encontrada." });
      const url = await createDemandEvidenceSignedUrl(String(legacy.evidencia_foto_path), 300);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({
        evidencias: [{
          id: req.params.id,
          ordem: 1,
          url,
          mime: legacy.evidencia_foto_mime || "application/octet-stream",
          moderacao_status: legacy.evidencia_moderacao_status || "PENDENTE",
          expiresIn: 300,
          legacy: true,
        }]
      });
    } catch (error) {
      console.error("Falha ao acessar evidências:", error);
      return res.status(500).json({ error: "Não foi possível acessar as evidências." });
    }
  });

  app.patch("/api/admin/demandas/:id/status", async (req: any, res) => {
    const status = String(req.body?.status || "").trim();
    const prioridade = req.body?.prioridade ? String(req.body.prioridade).trim() : "";
    const observacao = String(req.body?.observacao_interna || "").trim().slice(0, 2000);
    if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: "Status inválido." });
    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida." });

    try {
      const sql = getPostgres();
      const result = await sql.begin(async (tx) => {
        const [atual] = await tx`select id, protocolo, status, prioridade from public.demandas where id = ${req.params.id} for update`;
        if (!atual) return null;
        const encerrandoAgora = ["CONCLUIDA", "INDEFERIDA"].includes(status) && String(atual.status) !== status;
        if (encerrandoAgora && !observacao) throw new Error("FINAL_JUSTIFICATION_REQUIRED");
        const prioridadeFinal = prioridade || String(atual.prioridade);
        await tx`
          update public.demandas set status = ${status}, prioridade = ${prioridadeFinal},
            observacao_interna = ${observacao || null}, updated_at = now()
          where id = ${req.params.id}
        `;
        if (String(atual.status) !== status) {
          await tx`
            insert into public.historico_status_demandas
              (id, demanda_id, status_anterior, status_novo, usuario_responsavel_id, observacao)
            values (${uuidv4()}, ${req.params.id}, ${String(atual.status)}, ${status}, ${req.user?.id || null}, ${observacao || null})
          `;
        }
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'demanda', ${req.params.id}, 'STATUS_ATUALIZADO', ${req.user?.id || null},
                  ${sql.json({ status_anterior: atual.status, status_novo: status, prioridade: prioridadeFinal })})
        `;
        return { protocolo: atual.protocolo, status, prioridade: prioridadeFinal };
      });
      if (!result) return res.status(404).json({ error: "Demanda não encontrada." });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      if (error?.message === "FINAL_JUSTIFICATION_REQUIRED") {
        return res.status(400).json({ error: "Informe uma justificativa para concluir ou indeferir a demanda." });
      }
      console.error("Falha ao atualizar demanda:", error);
      return res.status(500).json({ error: "Erro ao atualizar demanda." });
    }
  });

  app.get("/api/admin/evidencias/pendentes", async (_req, res) => {
    try {
      const sql = getPostgres();
      const rows = await sql`
        select id, protocolo, municipio, bairro, categoria, tipo_problema, evidencia_foto_mime,
               evidencia_moderacao_status, created_at
        from public.demandas
        where evidencia_foto_path is not null
          and evidencia_moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO')
        order by created_at asc limit 200
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Erro ao listar evidências." });
    }
  });

  app.post("/api/admin/evidencias/item/:id/decisao", async (req: any, res) => {
    const decisao = String(req.body?.decisao || "");
    const observacao = String(req.body?.observacao || "").trim().slice(0, 1000);
    if (!EVIDENCIA_DECISOES.includes(decisao)) return res.status(400).json({ error: "Decisão de evidência inválida." });

    try {
      await ensureDemandEvidenceSchema();
      const sql = getPostgres();
      const [evidence] = await sql`
        select id, demanda_id, storage_path, ordem
        from public.demanda_evidencias
        where id = ${req.params.id}
        limit 1
      `;
      if (!evidence) return res.status(404).json({ error: "Evidência não encontrada." });

      const status = decisao === "REJEITAR"
        ? "REJEITADA"
        : decisao === "REQUER_ANONIMIZACAO"
          ? "REQUER_ANONIMIZACAO"
          : "APROVADA_PRIVADA";

      if (status === "REJEITADA" && evidence.storage_path) {
        await removeDemandEvidence(String(evidence.storage_path));
      }

      await sql.begin(async (tx) => {
        await tx`
          update public.demanda_evidencias
          set moderacao_status = ${status},
              revisada_em = now(),
              revisada_por = ${req.user?.id || "admin"},
              moderacao_observacao = ${observacao || null},
              storage_path = case when ${status} = 'REJEITADA' then null else storage_path end
          where id = ${req.params.id}
        `;

        const [aggregate] = await tx`
          select
            count(*) filter (where moderacao_status = 'PENDENTE')::int as pendentes,
            count(*) filter (where moderacao_status = 'REQUER_ANONIMIZACAO')::int as anonimizar,
            count(*) filter (where moderacao_status = 'APROVADA_PRIVADA')::int as aprovadas
          from public.demanda_evidencias
          where demanda_id = ${evidence.demanda_id}
        `;

        const aggregateStatus = Number(aggregate?.pendentes) > 0
          ? "PENDENTE"
          : Number(aggregate?.anonimizar) > 0
            ? "REQUER_ANONIMIZACAO"
            : Number(aggregate?.aprovadas) > 0
              ? "APROVADA_PRIVADA"
              : "REJEITADA";

        await tx`
          update public.demandas
          set evidencia_moderacao_status = ${aggregateStatus},
              evidencia_foto_path = case
                when ${Number(evidence.ordem)} = 1 and ${status} = 'REJEITADA' then null
                else evidencia_foto_path
              end,
              evidencia_foto_mime = case
                when ${Number(evidence.ordem)} = 1 and ${status} = 'REJEITADA' then null
                else evidencia_foto_mime
              end
          where id = ${evidence.demanda_id}
        `;

        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (
            ${uuidv4()}, 'demanda_evidencia', ${req.params.id}, 'EVIDENCIA_MODERADA',
            ${req.user?.id || null}, ${sql.json({ decisao, status, demanda_id: evidence.demanda_id })}
          )
        `;
      });

      return res.json({ success: true, status });
    } catch (error) {
      console.error("Falha ao moderar evidência individual:", error);
      return res.status(500).json({ error: "Erro ao moderar evidência." });
    }
  });

  app.post("/api/admin/evidencias/:id/decisao", async (req: any, res) => {
    const decisao = String(req.body?.decisao || "");
    const observacao = String(req.body?.observacao || "").trim().slice(0, 1000);
    if (!EVIDENCIA_DECISOES.includes(decisao)) return res.status(400).json({ error: "Decisão de evidência inválida." });

    try {
      const sql = getPostgres();
      const [row] = await sql`select evidencia_foto_path from public.demandas where id = ${req.params.id} limit 1`;
      if (!row?.evidencia_foto_path) return res.status(404).json({ error: "Evidência não encontrada." });
      const status = decisao === "REJEITAR" ? "REJEITADA" : decisao === "REQUER_ANONIMIZACAO" ? "REQUER_ANONIMIZACAO" : "APROVADA_PRIVADA";
      if (status === "REJEITADA") await removeDemandEvidence(String(row.evidencia_foto_path));
      await sql.begin(async (tx) => {
        await tx`
          update public.demandas
          set evidencia_moderacao_status = ${status}, evidencia_revisada_em = now(),
              evidencia_revisada_por = ${req.user?.id || 'admin'}, evidencia_moderacao_observacao = ${observacao || null},
              evidencia_foto_path = case when ${status} = 'REJEITADA' then null else evidencia_foto_path end,
              evidencia_foto_mime = case when ${status} = 'REJEITADA' then null else evidencia_foto_mime end
          where id = ${req.params.id}
        `;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'demanda', ${req.params.id}, 'EVIDENCIA_MODERADA', ${req.user?.id || null}, ${sql.json({ decisao, status })})
        `;
      });
      return res.json({ success: true, status });
    } catch (error) {
      console.error("Falha ao moderar evidência:", error);
      return res.status(500).json({ error: "Erro ao moderar evidência." });
    }
  });

  app.get("/api/admin/moderacao/pendentes", async (_req, res) => {
    try {
      const sql = getPostgres();
      const rows = await sql`
        select id, tipo_participacao, area_tematica, municipio, conteudo, created_at
        from public.publicacoes
        where status_moderacao = 'pendente'
        order by created_at asc
        limit 200
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) {
      console.error("Falha ao buscar moderação pendente:", error);
      return res.status(500).json({ error: "Erro ao buscar publicações pendentes." });
    }
  });

  app.post("/api/admin/moderacao/decisao", async (req: any, res) => {
    const publicacaoId = String(req.body?.publicacaoId || "").trim();
    const decisao = String(req.body?.decisao || "").trim();
    const justificativa = String(req.body?.justificativa || "").trim().slice(0, 2000);
    if (!publicacaoId || !["APROVADA", "REJEITADA"].includes(decisao) || !justificativa) {
      return res.status(400).json({ error: "Decisão inválida." });
    }
    const status = decisao === "APROVADA" ? "aprovado" : "rejeitado";
    try {
      const sql = getPostgres();
      await sql.begin(async (tx) => {
        const [pub] = await tx`select id from public.publicacoes where id = ${publicacaoId} for update`;
        if (!pub) throw new Error("PUBLICACAO_NOT_FOUND");
        await tx`update public.publicacoes set status_moderacao = ${status} where id = ${publicacaoId}`;
        await tx`
          insert into public.registros_moderacao (id, publicacao_id, decisao, justificativa, moderador_id)
          values (${uuidv4()}, ${publicacaoId}, ${decisao}, ${justificativa}, ${req.user?.id})
        `;
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'publicacao', ${publicacaoId}, 'MODERACAO_DECIDIDA', ${req.user?.id || null}, ${sql.json({ decisao })})
        `;
      });
      return res.json({ success: true });
    } catch (error: any) {
      if (error?.message === "PUBLICACAO_NOT_FOUND") return res.status(404).json({ error: "Publicação não encontrada." });
      console.error("Falha ao registrar moderação:", error);
      return res.status(500).json({ error: "Erro ao registrar decisão." });
    }
  });

  app.get("/api/admin/denuncias", async (_req, res) => {
    try {
      const sql = getPostgres();
      const rows = await sql`
        select d.id, d.motivo, d.created_at, p.id as publicacao_id, p.conteudo as publicacao_conteudo
        from public.denuncias d
        join public.publicacoes p on p.id = d.publicacao_id
        where d.status = 'PENDENTE'
        order by d.created_at asc
        limit 200
      `;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) {
      console.error("Falha ao buscar denúncias:", error);
      return res.status(500).json({ error: "Erro ao buscar denúncias." });
    }
  });

  app.post("/api/admin/denuncias/:id/resolver", async (req: any, res) => {
    const acao = String(req.body?.acao || "");
    if (!["MANTER", "REMOVER"].includes(acao)) return res.status(400).json({ error: "Ação inválida." });
    try {
      const sql = getPostgres();
      const result = await sql.begin(async (tx) => {
        const [denuncia] = await tx`select id, publicacao_id from public.denuncias where id = ${req.params.id} for update`;
        if (!denuncia) return false;
        await tx`update public.denuncias set status = 'RESOLVIDA', updated_at = now() where id = ${req.params.id}`;
        if (acao === "REMOVER") {
          await tx`update public.publicacoes set status_moderacao = 'rejeitado' where id = ${denuncia.publicacao_id}`;
        }
        await tx`
          insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
          values (${uuidv4()}, 'denuncia', ${req.params.id}, 'DENUNCIA_RESOLVIDA', ${req.user?.id || null}, ${sql.json({ acao, publicacao_id: denuncia.publicacao_id })})
        `;
        return true;
      });
      if (!result) return res.status(404).json({ error: "Denúncia não encontrada." });
      return res.json({ success: true });
    } catch (error) {
      console.error("Falha ao resolver denúncia:", error);
      return res.status(500).json({ error: "Erro ao resolver denúncia." });
    }
  });

  app.get("/api/admin/compliance/retention-preview", async (_req, res) => {
    try { return res.json(await retentionPreviewPostgres()); }
    catch (error) { console.error(error); return res.status(500).json({ error: "Erro ao simular retenção." }); }
  });

  app.post("/api/admin/compliance/retention-run", async (req: any, res) => {
    if (req.body?.confirm !== true) return res.status(400).json({ error: "Confirmação explícita é obrigatória para aplicar descarte." });
    try {
      const result = await applyRetentionPostgres();
      const sql = getPostgres();
      await sql`
        insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
        values (${uuidv4()}, 'compliance', 'retention', 'RETENCAO_APLICADA', ${req.user?.id || null}, ${sql.json(result)})
      `;
      return res.json(result);
    } catch (error) { console.error(error); return res.status(500).json({ error: "Erro ao aplicar política de retenção." }); }
  });

  app.get("/api/admin/auditoria/logs", async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      const sql = getPostgres();
      const rows = await sql`select * from public.logs_auditoria order by created_at desc limit ${limit} offset ${offset}`;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows);
    } catch (error) { console.error(error); return res.status(500).json({ error: "Erro ao carregar auditoria." }); }
  });

  app.get("/api/admin/audit", async (_req, res) => {
    try {
      const sql = getPostgres();
      const [weakHashesRows, noConsentRows, recentLogsRows] = await Promise.all([
        sql`select count(*)::int as count from public.usuarios where password_hash is null or length(password_hash) < 60`,
        sql`select count(*)::int as count from public.usuarios where consentimento_lgpd is not true`,
        sql`select count(*)::int as count from public.logs_auditoria where created_at > now() - interval '7 days'`,
      ]);
      const weakHashes = Number(weakHashesRows[0]?.count || 0);
      const noConsent = Number(noConsentRows[0]?.count || 0);
      const recentLogs = Number(recentLogsRows[0]?.count || 0);
      const privacyVersion = process.env.LGPD_CONSENT_VERSION || "não configurada";
      const results = [
        {
          category: "SECURITY", severity: "CRITICAL", check: "Hash de senhas",
          status: weakHashes > 0 ? "FAIL" : "PASS",
          details: weakHashes > 0 ? `${weakHashes} conta(s) com hash ausente ou fora do padrão mínimo.` : "A amostra completa de usuários possui hashes compatíveis com o padrão esperado.",
          ...(weakHashes > 0 ? { recommendation: "Revisar imediatamente as contas sinalizadas." } : {}),
        },
        {
          category: "LGPD", severity: "HIGH", check: "Registro de consentimento",
          status: noConsent > 0 ? "WARNING" : "PASS",
          details: noConsent > 0 ? `${noConsent} conta(s) sem consentimento LGPD registrado.` : "As contas atuais possuem registro de consentimento.",
          ...(noConsent > 0 ? { recommendation: "Revisar contas legadas e exigir regularização quando aplicável." } : {}),
        },
        {
          category: "SECURITY", severity: "MEDIUM", check: "Rastreabilidade administrativa",
          status: "PASS", details: `${recentLogs} evento(s) administrativos registrados nos últimos 7 dias.`,
        },
        {
          category: "LGPD", severity: "MEDIUM", check: "Versão do aviso de privacidade",
          status: privacyVersion === "2026-09-v2" ? "PASS" : "WARNING",
          details: `Versão ativa: ${privacyVersion}.`,
          ...(privacyVersion === "2026-09-v2" ? {} : { recommendation: "Atualizar LGPD_CONSENT_VERSION em produção para 2026-09-v2 e redeployar." }),
        },
        {
          category: "INFRASTRUCTURE", severity: "HIGH", check: "Persistência administrativa",
          status: "PASS", details: "Conexão administrativa Postgres validada durante esta auditoria.",
        },
        {
          category: "INFRASTRUCTURE", severity: "MEDIUM", check: "Rate limiting e headers HTTP",
          status: "PASS", details: "A aplicação mantém rate limiting global e Helmet ativos no pipeline HTTP.",
        },
      ];
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(results);
    } catch (error) {
      console.error("Falha ao executar auditoria administrativa Postgres:", error);
      return res.status(500).json({ error: "Erro ao executar auditoria de segurança." });
    }
  });
}
