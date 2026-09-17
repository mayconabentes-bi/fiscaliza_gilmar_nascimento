import { Express } from "express";
import { getDb } from "./db.js";

const ARCGIS_CCC = "https://pmm.manaus.am.gov.br/arcgis/rest/services/CCC/CAMADAS_CCC_2025/FeatureServer";
const ARCGIS_OBRAS = "https://pmm.manaus.am.gov.br/arcgis/rest/services/PORTAL_TRANSPARENCIA/SEMINF_OBRAS_PORTAL_CIDADAO_SRGS/MapServer";
const CMM_SAPL_BASE = process.env.CMM_SAPL_API_BASE || "https://sapl.cmm.am.gov.br/api";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const cache = new Map<string, { expiresAt: number; data: unknown }>();

function getCached(url: string) {
  const cached = cache.get(url);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(url);
    return undefined;
  }
  cache.delete(url);
  cache.set(url, cached);
  return cached.data;
}

function setCached(url: string, data: unknown) {
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

async function fetchJson(url: string, timeoutMs = 12000) {
  const cached = getCached(url);
  if (cached !== undefined) return cached;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "AmazonasParticipativa/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setCached(url, data);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function arcgisQuery(service: string, layer: number, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
    ...extra,
  });
  return `${service}/${layer}/query?${params.toString()}`;
}

async function arcgisAll(service: string, layer: number, options: { where?: string; geometry?: boolean; maxRecords?: number } = {}) {
  const metadata: any = await fetchJson(`${service}/${layer}?f=json`);
  const objectIdField = metadata?.objectIdField || metadata?.objectIdFieldName || "OBJECTID";
  const pageSize = Math.min(Number(metadata?.maxRecordCount || 1000), 1000);
  const maxRecords = Math.max(pageSize, Math.min(options.maxRecords || 20000, 20000));
  const countData: any = await fetchJson(arcgisQuery(service, layer, {
    where: options.where || "1=1",
    returnCountOnly: "true",
    returnGeometry: "false",
    outFields: objectIdField,
  }));
  const expected = Math.min(Number(countData?.count || 0), maxRecords);
  const features: any[] = [];

  for (let offset = 0; offset < expected || (offset === 0 && expected === 0); offset += pageSize) {
    const data: any = await fetchJson(arcgisQuery(service, layer, {
      where: options.where || "1=1",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      orderByFields: `${objectIdField} ASC`,
      returnGeometry: options.geometry ? "true" : "false",
      outFields: "*",
      outSR: options.geometry ? "4326" : "",
    }));
    const page = Array.isArray(data?.features) ? data.features : [];
    features.push(...page);
    if (page.length < pageSize || features.length >= maxRecords) break;
  }

  return {
    total: Number(countData?.count ?? features.length),
    truncated: features.length < Number(countData?.count ?? features.length),
    features: features.slice(0, maxRecords),
    geometryType: metadata?.geometryType || null,
    objectIdField,
  };
}

async function safeSource<T>(name: string, loader: () => Promise<T>) {
  try {
    return { name, available: true, data: await loader(), error: null };
  } catch (error: any) {
    return { name, available: false, data: null, error: error?.message || "Falha ao consultar fonte" };
  }
}

function attributes(data: any) {
  const features = Array.isArray(data?.features) ? data.features : Array.isArray(data) ? data : [];
  return features.map((item: any) => item?.attributes || item || {});
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
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
    if (!bairro) {
      unclassified += 1;
      continue;
    }
    const key = normalize(bairro);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return { counts, unclassified };
}

