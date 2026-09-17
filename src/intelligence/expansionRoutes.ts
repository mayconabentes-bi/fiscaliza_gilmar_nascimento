import type { Express } from "express";
import { getDb } from "../server/db.js";
import { aggregateTerritories } from "./analytics.js";
import { loadCanonicalExpansionSources } from "./expansionBundle.js";
import { loadIbgePopulation, loadObrasGovProjectEnrichment, loadSiconfi } from "./expansionSources.js";
import { buildMultiSourceContext } from "./multiSourceInsights.js";
import { loadHealthUnits, loadMunicipalWorks, loadNeighborhoods, loadSchools } from "./sources.js";
import { recordSourceHealth, sourceHealth } from "./storage.js";
import type { SourceAvailability, SourceEnvelope } from "./types.js";

const BUNDLE_TTL_MS = 5 * 60 * 1000;
let radarBundleCache: { expiresAt: number; revision: string; promise: Promise<any> } | null = null;
let contextBundleCache: { expiresAt: number; revision: string; promise: Promise<any> } | null = null;

const externalKeys = ["cmm_sapl", "obrasgov", "tce_am", "transparencia_manaus", "ibge_populacao", "siconfi_dca", "pncp_contratos", "cnes_datasus_catalogo", "inep_censo_escolar"];

function publicSource(source: SourceEnvelope<any[]>) {
  return { ...source, data: undefined, recordsReturned: Array.isArray(source.data) ? source.data.length : source.quality.total };
}

function sourceName(key: string) {
  const names: Record<string, string> = {
    geomanaus_bairros: "GeoManaus / Bairros",
    seminf_obras: "SEMINF / Obras municipais",
    geomanaus_saude: "SEMSA / Saúde",
    geomanaus_escolas: "SEMED / Escolas",
    cmm_sapl: "CMM / SAPL",
    obrasgov: "ObrasGov",
    tce_am: "TCE-AM",
    transparencia_manaus: "Transparência Manaus",
    ibge_populacao: "IBGE / População",
    siconfi_dca: "Tesouro / SICONFI",
    pncp_contratos: "PNCP / Contratos do Município de Manaus",
    cnes_datasus_catalogo: "DATASUS / CNES",
    inep_censo_escolar: "INEP / Censo Escolar",
  };
  return names[key] || key;
}

function sourceEndpoint(key: string) {
  const endpoints: Record<string, string | null> = {
    cmm_sapl: process.env.CMM_SAPL_API_BASE || "https://sapl.cmm.am.gov.br/api",
    obrasgov: process.env.OBRASGOV_API_URL || "https://api-publica.obrasgov.gestao.gov.br/obras",
    tce_am: process.env.TCE_AM_API_URL || "https://econtasapi.tce.am.gov.br",
    transparencia_manaus: process.env.MANAUS_TRANSPARENCIA_API_URL || null,
    ibge_populacao: process.env.IBGE_POPULATION_API_URL || "https://apisidra.ibge.gov.br/values/t/6579/n6/1302603/v/9324/p/last%201?formato=json",
    siconfi_dca: process.env.SICONFI_API_URL || "https://apidatalake.tesouro.gov.br/ords/siconfi/tt",
    pncp_contratos: process.env.PNCP_API_URL || "https://pncp.gov.br/api/consulta/v1",
    cnes_datasus_catalogo: process.env.CNES_DATASUS_API_URL || process.env.CNES_DATASUS_CATALOG_URL || "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos",
    inep_censo_escolar: process.env.INEP_CENSO_ESCOLAR_API_URL || null,
  };
  return endpoints[key] ?? null;
}

function etapa(key: string) {
  const stages: Record<string, string> = { ibge_populacao: "P0", siconfi_dca: "P1", pncp_contratos: "P2", obrasgov: "P3", cnes_datasus_catalogo: "P4", inep_censo_escolar: "P5", tce_am: "P6" };
  return stages[key] || "Base";
}

function radarStatus(availability: string) {
  if (availability === "available") return "integrado";
  if (availability === "degraded") return "integrado_com_ressalvas";
  if (availability === "not_configured") return "configuracao_necessaria";
  if (availability === "unknown") return "sem_atualizacao";
  return "indisponivel";
}

function availabilityStatus(availability: string) {
  if (availability === "available") return "disponivel";
  if (availability === "degraded") return "disponivel_com_ressalvas";
  if (availability === "not_configured") return "nao_configurado";
  if (availability === "unknown") return "sem_atualizacao";
  return "indisponivel";
}

function persistedRevision(rows: any[]) {
  return rows
    .filter((row) => externalKeys.includes(String(row.source_key)))
    .map((row) => [row.source_key, row.fetched_at, row.total_records, row.availability, row.error || ""].join(":"))
    .sort()
    .join("|");
}

