import type { Express } from "express";
import { loadHealthUnits, loadMunicipalWorks, loadNeighborhoods, loadSchools } from "../intelligence/sources.js";
import { getPostgres } from "./postgres.js";

function normalize(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function neighborhoodValue(item: Record<string, unknown>) {
  const preferred = ["BAIRRO", "NM_BAIRRO", "NOME_BAIRRO", "NOMEBAIRRO", "BAIRRO_NOME", "DS_BAIRRO"];
  for (const key of preferred) if (item[key] != null && String(item[key]).trim()) return String(item[key]).trim();
  const dynamic = Object.keys(item).find((key) => normalize(key).includes("BAIRRO"));
  return dynamic && item[dynamic] != null ? String(item[dynamic]).trim() : "";
}

function featureNeighborhood(feature: any) {
  return neighborhoodValue(feature?.attributes || feature || {});
}

function countByNeighborhood(items: any[]) {
  const counts = new Map<string, number>();
  let unclassified = 0;
  for (const item of items) {
    const bairro = featureNeighborhood(item);
    if (!bairro) { unclassified += 1; continue; }
    const key = normalize(bairro);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return { counts, unclassified };
}

async function safeLoad(loader: () => Promise<any>, name: string) {
  try { return { name, available: true, source: await loader(), error: null }; }
  catch (error: any) { return { name, available: false, source: { data: [], quality: { total: 0 } }, error: error?.message || "Falha ao consultar fonte" }; }
}

async function demandAggregates() {
  const sql = getPostgres();
  const [porBairro, porTema] = await Promise.all([
    sql`
      select coalesce(nullif(trim(bairro), ''), 'Não informado') as bairro,
             count(*)::int as total,
             count(*) filter (where prioridade in ('ALTA','CRITICA'))::int as prioritarias,
             count(*) filter (where status = 'CONCLUIDA')::int as concluidas,
             count(distinct categoria)::int as temas
      from public.demandas
      where lower(municipio) = 'manaus'
      group by coalesce(nullif(trim(bairro), ''), 'Não informado')
      order by total desc
    `,
    sql`
      select categoria, count(*)::int as total
      from public.demandas
      where lower(municipio) = 'manaus'
      group by categoria
      order by total desc
    `,
  ]);
  return { porBairro, porTema };
}

export function setupProductionRadarRoutes(app: Express) {
  app.get("/api/radar/manaus/fontes", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      municipio: "Manaus",
      atualizacao: new Date().toISOString(),
      fontes: [
        { key: "geomanaus_bairros", etapa: "E2.1", nome: "GeoManaus / Bairros IMPLURB", status: "integrado" },
        { key: "seminf_obras", etapa: "E2.2", nome: "SEMINF / Obras Prefeitura de Manaus", status: "integrado" },
        { key: "semsa", etapa: "E2.3", nome: "SEMSA / Unidades de Saúde", status: "integrado" },
        { key: "semed", etapa: "E2.3", nome: "SEMED / Escolas Municipais", status: "integrado" },
        { key: "demandas_internas", etapa: "E2.7", nome: "Demandas FISCALIZE", status: "integrado", endpoint: "postgres" },
      ],
    });
  });

  app.get("/api/radar/manaus/mapa/bairros", async (_req, res) => {
    const bairros = await safeLoad(loadNeighborhoods, "bairros");
    if (!bairros.available || !Array.isArray(bairros.source?.data) || !bairros.source.data.length) {
      return res.status(502).json({ error: "Camada geoespacial de bairros temporariamente indisponível.", detail: bairros.error });
    }
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.json({
      municipio: "Manaus",
      total: Number(bairros.source?.quality?.total ?? bairros.source.data.length),
      retornados: bairros.source.data.length,
      truncated: Boolean(bairros.source?.quality?.truncated),
      geometryType: "esriGeometryPolygon",
      spatialReference: { wkid: 4326 },
      features: bairros.source.data,
    });
  });

  app.get("/api/radar/manaus/indicadores-externos", async (_req, res) => {
    const [bairros, obras, saude, escolas] = await Promise.all([
      safeLoad(loadNeighborhoods, "GeoManaus / Bairros"),
      safeLoad(loadMunicipalWorks, "SEMINF / Obras"),
      safeLoad(loadHealthUnits, "SEMSA / Saúde"),
      safeLoad(loadSchools, "SEMED / Escolas"),
    ]);
    const itens = [bairros, obras, saude, escolas].map((item) => ({
      key: normalize(item.name).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      nome: item.name,
      configurado: true,
      disponibilidade: item.available ? "disponivel" : "indisponivel",
      registrosObservados: Array.isArray(item.source?.data) ? item.source.data.length : 0,
      tipo: "colecao",
      erro: item.error,
    }));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ municipio: "Manaus", atualizadoEm: new Date().toISOString(), indicadores: itens });
  });

  app.get("/api/radar/manaus/territorios", async (req, res) => {
    const filtroBairro = typeof req.query.bairro === "string" ? normalize(req.query.bairro).slice(0, 120) : "";
    const [obras, saude, escolas, demandas] = await Promise.all([
      safeLoad(loadMunicipalWorks, "obras"),
      safeLoad(loadHealthUnits, "saude"),
      safeLoad(loadSchools, "escolas"),
      demandAggregates(),
    ]);

    const obraCounts = countByNeighborhood(obras.source?.data || []);
    const saudeCounts = countByNeighborhood(saude.source?.data || []);
    const escolaCounts = countByNeighborhood(escolas.source?.data || []);
    const territorios = (demandas.porBairro as any[]).map((item) => {
      const key = normalize(item.bairro);
      const total = Number(item.total || 0);
      const concluidas = Number(item.concluidas || 0);
      return {
        bairro: item.bairro,
        demandas: total,
        prioritarias: Number(item.prioritarias || 0),
        concluidas,
        temas: Number(item.temas || 0),
        taxaConclusao: total ? Number(((concluidas / total) * 100).toFixed(1)) : 0,
        obras: obraCounts.counts.get(key) || 0,
        unidadesSaude: saudeCounts.counts.get(key) || 0,
        escolas: escolaCounts.counts.get(key) || 0,
      };
    }).filter((item) => !filtroBairro || normalize(item.bairro) === filtroBairro);

    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      municipio: "Manaus", geradoEm: new Date().toISOString(), territorios,
      classificacaoFontes: { obrasSemBairro: obraCounts.unclassified, saudeSemBairro: saudeCounts.unclassified, escolasSemBairro: escolaCounts.unclassified },
      disponibilidade: [obras, saude, escolas].map(({ name, available, error }) => ({ name, available, error })),
    });
  });

  app.get("/api/radar/manaus/resumo", async (_req, res) => {
    const [bairros, obras, saude, escolas, demandas] = await Promise.all([
      safeLoad(loadNeighborhoods, "bairros"),
      safeLoad(loadMunicipalWorks, "obras"),
      safeLoad(loadHealthUnits, "saude"),
      safeLoad(loadSchools, "escolas"),
      demandAggregates(),
    ]);
    const totalOf = (item: any) => Number(item.source?.quality?.total ?? (Array.isArray(item.source?.data) ? item.source.data.length : 0));
    const demandasTotal = (demandas.porBairro as any[]).reduce((sum, item) => sum + Number(item.total || 0), 0);
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      municipio: "Manaus",
      geradoEm: new Date().toISOString(),
      indicadores: { bairros: totalOf(bairros), obras: totalOf(obras), unidadesSaude: totalOf(saude), escolasMunicipais: totalOf(escolas), demandasRegistradas: demandasTotal },
      demandasPorBairro: (demandas.porBairro as any[]).slice(0, 20),
      demandasPorTema: (demandas.porTema as any[]).slice(0, 20),
      disponibilidade: [bairros, obras, saude, escolas].map(({ name, available, error }) => ({ name, available, error })),
      fontesExternas: [],
    });
  });
}