function configuredExternalSources() {
  return [
    {
      key: "transparencia_manaus", etapa: "E2.4", nome: "Portal da Transparência de Manaus",
      endpoint: process.env.MANAUS_TRANSPARENCIA_API_URL || null,
      paginaOficial: "https://transparencia.manaus.am.gov.br/",
    },
    {
      key: "cmm_sapl", etapa: "E2.5", nome: "Câmara Municipal de Manaus / SAPL",
      endpoint: CMM_SAPL_BASE, paginaOficial: "https://www.cmm.am.gov.br/transparencia/",
    },
    {
      key: "tce_am", etapa: "E2.6", nome: "TCE-AM Dados Abertos",
      endpoint: process.env.TCE_AM_API_URL || null,
      paginaOficial: "https://transparencia-new.tceam.tc.br/dadosAbertos",
    },
    {
      key: "obrasgov", etapa: "E2.6", nome: "ObrasGov API Pública",
      endpoint: process.env.OBRASGOV_API_URL || null,
      paginaOficial: "https://api-publica.obrasgov.gestao.gov.br/",
    },
  ].map((source) => ({ ...source, status: source.endpoint ? "configurado" : "aguardando_endpoint_json" }));
}

function summarizeExternal(data: any) {
  const array = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : null;
  return {
    tipo: array ? "colecao" : typeof data,
    total: array ? array.length : typeof data?.count === "number" ? data.count : null,
    amostra: array ? array.slice(0, 5) : null,
  };
}

async function normalizedExternalIndicators() {
  const sources = configuredExternalSources();
  return Promise.all(sources.map(async (source) => {
    if (!source.endpoint) {
      return {
        key: source.key,
        nome: source.nome,
        configurado: false,
        disponibilidade: "nao_configurado",
        registrosObservados: null,
        tipo: null,
        erro: null,
      };
    }
    const url = source.key === "cmm_sapl" ? `${source.endpoint}/materia/materialegislativa/?ano=${new Date().getFullYear()}&page_size=1` : source.endpoint;
    const result = await safeSource(source.nome, () => fetchJson(url as string));
    const resumo = result.available ? summarizeExternal(result.data) : null;
    return {
      key: source.key,
      nome: source.nome,
      configurado: true,
      disponibilidade: result.available ? "disponivel" : "indisponivel",
      registrosObservados: resumo?.total ?? null,
      tipo: resumo?.tipo ?? null,
      erro: result.error,
    };
  }));
}