function persistedExternal(rows: any[] = sourceHealth() as any[]) {
  const byKey = new Map(rows.map((row) => [row.source_key, row]));
  return externalKeys.map((key) => {
    const row: any = byKey.get(key);
    return {
      key,
      nome: sourceName(key),
      etapa: etapa(key),
      availability: row?.availability || "unknown",
      records: Number(row?.total_records || 0),
      coverage: row?.coverage == null ? null : Number(row.coverage),
      fetchedAt: row?.fetched_at || null,
      error: row?.error || null,
      endpoint: sourceEndpoint(key),
    };
  });
}

function persistedEnvelope(key: string, rows: any[]): SourceEnvelope<any[]> {
  const row = rows.find((item) => item.source_key === key);
  const availability = (row?.availability || "unavailable") as SourceAvailability;
  const total = Number(row?.total_records || 0);
  const classified = Number(row?.classified_records || 0);
  const unclassified = Number(row?.unclassified_records || Math.max(0, total - classified));
  const coverage = row?.coverage == null ? (total ? classified / total : 0) : Number(row.coverage);
  return {
    source: key,
    availability,
    provenance: {
      source: key,
      sourceUrl: sourceEndpoint(key) || "",
      fetchedAt: row?.fetched_at || new Date(0).toISOString(),
      sourceUpdatedAt: row?.source_updated_at || null,
    },
    quality: { total, classified, unclassified, coverage },
    data: [],
    error: row?.error || (row ? null : "Fonte ainda sem coleta persistida."),
  };
}

async function loadRadarBundle() {
  const persisted = sourceHealth() as any[];
  const revision = persistedRevision(persisted);
  if (radarBundleCache && radarBundleCache.expiresAt > Date.now() && radarBundleCache.revision === revision) return radarBundleCache.promise;
  const promise = (async () => {
    const [neighborhoods, works, health, schools] = await Promise.all([loadNeighborhoods(), loadMunicipalWorks(), loadHealthUnits(), loadSchools()]);
    [neighborhoods, works, health, schools].forEach(recordSourceHealth);
    const territories = neighborhoods.data.length ? aggregateTerritories({ neighborhoods: neighborhoods.data, works: works.data, health: health.data, schools: schools.data }) : [];
    const db = getDb();
    let porTema: Array<{ categoria: string; total: number }> = [];
    try {
      porTema = db.prepare(`SELECT COALESCE(NULLIF(TRIM(categoria), ''), 'Não informado') categoria, COUNT(*) total FROM demandas WHERE LOWER(municipio)='manaus' GROUP BY COALESCE(NULLIF(TRIM(categoria), ''), 'Não informado') ORDER BY total DESC`).all() as any[];
    } finally { db.close(); }
    return { generatedAt: new Date().toISOString(), snapshotRevision: revision, neighborhoods, works, health, schools, coreSources: [neighborhoods, works, health, schools], external: persistedExternal(persisted), territories, porTema };
  })();
  radarBundleCache = { expiresAt: Date.now() + BUNDLE_TTL_MS, revision, promise };
  promise.catch(() => { if (radarBundleCache?.promise === promise) radarBundleCache = null; });
  return promise;
}

async function loadContextBundle() {
  const persisted = sourceHealth() as any[];
  const revision = persistedRevision(persisted);
  if (contextBundleCache && contextBundleCache.expiresAt > Date.now() && contextBundleCache.revision === revision) return contextBundleCache.promise;
  const promise = (async () => {
    const [radar, ibge] = await Promise.all([loadRadarBundle(), loadIbgePopulation()]);
    const context = buildMultiSourceContext({
      territories: radar.territories,
      ibge,
      siconfi: persistedEnvelope("siconfi_dca", persisted),
      pncp: persistedEnvelope("pncp_contratos", persisted),
      cnes: persistedEnvelope("cnes_datasus_catalogo", persisted),
      inep: persistedEnvelope("inep_censo_escolar", persisted),
      obrasgov: persistedEnvelope("obrasgov", persisted),
      tce: persistedEnvelope("tce_am", persisted),
    });
    return { context: { ...context, snapshotRevision: revision, contextMode: "persisted_health", healthGeneratedFrom: "latest_refresh" } };
  })();
  contextBundleCache = { expiresAt: Date.now() + BUNDLE_TTL_MS, revision, promise };
  promise.catch(() => { if (contextBundleCache?.promise === promise) contextBundleCache = null; });
  return promise;
}

