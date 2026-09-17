import type { Express } from "express";
import { getDb } from "../server/db.js";
import { aggregateTerritories, derivedIndicators, nearbyResources } from "./analytics.js";
import { neighborhoodValue, normalizeText, pointInPolygon } from "./normalization.js";
import { loadHealthUnits, loadManausTransparency, loadMunicipalWorks, loadNeighborhoods, loadObrasGov, loadSapl, loadSchools, loadTceAm } from "./sources.js";
import { recordSourceHealth, saveSnapshot, snapshots, sourceHealth } from "./storage.js";
import type { SourceEnvelope } from "./types.js";

function unavailable(source: string, sourceUrl: string, error: unknown): SourceEnvelope<any[]> {
  return {
    source,
    availability: "unavailable",
    provenance: { source, sourceUrl, fetchedAt: new Date().toISOString() },
    quality: { total: 0, classified: 0, unclassified: 0, coverage: 0 },
    data: [],
    error: error instanceof Error ? error.message : "Fonte indisponível",
  };
}

async function safely(source: string, url: string, loader: () => Promise<SourceEnvelope<any[]>>) {
  try { return await loader(); } catch (error) { return unavailable(source, url, error); }
}

async function coreSources() {
  const [neighborhoods, works, health, schools] = await Promise.all([
    safely("geomanaus_bairros", "GeoManaus", loadNeighborhoods),
    safely("seminf_obras", "SEMINF ArcGIS", loadMunicipalWorks),
    safely("geomanaus_saude", "GeoManaus", loadHealthUnits),
    safely("geomanaus_escolas", "GeoManaus", loadSchools),
  ]);
  for (const source of [neighborhoods, works, health, schools]) recordSourceHealth(source);
  return { neighborhoods, works, health, schools };
}

async function externalSources() {
  const [sapl, obrasgov, tce, transparency] = await Promise.all([
    safely("cmm_sapl", "CMM/SAPL", () => loadSapl()),
    loadObrasGov(), loadTceAm(), loadManausTransparency(),
  ]);
  for (const source of [sapl, obrasgov, tce, transparency]) recordSourceHealth(source);
  return { sapl, obrasgov, tce, transparency };
}

function territoryForPoint(neighborhoods: any[], lat: number, lon: number) {
  for (const feature of neighborhoods) {
    const rings = feature?.geometry?.rings;
    if (!Array.isArray(rings) || !pointInPolygon([lon, lat], rings)) continue;
    const name = neighborhoodValue(feature?.attributes || {});
    if (name) return name;
  }
  return null;
}

