import type { Express } from "express";
import { getHealthyPostgres } from "./postgres.js";
import { ensureDemandEvidenceSchema } from "./demandEvidencePostgres.js";
import { ADMIN_DEMAND_LIST_LIMIT, normalizeAdminDemandListFilters } from "./adminDemandListIntegrity.js";
import { setorDoEscopo } from "./adminAccessPolicy.js";

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
  app.get("/api/admin/demandas", async (req: any, res) => {
    const startedAt = Date.now();
    try {
      // null = acesso total (ADMIN); uuid = só as categorias do setor do usuário.
      const setorId = setorDoEscopo(req.user?.escopo);
      const normalized = normalizeAdminDemandListFilters(req.query as Record<string, unknown>);
      if (!normalized.ok) return res.status(400).json({ error: normalized.error });
      const filters = normalized.filters;
      const limit = ADMIN_DEMAND_LIST_LIMIT;

      const sql = await getHealthyPostgres();
      await ensureDemandEvidenceSchema();
      const [rows, countRows] = await Promise.all([
        sql`
          select d.id, d.protocolo, d.municipio, d.bairro, d.categoria, d.tipo_problema, d.descricao,
                 d.prioridade, d.status, d.evidencia_moderacao_status,
                 d.evidencia_upload_status, d.evidencia_upload_solicitadas, d.evidencia_upload_anexadas, d.evidencia_upload_falhas,
                 ((select count(*) from public.demanda_evidencias e
                    where e.demanda_id = d.id
                      and e.storage_path is not null
                      and e.moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA')) > 0
                   or (d.evidencia_foto_path is not null
                       and d.evidencia_moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA'))) as tem_evidencia_foto,
                 greatest(
                   (select count(*)::int from public.demanda_evidencias e
                    where e.demanda_id = d.id
                      and e.storage_path is not null
                      and e.moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA')),
                   case
                     when d.evidencia_foto_path is not null
                      and d.evidencia_moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA')
                     then 1 else 0
                   end
                 ) as evidencia_total,
                 d.created_at, d.updated_at::text as updated_at
          from public.demandas d
          where (${filters.status} = '' or d.status = ${filters.status})
            and (${filters.prioridade} = '' or d.prioridade = ${filters.prioridade})
            and (${filters.protocolo} = '' or d.protocolo ilike ${`%${filters.protocolo}%`})
            and (${filters.municipio} = '' or d.municipio ilike ${`%${filters.municipio}%`})
            and (${filters.bairro} = '' or coalesce(d.bairro, '') ilike ${`%${filters.bairro}%`})
            and (${filters.categoria} = '' or d.categoria = ${filters.categoria})
            and (${filters.tipoProblema} = '' or d.tipo_problema = ${filters.tipoProblema})
            and (${setorId}::uuid is null or d.categoria in (select sc.categoria from private.setor_categorias sc where sc.setor_id = ${setorId}::uuid))
          order by d.created_at desc, d.id desc
          limit ${limit}
        `,
        sql`
          select count(*)::int as total
          from public.demandas d
          where (${filters.status} = '' or d.status = ${filters.status})
            and (${filters.prioridade} = '' or d.prioridade = ${filters.prioridade})
            and (${filters.protocolo} = '' or d.protocolo ilike ${`%${filters.protocolo}%`})
            and (${filters.municipio} = '' or d.municipio ilike ${`%${filters.municipio}%`})
            and (${filters.bairro} = '' or coalesce(d.bairro, '') ilike ${`%${filters.bairro}%`})
            and (${filters.categoria} = '' or d.categoria = ${filters.categoria})
            and (${filters.tipoProblema} = '' or d.tipo_problema = ${filters.tipoProblema})
            and (${setorId}::uuid is null or d.categoria in (select sc.categoria from private.setor_categorias sc where sc.setor_id = ${setorId}::uuid))
        `,
      ]);

      const total = Number(countRows[0]?.total || 0);
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Server-Timing", `db;dur=${Date.now() - startedAt}`);
      return res.json({
        items: rows,
        total,
        limit,
        truncated: total > rows.length,
      });
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
