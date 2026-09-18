import type { Express } from "express";
import { getHealthyPostgres } from "./postgres.js";
import { ensureDemandEvidenceSchema } from "./demandEvidencePostgres.js";

const STATUS_VALIDOS = ["RECEBIDA", "EM_TRIAGEM", "ENCAMINHADA", "EM_ANALISE", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"];

export function setupProductionFastAdminRoutes(app: Express) {
  /**
   * Fast path do Painel: uma única ida ao Postgres devolve todos os agregados
   * necessários para a primeira dobra da interface.
   */
  app.get("/api/demandas/metricas", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const sql = await getHealthyPostgres();
      const [row] = await sql`
        select
          json_build_object(
            'total', count(*)::int,
            'concluidas', count(*) filter (where status = 'CONCLUIDA')::int,
            'pendentes', count(*) filter (where status <> 'CONCLUIDA')::int,
            'criticas', count(*) filter (where prioridade = 'CRITICA')::int
          ) as resumo,
          (
            select coalesce(json_agg(item order by item.total desc, item.status asc), '[]'::json)
            from (
              select status, count(*)::int as total
              from public.demandas
              group by status
            ) item
          ) as "porStatus",
          (
            select coalesce(json_agg(item order by item.total desc, item.municipio asc), '[]'::json)
            from (
              select municipio, count(*)::int as total
              from public.demandas
              group by municipio
              order by total desc, municipio asc
              limit 50
            ) item
          ) as "porMunicipio",
          (
            select coalesce(json_agg(item order by item.total desc, item.categoria asc), '[]'::json)
            from (
              select categoria, count(*)::int as total
              from public.demandas
              group by categoria
              order by total desc, categoria asc
              limit 50
            ) item
          ) as "porCategoria"
        from public.demandas
      `;

      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Server-Timing", `db;dur=${Date.now() - startedAt}`);
      return res.json({
        resumo: row?.resumo || { total: 0, concluidas: 0, pendentes: 0, criticas: 0 },
        porStatus: row?.porStatus || [],
        porMunicipio: row?.porMunicipio || [],
        porCategoria: row?.porCategoria || [],
      });
    } catch (error) {
      console.error("Falha no fast path de métricas:", error);
      return res.status(500).json({ error: "Erro ao carregar métricas administrativas." });
    }
  });

  /** Fast path da Triagem: payload inicial limitado e filtrável. */
  app.get("/api/admin/demandas", async (req, res) => {
    const startedAt = Date.now();
    try {
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const municipio = typeof req.query.municipio === "string" ? req.query.municipio.trim().slice(0, 120) : "";
      const categoria = typeof req.query.categoria === "string" ? req.query.categoria.trim().slice(0, 120) : "";
      const requestedLimit = Number(req.query.limit || 100);
      const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(20, Math.trunc(requestedLimit))) : 100;

      if (status && !STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }

      const sql = await getHealthyPostgres();
      await ensureDemandEvidenceSchema();
      const rows = await sql`
        select d.id, d.protocolo, d.nome_solicitante, d.contato, d.municipio, d.bairro, d.categoria, d.descricao,
               d.prioridade, d.status, d.observacao_interna, d.usuario_id, d.evidencia_moderacao_status,
               ((select count(*) from public.demanda_evidencias e where e.demanda_id = d.id and e.storage_path is not null) > 0
                 or d.evidencia_foto_path is not null) as tem_evidencia_foto,
               greatest(
                 (select count(*)::int from public.demanda_evidencias e where e.demanda_id = d.id and e.storage_path is not null),
                 case when d.evidencia_foto_path is not null then 1 else 0 end
               ) as evidencia_total,
               d.created_at, d.updated_at
        from public.demandas d
        where (${status} = '' or d.status = ${status})
          and (${municipio} = '' or d.municipio ilike ${`%${municipio}%`})
          and (${categoria} = '' or d.categoria ilike ${`%${categoria}%`})
        order by d.created_at desc
        limit ${limit}
      `;

      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Server-Timing", `db;dur=${Date.now() - startedAt}`);
      return res.json(rows);
    } catch (error) {
      console.error("Falha no fast path da triagem:", error);
      return res.status(500).json({ error: "Erro ao listar demandas." });
    }
  });

  /** Diagnóstico autenticado de produção para QA operacional. */
  app.get("/api/admin/qa/health", async (_req, res) => {
    const startedAt = Date.now();
    try {
      const sql = await getHealthyPostgres();
      const [row] = await sql`
        select
          (select count(*)::int from public.demandas) as demandas,
          (select count(*)::int from public.usuarios) as usuarios,
          now() as database_time
      `;
      const dbLatencyMs = Date.now() - startedAt;
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({ status: "ok", database: "postgres", dbLatencyMs, ...row });
    } catch (error) {
      console.error("Falha no diagnóstico administrativo:", error);
      return res.status(503).json({ status: "degraded", database: "postgres", error: "Falha de conexão com o banco." });
    }
  });
}