export function setupManausRadarRoutes(app: Express) {
  app.get("/api/radar/manaus/fontes", (_req, res) => {
    res.json({
      municipio: "Manaus",
      atualizacao: new Date().toISOString(),
      fontes: [
        { key: "geomanaus_bairros", etapa: "E2.1", nome: "GeoManaus / Bairros IMPLURB", status: "integrado", endpoint: `${ARCGIS_CCC}/3` },
        { key: "seminf_obras", etapa: "E2.2", nome: "SEMINF / Obras Prefeitura de Manaus", status: "integrado", endpoint: `${ARCGIS_OBRAS}/0` },
        { key: "semsa", etapa: "E2.3", nome: "SEMSA / Unidades de Saúde", status: "integrado", endpoint: `${ARCGIS_CCC}/17` },
        { key: "semed", etapa: "E2.3", nome: "SEMED / Escolas Municipais", status: "integrado", endpoint: `${ARCGIS_CCC}/20` },
        ...configuredExternalSources(),
        { key: "demandas_internas", etapa: "E2.7", nome: "Demandas FISCALIZE - VOCÊ CUIDANDO DA CIDADE", status: "integrado", endpoint: "banco_local" },
      ],
    });
  });

  app.get("/api/radar/manaus/bairros", async (_req, res) => {
    try {
      const data = await arcgisAll(ARCGIS_CCC, 3);
      res.json({ total: data.total, retornados: data.features.length, truncated: data.truncated, bairros: attributes(data) });
    } catch (error: any) {
      res.status(502).json({ error: "Falha ao consultar bairros no GeoManaus", detail: error.message });
    }
  });

  app.get("/api/radar/manaus/mapa/bairros", async (_req, res) => {
    try {
      const data = await arcgisAll(ARCGIS_CCC, 3, { geometry: true, maxRecords: 500 });
      res.setHeader("Cache-Control", "private, max-age=300");
      res.json({
        municipio: "Manaus",
        total: data.total,
        retornados: data.features.length,
        truncated: data.truncated,
        geometryType: data.geometryType,
        spatialReference: { wkid: 4326 },
        features: data.features,
      });
    } catch (error: any) {
      res.status(502).json({ error: "Falha ao carregar camada geoespacial de bairros", detail: error.message });
    }
  });

  app.get("/api/radar/manaus/obras", async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status.trim().slice(0, 80) : "";
      const where = status ? `UPPER(SITUACAO) LIKE '%${status.toUpperCase().replace(/'/g, "''")}%'` : "1=1";
      const data = await arcgisAll(ARCGIS_OBRAS, 0, { where });
      res.json({ total: data.total, retornados: data.features.length, truncated: data.truncated, obras: attributes(data) });
    } catch (error: any) {
      res.status(502).json({ error: "Falha ao consultar obras da SEMINF", detail: error.message });
    }
  });

  app.get("/api/radar/manaus/equipamentos", async (_req, res) => {
    const [saude, escolas] = await Promise.all([
      safeSource("SEMSA", () => arcgisAll(ARCGIS_CCC, 17)),
      safeSource("SEMED", () => arcgisAll(ARCGIS_CCC, 20)),
    ]);
    res.json({
      saude: { available: saude.available, total: (saude.data as any)?.total || 0, itens: attributes(saude.data), error: saude.error },
      escolas: { available: escolas.available, total: (escolas.data as any)?.total || 0, itens: attributes(escolas.data), error: escolas.error },
    });
  });

  app.get("/api/radar/manaus/legislativo", async (req, res) => {
    const ano = /^20\d{2}$/.test(String(req.query.ano || "")) ? String(req.query.ano) : String(new Date().getFullYear());
    const url = `${CMM_SAPL_BASE}/materia/materialegislativa/?ano=${ano}&page_size=100`;
    try {
      const data: any = await fetchJson(url);
      const itens = data?.results || data?.data || (Array.isArray(data) ? data : []);
      res.json({ fonte: "CMM/SAPL", ano, total: data?.count ?? itens.length, itens });
    } catch (error: any) {
      res.status(502).json({ error: "Falha ao consultar API legislativa da CMM/SAPL", detail: error.message, endpoint: url });
    }
  });

  app.get("/api/radar/manaus/externas", async (_req, res) => {
    const sources = configuredExternalSources().filter((source) => source.key !== "cmm_sapl");
    const results = await Promise.all(sources.map(async (source) => {
      if (!source.endpoint) return { ...source, available: false, error: "Endpoint JSON não configurado", resumo: null };
      const result = await safeSource(source.nome, () => fetchJson(source.endpoint as string));
      return { ...source, available: result.available, error: result.error, resumo: result.available ? summarizeExternal(result.data) : null };
    }));
    res.json({ municipio: "Manaus", atualizadoEm: new Date().toISOString(), fontes: results });
  });

  app.get("/api/radar/manaus/indicadores-externos", async (_req, res) => {
    const indicadores = await normalizedExternalIndicators();
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ municipio: "Manaus", atualizadoEm: new Date().toISOString(), indicadores });
  });

  app.get("/api/radar/manaus/demandas", (_req, res) => {
    try {
      const db = getDb();
      const porBairro = db.prepare(`SELECT COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') AS bairro, COUNT(*) AS total, SUM(CASE WHEN prioridade IN ('ALTA','CRITICA') THEN 1 ELSE 0 END) AS prioritarias, SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS concluidas FROM demandas WHERE LOWER(municipio) = 'manaus' GROUP BY COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') ORDER BY total DESC`).all();
      const porTema = db.prepare(`SELECT categoria, COUNT(*) AS total FROM demandas WHERE LOWER(municipio) = 'manaus' GROUP BY categoria ORDER BY total DESC`).all();
      db.close();
      res.json({ porBairro, porTema });
    } catch (error: any) {
      res.status(500).json({ error: "Falha ao consolidar demandas internas", detail: error.message });
    }
  });

  app.get("/api/radar/manaus/territorios", async (req, res) => {
    const filtroBairro = typeof req.query.bairro === "string" ? normalize(req.query.bairro).slice(0, 120) : "";
    const [obras, saude, escolas] = await Promise.all([
      safeSource("obras", () => arcgisAll(ARCGIS_OBRAS, 0)),
      safeSource("saude", () => arcgisAll(ARCGIS_CCC, 17)),
      safeSource("escolas", () => arcgisAll(ARCGIS_CCC, 20)),
    ]);

    const obraCounts = countByNeighborhood((obras.data as any)?.features || []);
    const saudeCounts = countByNeighborhood((saude.data as any)?.features || []);
    const escolaCounts = countByNeighborhood((escolas.data as any)?.features || []);

    try {
      const db = getDb();
      const demandas = db.prepare(`
        SELECT COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') AS bairro,
               COUNT(*) AS demandas,
               SUM(CASE WHEN prioridade IN ('ALTA','CRITICA') THEN 1 ELSE 0 END) AS prioritarias,
               SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS concluidas,
               COUNT(DISTINCT categoria) AS temas
        FROM demandas
        WHERE LOWER(municipio)='manaus'
        GROUP BY COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado')
        ORDER BY demandas DESC
      `).all() as any[];
      db.close();

      const territorios = demandas.map((item) => {
        const key = normalize(item.bairro);
        const demandasTotal = Number(item.demandas || 0);
        const concluidas = Number(item.concluidas || 0);
        return {
          bairro: item.bairro,
          demandas: demandasTotal,
          prioritarias: Number(item.prioritarias || 0),
          concluidas,
          temas: Number(item.temas || 0),
          taxaConclusao: demandasTotal ? Number(((concluidas / demandasTotal) * 100).toFixed(1)) : 0,
          obras: obraCounts.counts.get(key) || 0,
          unidadesSaude: saudeCounts.counts.get(key) || 0,
          escolas: escolaCounts.counts.get(key) || 0,
        };
      }).filter((item) => !filtroBairro || normalize(item.bairro) === filtroBairro);

      res.json({
        municipio: "Manaus",
        geradoEm: new Date().toISOString(),
        territorios,
        classificacaoFontes: {
          obrasSemBairro: obraCounts.unclassified,
          saudeSemBairro: saudeCounts.unclassified,
          escolasSemBairro: escolaCounts.unclassified,
        },
        disponibilidade: [obras, saude, escolas].map(({ name, available, error }) => ({ name, available, error })),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Falha ao cruzar indicadores territoriais", detail: error.message });
    }
  });

  app.get("/api/radar/manaus/resumo", async (_req, res) => {
    const [bairros, obras, saude, escolas] = await Promise.all([
      safeSource("bairros", () => arcgisAll(ARCGIS_CCC, 3)),
      safeSource("obras", () => arcgisAll(ARCGIS_OBRAS, 0)),
      safeSource("saude", () => arcgisAll(ARCGIS_CCC, 17)),
      safeSource("escolas", () => arcgisAll(ARCGIS_CCC, 20)),
    ]);

    let demandas: any[] = [];
    let temas: any[] = [];
    try {
      const db = getDb();
      demandas = db.prepare(`SELECT COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') bairro, COUNT(*) total FROM demandas WHERE LOWER(municipio)='manaus' GROUP BY bairro ORDER BY total DESC`).all() as any[];
      temas = db.prepare(`SELECT categoria, COUNT(*) total FROM demandas WHERE LOWER(municipio)='manaus' GROUP BY categoria ORDER BY total DESC`).all() as any[];
      db.close();
    } catch (_) {}

    const totalOf = (source: any) => Number(source?.data?.total || 0);
    res.json({
      municipio: "Manaus",
      geradoEm: new Date().toISOString(),
      indicadores: {
        bairros: totalOf(bairros),
        obras: totalOf(obras),
        unidadesSaude: totalOf(saude),
        escolasMunicipais: totalOf(escolas),
        demandasRegistradas: demandas.reduce((sum, item) => sum + Number(item.total || 0), 0),
      },
      demandasPorBairro: demandas.slice(0, 20),
      demandasPorTema: temas.slice(0, 20),
      disponibilidade: [bairros, obras, saude, escolas].map(({ name, available, error }) => ({ name, available, error })),
      fontesExternas: configuredExternalSources(),
    });
  });
}