export function setupIntelligenceRoutes(app: Express) {
  app.get("/api/intelligence/sources", async (_req, res) => {
    const { sapl, obrasgov, tce, transparency } = await externalSources();
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ generatedAt: new Date().toISOString(), sources: [sapl, obrasgov, tce, transparency].map(({ data, ...source }) => ({ ...source, recordsReturned: data.length })) });
  });

  app.get("/api/intelligence/sources/health", async (_req, res) => {
    const [sources, external] = await Promise.all([coreSources(), externalSources()]);
    const all = [sources.neighborhoods, sources.works, sources.health, sources.schools, external.sapl, external.obrasgov, external.tce, external.transparency];
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ generatedAt: new Date().toISOString(), live: all.map(({ data, ...source }) => ({ ...source, recordsReturned: data.length })), persisted: sourceHealth() });
  });

  app.get("/api/intelligence/territories", async (req, res) => {
    const sources = await coreSources();
    if (!sources.neighborhoods.data.length) return res.status(503).json({ error: "Camada territorial oficial indisponível.", sources: [sources.neighborhoods] });
    const territories = aggregateTerritories({ neighborhoods: sources.neighborhoods.data, works: sources.works.data, health: sources.health.data, schools: sources.schools.data });
    const filter = typeof req.query.bairro === "string" ? normalizeText(req.query.bairro).slice(0, 160) : "";
    const filtered = filter ? territories.filter((item) => normalizeText(item.bairro) === filter) : territories;
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({ generatedAt: new Date().toISOString(), total: filtered.length, territories: filtered, sourceAvailability: { works: sources.works.availability, health: sources.health.availability, schools: sources.schools.availability } });
  });

  app.get("/api/intelligence/territories/:bairro", async (req, res) => {
    const bairro = normalizeText(req.params.bairro).slice(0, 160);
    const sources = await coreSources();
    if (!sources.neighborhoods.data.length) return res.status(503).json({ error: "Camada territorial oficial indisponível." });
    const territories = aggregateTerritories({ neighborhoods: sources.neighborhoods.data, works: sources.works.data, health: sources.health.data, schools: sources.schools.data });
    const territory = territories.find((item) => normalizeText(item.bairro) === bairro);
    if (!territory) return res.status(404).json({ error: "Território não encontrado." });
    res.json({ territory, provenance: [sources.neighborhoods.provenance, sources.works.provenance, sources.health.provenance, sources.schools.provenance] });
  });

  app.get("/api/intelligence/overview", async (_req, res) => {
    const sources = await coreSources();
    if (!sources.neighborhoods.data.length) return res.status(503).json({ error: "Camada territorial oficial indisponível." });
    const territories = aggregateTerritories({ neighborhoods: sources.neighborhoods.data, works: sources.works.data, health: sources.health.data, schools: sources.schools.data });
    const indicators = derivedIndicators(territories);
    const period = new Date().toISOString().slice(0, 7);
    for (const indicator of indicators) saveSnapshot(indicator.key, "MANAUS", period, indicator.value, indicator.sourceKeys, indicator.methodology);
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({
      generatedAt: new Date().toISOString(), municipality: "Manaus",
      totals: {
        territories: territories.length,
        demands: territories.reduce((s, i) => s + i.demandas, 0),
        works: territories.reduce((s, i) => s + i.obras, 0),
        healthUnits: territories.reduce((s, i) => s + i.unidadesSaude, 0),
        schools: territories.reduce((s, i) => s + i.escolas, 0),
      },
      indicators, topTerritories: territories.slice(0, 10),
      quality: { neighborhoods: sources.neighborhoods.quality, works: sources.works.quality, health: sources.health.quality, schools: sources.schools.quality },
    });
  });

  app.get("/api/intelligence/legislative", async (req, res) => {
    const year = /^20\d{2}$/.test(String(req.query.year || "")) ? Number(req.query.year) : new Date().getFullYear();
    const source = await safely("cmm_sapl", "CMM/SAPL", () => loadSapl(year));
    recordSourceHealth(source);
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/budget", async (_req, res) => {
    const [manaus, tce] = await Promise.all([loadManausTransparency(), loadTceAm()]);
    recordSourceHealth(manaus); recordSourceHealth(tce);
    res.json({ generatedAt: new Date().toISOString(), sources: [manaus, tce] });
  });

  app.get("/api/intelligence/works", async (_req, res) => {
    const municipal = await safely("seminf_obras", "SEMINF ArcGIS", loadMunicipalWorks);
    const federal = await loadObrasGov();
    recordSourceHealth(municipal); recordSourceHealth(federal);
    res.json({ generatedAt: new Date().toISOString(), municipal, federal });
  });

  app.get("/api/intelligence/trends", (req, res) => {
    const metric = typeof req.query.metric === "string" ? req.query.metric.trim().slice(0, 120) : undefined;
    const territory = typeof req.query.territory === "string" ? req.query.territory.trim().slice(0, 160) : undefined;
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ metric: metric || null, territory: territory || null, series: snapshots(metric, territory) });
  });

  app.patch("/api/intelligence/demands/:id/location", async (req, res) => {
    const lat = Number(req.body?.latitude), lon = Number(req.body?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).json({ error: "Latitude/longitude inválidas." });
    const neighborhoods = await safely("geomanaus_bairros", "GeoManaus", loadNeighborhoods);
    const bairroOficial = neighborhoods.data.length ? territoryForPoint(neighborhoods.data, lat, lon) : null;
    const db = getDb();
    try {
      const result = db.prepare(`UPDATE demandas SET latitude=?, longitude=?, bairro_oficial=?, geocoding_source=?, geocoding_confidence=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(lat, lon, bairroOficial, bairroOficial ? "geomanaus_polygon" : "manual_coordinates", bairroOficial ? 1 : 0.5, req.params.id);
      if (!result.changes) return res.status(404).json({ error: "Demanda não encontrada." });
    } finally { db.close(); }
    res.json({ id: req.params.id, latitude: lat, longitude: lon, bairroOficial, geocodingSource: bairroOficial ? "geomanaus_polygon" : "manual_coordinates" });
  });

  app.get("/api/intelligence/demands/:id/nearby", async (req, res) => {
    const radius = Math.min(10000, Math.max(100, Number(req.query.radius || 1500)));
    const db = getDb();
    let demand: any;
    try { demand = db.prepare("SELECT id, protocolo, bairro, bairro_oficial, latitude, longitude, categoria, prioridade, status FROM demandas WHERE id = ?").get(req.params.id); }
    finally { db.close(); }
    if (!demand) return res.status(404).json({ error: "Demanda não encontrada." });
    const [works, health, schools] = await Promise.all([
      safely("seminf_obras", "SEMINF ArcGIS", loadMunicipalWorks),
      safely("geomanaus_saude", "GeoManaus", loadHealthUnits),
      safely("geomanaus_escolas", "GeoManaus", loadSchools),
    ]);
    res.json({ demand: { id: demand.id, protocolo: demand.protocolo, bairro: demand.bairro_oficial || demand.bairro }, nearby: nearbyResources({ demand, works: works.data, health: health.data, schools: schools.data, radiusMeters: radius }), availability: { works: works.availability, health: health.availability, schools: schools.availability } });
  });

  app.get("/api/intelligence/compare", async (req, res) => {
    const bairros = String(req.query.bairros || "").split(",").map((item) => normalizeText(item)).filter(Boolean).slice(0, 10);
    if (bairros.length < 2) return res.status(400).json({ error: "Informe pelo menos dois bairros separados por vírgula." });
    const sources = await coreSources();
    if (!sources.neighborhoods.data.length) return res.status(503).json({ error: "Camada territorial oficial indisponível." });
    const territories = aggregateTerritories({ neighborhoods: sources.neighborhoods.data, works: sources.works.data, health: sources.health.data, schools: sources.schools.data });
    const selected = territories.filter((item) => bairros.includes(normalizeText(item.bairro)));
    res.json({ requested: bairros, matched: selected.length, territories: selected, methodology: "Comparação descritiva de métricas agregadas. Não utiliza score político, perfil eleitoral ou atributos sensíveis." });
  });
}
