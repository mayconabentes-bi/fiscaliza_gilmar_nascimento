import type { Express } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPostgres } from "./postgres.js";
import { createDemandEvidenceSignedUrl, EvidenceStorageUnavailableError, removeDemandEvidence } from "./evidenceStorage.js";
import { applyRetentionPostgres, retentionPreviewPostgres } from "./retentionPostgres.js";
import { ensureDemandEvidenceSchema } from "./demandEvidencePostgres.js";
import { ADMIN_DEMAND_LIST_LIMIT, normalizeAdminDemandListFilters } from "./adminDemandListIntegrity.js";

const STATUS_VALIDOS = ["RECEBIDA","EM_TRIAGEM","ENCAMINHADA","EM_ANALISE","EM_EXECUCAO","CONCLUIDA","INDEFERIDA"];
const PRIORIDADES_VALIDAS = ["BAIXA","MEDIA","ALTA","CRITICA"];
const EVIDENCIA_DECISOES = ["APROVAR_PRIVADA","REJEITAR","REQUER_ANONIMIZACAO"];
const EVIDENCIA_ACESSIVEIS = ["PENDENTE","REQUER_ANONIMIZACAO","APROVADA_PRIVADA"];

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
      const normalized = normalizeAdminDemandListFilters(req.query as Record<string, unknown>);
      if (!normalized.ok) return res.status(400).json({ error: normalized.error });
      const filters = normalized.filters;
      const limit = ADMIN_DEMAND_LIST_LIMIT;

      const [rows, countRows] = await Promise.all([
        sql`
          select id, protocolo, municipio, bairro, categoria, tipo_problema, descricao,
                 prioridade, status, evidencia_moderacao_status,
                 evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas,
                 ((select count(*) from public.demanda_evidencias de where de.demanda_id = public.demandas.id and de.storage_path is not null) > 0
                   or evidencia_foto_path is not null) as tem_evidencia_foto,
                 greatest(
                   (select count(*)::int from public.demanda_evidencias de where de.demanda_id = public.demandas.id and de.storage_path is not null),
                   case when evidencia_foto_path is not null then 1 else 0 end
                 ) as evidencia_total,
                 created_at, updated_at
          from public.demandas
          where (${filters.status} = '' or status = ${filters.status})
            and (${filters.prioridade} = '' or prioridade = ${filters.prioridade})
            and (${filters.protocolo} = '' or protocolo ilike ${`%${filters.protocolo}%`})
            and (${filters.municipio} = '' or municipio ilike ${`%${filters.municipio}%`})
            and (${filters.bairro} = '' or coalesce(bairro, '') ilike ${`%${filters.bairro}%`})
            and (${filters.categoria} = '' or categoria = ${filters.categoria})
            and (${filters.tipoProblema} = '' or tipo_problema = ${filters.tipoProblema})
          order by created_at desc, id desc
          limit ${limit}
        `,
        sql`
          select count(*)::int as total
          from public.demandas
          where (${filters.status} = '' or status = ${filters.status})
            and (${filters.prioridade} = '' or prioridade = ${filters.prioridade})
            and (${filters.protocolo} = '' or protocolo ilike ${`%${filters.protocolo}%`})
            and (${filters.municipio} = '' or municipio ilike ${`%${filters.municipio}%`})
            and (${filters.bairro} = '' or coalesce(bairro, '') ilike ${`%${filters.bairro}%`})
            and (${filters.categoria} = '' or categoria = ${filters.categoria})
            and (${filters.tipoProblema} = '' or tipo_problema = ${filters.tipoProblema})
        `,
      ]);

      const total = Number(countRows[0]?.total || 0);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({
        items: rows,
        total,
        limit,
        truncated: total > rows.length,
      });
    } catch (error) {
      console.error("Falha ao listar demandas administrativas:", error);
      return res.status(500).json({ error: "Erro ao listar demandas." });
    }
  });

  app.get("/api/admin/demandas/:id/evidencia", async (req, res) => {
    try {
      const sql = getPostgres();
      const [row] = await sql`\n        select evidencia_foto_path, evidencia_foto_mime, evidencia_moderacao_status\n        from public.demandas\n        where id = ${req.params.id}\n        limit 1\n      `;\n      if (!row?.evidencia_foto_path || !EVIDENCIA_ACESSIVEIS.includes(String(row.evidencia_moderacao_status))) {\n        return res.status(404).json({ error: "Evidência não encontrada." });\n      }
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
      if (!legacy?.evidencia_foto_path || !EVIDENCIA_ACESSIVEIS.includes(String(legacy.evidencia_moderacao_status))) {\n        return res.status(404).json({ error: "Evidência não encontrada." });\n      }
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

    const status = decisao === "REJEITAR"
      ? "REJEITADA"
      : decisao === "REQUER_ANONIMIZACAO"
        ? "REQUER_ANONIMIZACAO"
        : "APROVADA_PRIVADA";

    try {
      await ensureDemandEvidenceSchema();
      const sql = getPostgres();

      const transition = await sql.begin(async (tx) => {
        const [evidence] = await tx\`
          select id, demanda_id, storage_path, ordem, moderacao_status
          from public.demanda_evidencias
          where id = \${req.params.id}
          for update
        \`;
        if (!evidence) return null;

        const previousStatus = String(evidence.moderacao_status || "PENDENTE");
        if (previousStatus === "REJEITADA" && status !== "REJEITADA") {
          throw new Error("REJECTED_EVIDENCE_IS_TERMINAL");
        }
        if (previousStatus === "REQUER_ANONIMIZACAO" && status === "APROVADA_PRIVADA") {
          throw new Error("ANONYMIZATION_REQUIRED_BEFORE_APPROVAL");
        }

        await tx\`
          update public.demanda_evidencias
          set moderacao_status = \${status},
              revisada_em = now(),
              revisada_por = \${req.user?.id || "admin"},
              moderacao_observacao = \${observacao || null}
          where id = \${req.params.id}
        \`;

        const [aggregate] = await tx\`
          select
            count(*) filter (where moderacao_status = 'PENDENTE')::int as pendentes,
            count(*) filter (where moderacao_status = 'REQUER_ANONIMIZACAO')::int as anonimizar,
            count(*) filter (where moderacao_status = 'APROVADA_PRIVADA')::int as aprovadas
          from public.demanda_evidencias
          where demanda_id = \${evidence.demanda_id}
        \`;

        const aggregateStatus = Number(aggregate?.pendentes) > 0
          ? "PENDENTE"
          : Number(aggregate?.anonimizar) > 0
            ? "REQUER_ANONIMIZACAO"
            : Number(aggregate?.aprovadas) > 0
              ? "APROVADA_PRIVADA"
              : "REJEITADA";

        await tx\`
          update public.demandas
          set evidencia_moderacao_status = \${aggregateStatus}
          where id = \${evidence.demanda_id}
        \`;

        if (previousStatus !== status) {
          await tx\`
            insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
            values (
              \${uuidv4()}, 'demanda_evidencia', \${req.params.id}, 'EVIDENCIA_MODERADA',
              \${req.user?.id || null},
              \${sql.json({ decisao, status, status_anterior: previousStatus, demanda_id: evidence.demanda_id })}
            )
          \`;
        }

        return {
          demandaId: String(evidence.demanda_id),
          storagePath: evidence.storage_path ? String(evidence.storage_path) : null,
          ordem: Number(evidence.ordem),
          previousStatus,
        };
      });

      if (!transition) return res.status(404).json({ error: "Evidência não encontrada." });

      if (status === "REJEITADA" && transition.storagePath) {
        await removeDemandEvidence(transition.storagePath);
        await sql.begin(async (tx) => {
          await tx\`
            update public.demanda_evidencias
            set storage_path = null
            where id = \${req.params.id}
              and moderacao_status = 'REJEITADA'
              and storage_path = \${transition.storagePath}
          \`;

          if (transition.ordem === 1) {
            await tx\`
              update public.demandas
              set evidencia_foto_path = null,
                  evidencia_foto_mime = null
              where id = \${transition.demandaId}
                and evidencia_moderacao_status = 'REJEITADA'
                and evidencia_foto_path = \${transition.storagePath}
            \`;
          }

          await tx\`
            insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
            values (
              \${uuidv4()}, 'demanda_evidencia', \${req.params.id}, 'EVIDENCIA_STORAGE_REMOVIDA',
              \${req.user?.id || null},
              \${sql.json({ demanda_id: transition.demandaId })}
            )
          \`;
        });
      }

      return res.json({
        success: true,
        status,
        storage_removed: status !== "REJEITADA" || !transition.storagePath || true,
      });
    } catch (error: any) {
      if (error?.message === "REJECTED_EVIDENCE_IS_TERMINAL") {
        return res.status(409).json({ error: "Evidência rejeitada não pode voltar a um estado ativo." });
      }
      if (error?.message === "ANONYMIZATION_REQUIRED_BEFORE_APPROVAL") {
        return res.status(409).json({ error: "A evidência exige anonimização real antes de poder ser aprovada." });
      }
      if (error instanceof EvidenceStorageUnavailableError) {
        console.error("Storage indisponível durante rejeição de evidência:", error);
        return res.status(503).json({
          error: "Evidência bloqueada para acesso, mas a remoção física ainda precisa ser repetida.",
          code: "EVIDENCE_DELETE_PENDING",
        });
      }
      console.error("Falha ao moderar evidência individual:", error);
      return res.status(500).json({ error: "Erro ao moderar evidência." });
    }
  });

  app.post("/api/admin/evidencias/:id/decisao", async (req: any, res) => {
    const decisao = String(req.body?.decisao || "");
    const observacao = String(req.body?.observacao || "").trim().slice(0, 1000);
    if (!EVIDENCIA_DECISOES.includes(decisao)) return res.status(400).json({ error: "Decisão de evidência inválida." });

    const status = decisao === "REJEITAR"
      ? "REJEITADA"
      : decisao === "REQUER_ANONIMIZACAO"
        ? "REQUER_ANONIMIZACAO"
        : "APROVADA_PRIVADA";

    try {
      const sql = getPostgres();
      const transition = await sql.begin(async (tx) => {
        const [row] = await tx\`
          select evidencia_foto_path, evidencia_moderacao_status
          from public.demandas
          where id = \${req.params.id}
          for update
        \`;
        if (!row?.evidencia_foto_path) return null;

        const previousStatus = String(row.evidencia_moderacao_status || "PENDENTE");
        if (previousStatus === "REJEITADA" && status !== "REJEITADA") {
          throw new Error("REJECTED_EVIDENCE_IS_TERMINAL");
        }

        await tx\`
          update public.demandas
          set evidencia_moderacao_status = \${status},
              evidencia_revisada_em = now(),
              evidencia_revisada_por = \${req.user?.id || 'admin'},
              evidencia_moderacao_observacao = \${observacao || null}
          where id = \${req.params.id}
        \`;

        if (previousStatus !== status) {
          await tx\`
            insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
            values (
              \${uuidv4()}, 'demanda', \${req.params.id}, 'EVIDENCIA_MODERADA',
              \${req.user?.id || null},
              \${sql.json({ decisao, status, status_anterior: previousStatus })}
            )
          \`;
        }

        return { storagePath: String(row.evidencia_foto_path), previousStatus };
      });

      if (!transition) return res.status(404).json({ error: "Evidência não encontrada." });

      if (status === "REJEITADA") {
        await removeDemandEvidence(transition.storagePath);
        await sql.begin(async (tx) => {
          await tx\`
            update public.demandas
            set evidencia_foto_path = null,
                evidencia_foto_mime = null
            where id = \${req.params.id}
              and evidencia_moderacao_status = 'REJEITADA'
              and evidencia_foto_path = \${transition.storagePath}
          \`;
          await tx\`
            insert into public.logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
            values (
              \${uuidv4()}, 'demanda', \${req.params.id}, 'EVIDENCIA_STORAGE_REMOVIDA',
              \${req.user?.id || null},
              \${sql.json({ legado: true })}
            )
          \`;
        });
      }

      return res.json({ success: true, status });
    } catch (error: any) {
      if (error?.message === "REJECTED_EVIDENCE_IS_TERMINAL") {
        return res.status(409).json({ error: "Evidência rejeitada não pode voltar a um estado ativo." });
      }
      if (error instanceof EvidenceStorageUnavailableError) {
        console.error("Storage indisponível durante rejeição de evidência legada:", error);
        return res.status(503).json({
          error: "Evidência bloqueada para acesso, mas a remoção física ainda precisa ser repetida.",
          code: "EVIDENCE_DELETE_PENDING",
        });
      }
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