export function setupIntelligenceExpansionRoutes(app: Express) {
  app.get("/api/intelligence/sources/health", async (_req, res) => {
    const bundle = await loadRadarBundle();
    const liveCore = bundle.coreSources.map((source: SourceEnvelope<any[]>) => publicSource(source));
    const liveExternal = bundle.external.map((source: any) => ({
      source: source.key,
      availability: source.availability,
      recordsReturned: source.records,
      quality: { total: source.records, classified: source.records, unclassified: 0, coverage: source.coverage ?? 1 },
      provenance: { source: source.key, sourceUrl: source.endpoint, fetchedAt: source.fetchedAt || bundle.generatedAt },
      error: source.error,
    }));
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ generatedAt: bundle.generatedAt, snapshotRevision: bundle.snapshotRevision, live: [...liveCore, ...liveExternal], persisted: sourceHealth() });
  });

  app.get("/api/intelligence/population", async (_req, res) => {
    const source = await loadIbgePopulation();
    recordSourceHealth(source);
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/fiscal", async (req, res) => {
    const year = /^20\d{2}$/.test(String(req.query.year || "")) ? Number(req.query.year) : new Date().getFullYear() - 1;
    const source = await loadSiconfi(year);
    recordSourceHealth(source);
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/contracts", async (_req, res) => {
    const expansion = await loadCanonicalExpansionSources();
    recordSourceHealth(expansion.pncp);
    res.status(expansion.pncp.availability === "unavailable" ? 502 : 200).json(expansion.pncp);
  });

  app.get("/api/intelligence/datasets", async (_req, res) => {
    const expansion = await loadCanonicalExpansionSources();
    for (const source of Object.values(expansion)) recordSourceHealth(source);
    res.json({ generatedAt: new Date().toISOString(), sources: Object.values(expansion).map(publicSource) });
  });

  app.get("/api/intelligence/works/:id/details", async (req, res) => {
    try { res.json(await loadObrasGovProjectEnrichment(req.params.id)); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao consultar detalhes da obra." }); }
  });

  app.get("/api/intelligence/context", async (_req, res) => {
    try {
      const bundle = await loadContextBundle();
      res.setHeader("Cache-Control", "no-store, private");
      res.json(bundle.context);
    } catch (error) {
      res.status(503).json({ error: error instanceof Error ? error.message : "Não foi possível consolidar o contexto multi-fonte." });
    }
  });

  app.get("/api/radar/manaus/fontes", async (_req, res) => {
    const bundle = await loadRadarBundle();
    const core = bundle.coreSources.map((source: SourceEnvelope<any[]>) => ({ key: source.source, etapa: etapa(source.source), nome: sourceName(source.source), status: radarStatus(source.availability), endpoint: source.provenance.sourceUrl }));
    const external = bundle.external.map((source: any) => ({ key: source.key, etapa: source.etapa, nome: source.nome, status: radarStatus(source.availability), endpoint: source.endpoint }));
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ municipio: "Manaus", atualizacao: bundle.generatedAt, snapshotRevision: bundle.snapshotRevision, fontes: [...core, ...external] });
  });

  app.get("/api/radar/manaus/mapa/bairros", async (_req, res) => {
    const bundle = await loadRadarBundle();
    const source = bundle.neighborhoods as SourceEnvelope<any[]>;
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ municipio: "Manaus", total: source.quality.total, retornados: source.data.length, truncated: Boolean(source.quality.truncated), geometryType: "esriGeometryPolygon", spatialReference: { wkid: 4326 }, features: source.data });
  });

  app.get("/api/radar/manaus/territorios", async (_req, res) => {
    const bundle = await loadRadarBundle();
    res.json({ municipio: "Manaus", geradoEm: bundle.generatedAt, total: bundle.territories.length, territorios: bundle.territories });
  });

  app.get("/api/radar/manaus/indicadores-externos", async (_req, res) => {
    const bundle = await loadRadarBundle();
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      municipio: "Manaus",
      atualizadoEm: bundle.generatedAt,
      snapshotRevision: bundle.snapshotRevision,
      indicadores: bundle.external.map((source: any) => ({
        key: source.key,
        nome: source.nome,
        configurado: source.availability !== "not_configured" && source.availability !== "unknown",
        disponibilidade: availabilityStatus(source.availability),
        registrosObservados: source.records,
        tipo: "estado_da_ultima_coleta",
        erro: source.error,
      })),
    });
  });

  app.get("/api/radar/manaus/resumo", async (_req, res) => {
    const bundle = await loadRadarBundle();
    const territories = bundle.territories as Array<any>;
    const demands = territories.reduce((sum, item) => sum + Number(item.demandas || 0), 0);
    res.json({
      municipio: "Manaus",
      geradoEm: bundle.generatedAt,
      indicadores: { bairros: bundle.neighborhoods.data.length, obras: bundle.works.data.length, unidadesSaude: bundle.health.data.length, escolasMunicipais: bundle.schools.data.length, demandasRegistradas: demands },
      demandasPorBairro: territories.filter((item) => item.demandas > 0).map((item) => ({ bairro: item.bairro, total: item.demandas })).sort((a, b) => b.total - a.total),
      demandasPorTema: bundle.porTema,
      disponibilidade: [...bundle.coreSources.map((source: SourceEnvelope<any[]>) => ({ name: sourceName(source.source), available: source.availability === "available" || source.availability === "degraded", error: source.error || null })), ...bundle.external.map((source: any) => ({ name: source.nome, available: source.availability === "available" || source.availability === "degraded", error: source.error }))],
      fontesExternas: bundle.external.map((source: any) => ({ key: source.key, etapa: source.etapa, nome: source.nome, status: radarStatus(source.availability), endpoint: source.endpoint })),
    });
  });
}
