import type { Express } from "express";
import { loadHealthUnits, loadMunicipalWorks, loadNeighborhoods, loadObrasGov, loadSchools, loadSapl, loadTceAm, loadManausTransparency } from "../intelligence/sources.js";
import { fiscalOverview } from "../intelligence/fiscalEngine.js";
import { manausPublicEntities } from "../intelligence/manausPublicEntities.js";
import { getHealthyPostgres } from "./postgres.js";

function now() { return new Date().toISOString(); }

function safeTotal(source: any) {
  if (typeof source?.quality?.total === "number") return source.quality.total;
  if (Array.isArray(source?.data)) return source.data.length;
  return 0;
}

function normalizeField(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function neighborhoodValue(item: any) {
  const attrs = item?.attributes || item || {};
  for (const key of ["BAIRRO", "NM_BAIRRO", "NOME_BAIRRO", "NOMEBAIRRO", "BAIRRO_NOME", "DS_BAIRRO"]) {
    if (attrs[key] != null && String(attrs[key]).trim()) return String(attrs[key]).trim();
  }
  const dynamic = Object.keys(attrs).find((key) => normalizeField(key).includes("BAIRRO"));
  return dynamic && attrs[dynamic] != null ? String(attrs[dynamic]).trim() : "";
}

function territorialQualityFromRaw(raw: { works: any[]; health: any[]; schools: any[] }) {
  const dimensions = (Object.keys(raw) as Array<keyof typeof raw>).map((key) => {
    const rows = Array.isArray(raw[key]) ? raw[key] : [];
    const received = rows.length;
    const classified = rows.filter((item) => Boolean(neighborhoodValue(item))).length;
    return {
      key,
      received,
      classified,
      unclassified: Math.max(0, received - classified),
      coverage: received ? classified / received : 1,
    };
  });

  return {
    dimensions,
    methodology: "Cobertura territorial = registros da fonte com bairro reconhecível / registros recebidos da fonte. Registros sem bairro não são descartados do estado da fonte; apenas ficam fora dos indicadores territoriais.",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout ao consultar ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeLoad(loader: () => Promise<any>, source: string, timeoutMs = 4_500) {
  try { return await withTimeout(loader(), timeoutMs, source); }
  catch (error: any) {
    return {
      source,
      availability: "unavailable",
      provenance: { source, sourceUrl: "", fetchedAt: now() },
      quality: { total: 0, classified: 0, unclassified: 0, coverage: 0 },
      data: [],
      error: error?.message || "Fonte indisponível",
    };
  }
}

async function loadCore() {
  const [neighborhoods, works, health, schools] = await Promise.all([
    safeLoad(loadNeighborhoods, "geomanaus_bairros"),
    safeLoad(loadMunicipalWorks, "seminf_obras"),
    safeLoad(loadHealthUnits, "geomanaus_saude"),
    safeLoad(loadSchools, "geomanaus_escolas"),
  ]);
  return { neighborhoods, works, health, schools };
}

async function loadExternal() {
  const [sapl, obrasgov, tce, transparency] = await Promise.all([
    safeLoad(() => loadSapl(), "cmm_sapl"),
    safeLoad(loadObrasGov, "obrasgov"),
    safeLoad(loadTceAm, "tce_am"),
    safeLoad(loadManausTransparency, "transparencia_manaus"),
  ]);
  return { sapl, obrasgov, tce, transparency };
}

async function demandSummary() {
  const sql = await getHealthyPostgres();
  const [row] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where prioridade in ('ALTA','CRITICA'))::int as prioritarias,
      count(*) filter (where status = 'CONCLUIDA')::int as concluidas,
      count(distinct categoria)::int as temas,
      count(distinct nullif(trim(bairro),''))::int as bairros
    from public.demandas
    where lower(municipio) = 'manaus'
  `;
  return row || { total: 0, prioritarias: 0, concluidas: 0, temas: 0, bairros: 0 };
}

export function setupProductionIntelligenceRoutes(app: Express) {
  app.get("/api/intelligence/works", async (_req, res) => {
    const [municipal, federal] = await Promise.all([
      safeLoad(loadMunicipalWorks, "seminf_obras"),
      safeLoad(loadObrasGov, "obrasgov"),
    ]);
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({ generatedAt: now(), municipal, federal });
  });

  app.get("/api/intelligence/sources/health", async (_req, res) => {
    const [core, external] = await Promise.all([loadCore(), loadExternal()]);
    const all = [core.neighborhoods, core.works, core.health, core.schools, external.sapl, external.obrasgov, external.tce, external.transparency];
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({ generatedAt: now(), live: all.map(({ data, ...source }: any) => ({ ...source, recordsReturned: Array.isArray(data) ? data.length : 0 })), persisted: [] });
  });

  app.get("/api/intelligence/institutions", (_req, res) => {
    const institutions = manausPublicEntities();
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ generatedAt: now(), total: institutions.length, institutions, methodology: "Cadastro auditável de CNPJs públicos usados nas consultas institucionais." });
  });

  app.get("/api/intelligence/fiscal/overview", async (req, res) => {
    const requested = /^20\d{2}$/.test(String(req.query.year || "")) ? Number(req.query.year) : new Date().getFullYear() - 1;
    try {
      const data = await withTimeout(fiscalOverview(requested), 5_000, "visão fiscal");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(data);
    } catch (error: any) {
      res.status(502).json({ error: "Fonte fiscal temporariamente indisponível.", detail: error?.message || "Falha de fonte externa" });
    }
  });

  app.get("/api/intelligence/quality/territorial", async (_req, res) => {
    const core = await loadCore();
    const quality = territorialQualityFromRaw({
      works: core.works.data || [],
      health: core.health.data || [],
      schools: core.schools.data || [],
    });
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({ generatedAt: now(), ...quality });
  });

  app.get("/api/intelligence/context", async (_req, res) => {
    const [core, demands] = await Promise.all([loadCore(), demandSummary()]);
    const indicators = [
      { key: "demandas_registradas", label: "Demandas registradas", value: Number(demands.total || 0), unit: "count", methodology: "Contagem agregada de demandas registradas em Manaus.", sourceKeys: ["demandas_internas"] },
      { key: "obras_observadas", label: "Obras municipais observadas", value: safeTotal(core.works), unit: "count", methodology: "Registros retornados pela fonte municipal de obras.", sourceKeys: ["seminf_obras"] },
      { key: "saude_observada", label: "Unidades de saúde observadas", value: safeTotal(core.health), unit: "count", methodology: "Registros retornados pela camada pública de saúde.", sourceKeys: ["geomanaus_saude"] },
      { key: "escolas_observadas", label: "Escolas municipais observadas", value: safeTotal(core.schools), unit: "count", methodology: "Registros retornados pela camada pública de educação.", sourceKeys: ["geomanaus_escolas"] },
    ];
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({
      generatedAt: now(),
      population: null,
      indicators,
      observations: ["Leitura agregada e descritiva, sem perfilamento individual.", "Fontes externas podem apresentar indisponibilidade temporária sem bloquear o núcleo administrativo."],
      sourceStatus: [core.neighborhoods, core.works, core.health, core.schools].map((source: any) => ({ source: source.source, availability: source.availability, records: safeTotal(source), coverage: Number(source.quality?.coverage || 0), error: source.error || null })),
      methodology: "Indicadores de produção obtidos de fontes públicas e dados cívicos agregados persistidos em Postgres.",
    });
  });

  app.get("/api/intelligence/insights", async (_req, res) => {
    const [core, demands] = await Promise.all([loadCore(), demandSummary()]);
    const collectedAt = now();
    const current = [
      { metric: "demandas_registradas", label: "Demandas registradas", unit: "count", current: Number(demands.total || 0), sourceKeys: ["demandas_internas"], methodology: "Contagem agregada das demandas em Manaus." },
      { metric: "obras_observadas", label: "Obras municipais observadas", unit: "count", current: safeTotal(core.works), sourceKeys: ["seminf_obras"], methodology: "Registros disponíveis na fonte municipal de obras." },
      { metric: "unidades_saude", label: "Unidades de saúde observadas", unit: "count", current: safeTotal(core.health), sourceKeys: ["geomanaus_saude"], methodology: "Registros disponíveis na camada pública de saúde." },
      { metric: "escolas_municipais", label: "Escolas municipais observadas", unit: "count", current: safeTotal(core.schools), sourceKeys: ["geomanaus_escolas"], methodology: "Registros disponíveis na camada pública de educação." },
    ];
    res.setHeader("Cache-Control", "private, max-age=120");
    res.json({
      generatedAt: collectedAt,
      territory: "MANAUS",
      currentPeriod: collectedAt.slice(0, 10),
      previousPeriod: null,
      hasComparison: false,
      message: "Leitura atual disponível. A comparação histórica passa a ser exibida quando houver snapshots persistidos suficientes em produção.",
      changes: current.map((item) => ({ ...item, previous: null, delta: null, changed: null, collectedAt })),
    });
  });

  app.get("/api/intelligence/refresh/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ running: false, latest: null });
  });

  app.post("/api/intelligence/refresh", async (_req, res) => {
    const [core, external] = await Promise.all([loadCore(), loadExternal()]);
    const all = [core.neighborhoods, core.works, core.health, core.schools, external.sapl, external.obrasgov, external.tce, external.transparency];
    const available = all.filter((item: any) => item.availability === "available").length;
    const degraded = all.filter((item: any) => item.availability === "degraded").length;
    const unavailable = all.filter((item: any) => item.availability === "unavailable").length;
    const notConfigured = all.filter((item: any) => item.availability === "not_configured").length;
    const finishedAt = now();
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      id: Date.now(), trigger: "manual", status: unavailable ? "completed_with_errors" : "completed",
      startedAt: finishedAt, finishedAt,
      sourcesTotal: all.length, sourcesAvailable: available, sourcesDegraded: degraded,
      sourcesUnavailable: unavailable, sourcesNotConfigured: notConfigured,
    });
  });
}
