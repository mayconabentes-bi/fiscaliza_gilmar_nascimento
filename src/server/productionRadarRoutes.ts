import type { Express } from "express";
import { loadHealthUnits, loadMunicipalWorks, loadNeighborhoods, loadSchools } from "../intelligence/sources.js";
import { getHealthyPostgres } from "./postgres.js";
import { buildAgeIntelligenceAggregate } from "./ageIntelligence.js";

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

function qualityDimension(key: string, item: { available: boolean; source?: any }) {
  const rows = item.available && Array.isArray(item.source?.data) ? item.source.data : [];
  const received = rows.length;
  const classified = rows.filter((row: any) => Boolean(featureNeighborhood(row))).length;
  return {
    key,
    received,
    classified,
    unclassified: Math.max(0, received - classified),
    coverage: received ? classified / received : 0,
  };
}

async function safeLoad(loader: () => Promise<any>, name: string, timeoutMs = 4_500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const source = await Promise.race([
      loader(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout ao consultar ${name}`)), timeoutMs);
      }),
    ]);
    return { name, available: true, source, error: null };
  } catch (error: any) {
    return { name, available: false, source: { data: [], quality: { total: 0 } }, error: error?.message || "Falha ao consultar fonte" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ageIntelligenceAggregate() {
  const sql = await getHealthyPostgres();
  const rows = await sql`
    select coalesce(faixa_etaria, 'NAO_INFORMADA') as faixa_etaria,
           count(*)::int as total
    from public.demandas
    where lower(municipio) = 'manaus'
    group by coalesce(faixa_etaria, 'NAO_INFORMADA')
  `;

  const normalizedRows = Array.from(rows, (row: any) => ({
    faixa_etaria: String(row.faixa_etaria),
    total: Number(row.total || 0),
  }));

  return buildAgeIntelligenceAggregate(
    normalizedRows,
    process.env.CIVIC_AGGREGATE_MIN_GROUP_SIZE,
  );
}

async function demandAggregates() {
  const sql = await getHealthyPostgres();
  const [porBairro, porTema, porTipo] = await Promise.all([
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
    sql`
      select categoria, tipo_problema, count(*)::int as total
      from public.demandas
      where lower(municipio) = 'manaus'
      group by categoria, tipo_problema
      order by total desc, categoria asc, tipo_problema asc
    `,
  ]);
  return { porBairro, porTema, porTipo };
}

async function fastSummaryAggregate() {
  const sql = await getHealthyPostgres();
  const [row] = await sql`
    select
      coalesce((
        select json_agg(x order by x.total desc)
        from (
          select coalesce(nullif(trim(bairro), ''), 'Não informado') as bairro,
                 count(*)::int as total,
                 count(*) filter (where prioridade in ('ALTA','CRITICA'))::int as prioritarias,
                 count(*) filter (where status = 'CONCLUIDA')::int as concluidas,
                 count(distinct categoria)::int as temas
          from public.demandas
          where lower(municipio) = 'manaus'
          group by coalesce(nullif(trim(bairro), ''), 'Não informado')
        ) x
      ), '[]'::json) as por_bairro,
      coalesce((
        select json_agg(x order by x.total desc)
        from (
          select categoria, count(*)::int as total
          from public.demandas
          where lower(municipio) = 'manaus'
          group by categoria
        ) x
      ), '[]'::json) as por_tema,
      coalesce((
        select json_agg(x order by x.total desc, x.categoria asc, x.tipo_problema asc)
        from (
          select categoria, tipo_problema, count(*)::int as total
          from public.demandas
          where lower(municipio) = 'manaus'
          group by categoria, tipo_problema
        ) x
      ), '[]'::json) as por_tipo,
      coalesce((
        select json_agg(x order by x.faixa_etaria asc)
        from (
          select coalesce(faixa_etaria, 'NAO_INFORMADA') as faixa_etaria,
                 count(*)::int as total
          from public.demandas
          where lower(municipio) = 'manaus'
          group by coalesce(faixa_etaria, 'NAO_INFORMADA')
        ) x
      ), '[]'::json) as idade
  `;

  const porBairro = Array.isArray(row?.por_bairro) ? row.por_bairro : [];
  const porTema = Array.isArray(row?.por_tema) ? row.por_tema : [];
  const porTipo = Array.isArray(row?.por_tipo) ? row.por_tipo : [];
  const idadeRows = Array.isArray(row?.idade) ? row.idade : [];

  const demografiaEtaria = buildAgeIntelligenceAggregate(
    idadeRows.map((item: any) => ({
      faixa_etaria: String(item.faixa_etaria),
      total: Number(item.total || 0),
    })),
    process.env.CIVIC_AGGREGATE_MIN_GROUP_SIZE,
  );

  return { porBairro, porTema, porTipo, demografiaEtaria };
}

export function setupProductionRadarRoutes(app: Express) {
  app.get("/api/radar/manaus/fontes", (_req, res) => {
    res.setHeader("Cache-Control", "private, max-age=60");
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
      return res.status(200).json({
        municipio: "Manaus",
        total: 0,
        retornados: 0,
        truncated: false,
        geometryType: "esriGeometryPolygon",
        spatialReference: { wkid: 4326 },
        features: [],
        degraded: true,
        error: bairros.error,
      });
    }
    res.setHeader("Cache-Control", "private, max-age=300");
    const features = bairros.source.data.map((feature: any) => ({
      ...feature,
      bairro: featureNeighborhood(feature),
    }));
    return res.json({
      municipio: "Manaus",
      total: Number(bairros.source?.quality?.total ?? features.length),
      retornados: features.length,
      classificados: features.filter((feature: any) => Boolean(feature.bairro)).length,
      truncated: Boolean(bairros.source?.quality?.truncated),
      geometryType: "esriGeometryPolygon",
      spatialReference: { wkid: 4326 },
      features,
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
      registrosObservados: item.available && Array.isArray(item.source?.data) ? item.source.data.length : null,
      tipo: "colecao",
      erro: item.error,
    }));
    const quality = {
      dimensions: [
        qualityDimension("works", obras),
        qualityDimension("health", saude),
        qualityDimension("schools", escolas),
      ],
      methodology: "Cobertura territorial = registros da fonte com bairro reconhecível / registros recebidos da fonte. Registros sem bairro não são descartados do estado da fonte; apenas ficam fora dos indicadores territoriais.",
    };
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ municipio: "Manaus", atualizadoEm: new Date().toISOString(), indicadores: itens, quality });
  });

  app.get("/api/radar/manaus/territorios", async (req, res) => {
    const filtroBairro = typeof req.query.bairro === "string" ? normalize(req.query.bairro).slice(0, 120) : "";
    const [bairros, obras, saude, escolas, demandas] = await Promise.all([
      safeLoad(loadNeighborhoods, "bairros"),
      safeLoad(loadMunicipalWorks, "obras"),
      safeLoad(loadHealthUnits, "saude"),
      safeLoad(loadSchools, "escolas"),
      demandAggregates(),
    ]);

    const obraCounts = countByNeighborhood(obras.source?.data || []);
    const saudeCounts = countByNeighborhood(saude.source?.data || []);
    const escolaCounts = countByNeighborhood(escolas.source?.data || []);

    const bairrosOficiais = Array.from(new Map(
      (Array.isArray(bairros.source?.data) ? bairros.source.data : [])
        .map((feature: any) => featureNeighborhood(feature))
        .filter(Boolean)
        .map((bairro: string) => [normalize(bairro), bairro] as const)
    ).values());

    const demandasPorBairro = new Map(
      (demandas.porBairro as any[])
        .filter((item) => normalize(item.bairro) !== normalize("Não informado"))
        .map((item) => [normalize(item.bairro), item] as const)
    );

    const baseBairros = bairrosOficiais.length
      ? bairrosOficiais
      : Array.from(demandasPorBairro.values(), (item: any) => String(item.bairro));

    const baseKeys = new Set(baseBairros.map((bairro) => normalize(bairro)));
    const demandasSemBairroOficial = (demandas.porBairro as any[]).reduce((sum, item) => {
      const key = normalize(item.bairro);
      if (!key || key === normalize("Não informado") || baseKeys.has(key)) return sum;
      return sum + Number(item.total || 0);
    }, 0);

    const territorios = baseBairros.map((bairro) => {
      const key = normalize(bairro);
      const demanda = demandasPorBairro.get(key) as any | undefined;
      const total = Number(demanda?.total || 0);
      const concluidas = Number(demanda?.concluidas || 0);
      return {
        bairro,
        demandas: total,
        prioritarias: Number(demanda?.prioritarias || 0),
        concluidas,
        temas: Number(demanda?.temas || 0),
        taxaConclusao: total ? Number(((concluidas / total) * 100).toFixed(1)) : 0,
        obras: obraCounts.counts.get(key) || 0,
        unidadesSaude: saudeCounts.counts.get(key) || 0,
        escolas: escolaCounts.counts.get(key) || 0,
      };
    }).filter((item) => !filtroBairro || normalize(item.bairro) === filtroBairro);

    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      municipio: "Manaus",
      geradoEm: new Date().toISOString(),
      baseTerritorial: bairrosOficiais.length ? "geomanaus" : "demandas_fallback",
      totalBairrosBase: baseBairros.length,
      territorios,
      classificacaoFontes: {
        bairrosSemNome: bairros.available ? Math.max(0, Number(bairros.source?.data?.length || 0) - bairrosOficiais.length) : 0,
        demandasSemBairroOficial,
        obrasSemBairro: obraCounts.unclassified,
        saudeSemBairro: saudeCounts.unclassified,
        escolasSemBairro: escolaCounts.unclassified,
      },
      disponibilidade: [bairros, obras, saude, escolas].map(({ name, available, error }) => ({ name, available, error })),
    });
  });

  // O resumo é o fast path do Radar. Ele depende apenas do Postgres interno e
  // nunca espera APIs externas. As fontes públicas enriquecem a tela em chamadas
  // progressivas separadas.
  app.get("/api/radar/manaus/resumo", async (_req, res) => {
    try {
      const demandas = await fastSummaryAggregate();
      const demografiaEtaria = demandas.demografiaEtaria;
      const demandasTotal = (demandas.porBairro as any[]).reduce((sum, item) => sum + Number(item.total || 0), 0);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json({
        municipio: "Manaus",
        geradoEm: new Date().toISOString(),
        indicadores: {
          bairros: null,
          obras: null,
          unidadesSaude: null,
          escolasMunicipais: null,
          demandasRegistradas: demandasTotal,
        },
        demandasPorBairro: (demandas.porBairro as any[]).slice(0, 20),
        demandasPorTema: (demandas.porTema as any[]).slice(0, 20),
        demandasPorTipo: (demandas.porTipo as any[]).slice(0, 30),
        demografiaEtaria,
        disponibilidade: [],
        fontesExternas: [],
      });
    } catch (error) {
      console.error("Falha ao carregar resumo territorial:", error);
      return res.status(500).json({ error: "Não foi possível carregar o resumo territorial." });
    }
  });
}
