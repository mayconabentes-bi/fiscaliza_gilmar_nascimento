import { getDb } from "../server/db.js";
import { aggregateTerritories } from "./analytics.js";
import { buildFiscalEngine } from "./fiscalEngine.js";
import { loadCanonicalExpansionSources } from "./expansionBundle.js";
import { saveDailyTerritorySnapshots } from "./insights.js";
import {
  loadHealthUnits,
  loadManausTransparency,
  loadMunicipalWorks,
  loadNeighborhoods,
  loadObrasGov,
  loadSapl,
  loadSchools,
  loadTceAm,
} from "./sources.js";
import { recordSourceHealth, saveSnapshot } from "./storage.js";
import type { SourceEnvelope } from "./types.js";

type RefreshTrigger = "manual" | "scheduled" | "startup";

type RefreshSummary = {
  id: number;
  trigger: RefreshTrigger;
  status: "completed" | "completed_with_errors" | "failed";
  startedAt: string;
  finishedAt: string;
  sourcesTotal: number;
  sourcesAvailable: number;
  sourcesDegraded: number;
  sourcesUnavailable: number;
  sourcesNotConfigured: number;
  sources: Array<{
    source: string;
    availability: string;
    records: number;
    fetchedAt: string;
    sourceUpdatedAt?: string | null;
    fromCache?: boolean;
    error?: string | null;
  }>;
};

let activeRefresh: Promise<RefreshSummary> | null = null;

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

async function safely(source: string, sourceUrl: string, loader: () => Promise<SourceEnvelope<any[]>>) {
  try { return await loader(); }
  catch (error) { return unavailable(source, sourceUrl, error); }
}

function createRun(trigger: RefreshTrigger, startedAt: string) {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO intelligence_refresh_runs (trigger_type, status, started_at)
      VALUES (?, 'running', ?)
    `).run(trigger, startedAt);
    return Number(result.lastInsertRowid);
  } finally { db.close(); }
}

function finishRun(summary: RefreshSummary) {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE intelligence_refresh_runs
      SET status = ?, finished_at = ?, sources_total = ?, sources_available = ?,
          sources_degraded = ?, sources_unavailable = ?, sources_not_configured = ?,
          details_json = ?, error = ?
      WHERE id = ?
    `).run(
      summary.status,
      summary.finishedAt,
      summary.sourcesTotal,
      summary.sourcesAvailable,
      summary.sourcesDegraded,
      summary.sourcesUnavailable,
      summary.sourcesNotConfigured,
      JSON.stringify(summary.sources),
      summary.status === "failed" ? "Falha geral no ciclo de atualização" : null,
      summary.id,
    );
  } finally { db.close(); }
}

function failRun(id: number, finishedAt: string, error: unknown) {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE intelligence_refresh_runs
      SET status = 'failed', finished_at = ?, error = ?
      WHERE id = ?
    `).run(finishedAt, error instanceof Error ? error.message : "Falha geral no ciclo de atualização", id);
  } finally { db.close(); }
}

export function refreshHistory(limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const db = getDb();
  try {
    return db.prepare(`
      SELECT id, trigger_type, status, started_at, finished_at,
             sources_total, sources_available, sources_degraded,
             sources_unavailable, sources_not_configured, details_json, error
      FROM intelligence_refresh_runs
      ORDER BY id DESC
      LIMIT ?
    `).all(safeLimit).map((row: any) => ({
      id: row.id,
      trigger: row.trigger_type,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      sourcesTotal: row.sources_total,
      sourcesAvailable: row.sources_available,
      sourcesDegraded: row.sources_degraded,
      sourcesUnavailable: row.sources_unavailable,
      sourcesNotConfigured: row.sources_not_configured,
      sources: (() => { try { return JSON.parse(row.details_json || "[]"); } catch { return []; } })(),
      error: row.error,
    }));
  } finally { db.close(); }
}

function saveFiscalSnapshots(siconfi: SourceEnvelope<any[]>, collectedAt: Date) {
  if (!Array.isArray(siconfi.data) || !siconfi.data.length) return;
  const fiscal = buildFiscalEngine(siconfi.data);
  const period = collectedAt.toISOString().slice(0, 10);
  for (const [stage, row] of Object.entries(fiscal.stages)) {
    if (!row || !Number.isFinite(Number(row.value))) continue;
    saveSnapshot(
      `fiscal_${stage}`,
      "MANAUS",
      period,
      Number(row.value),
      ["siconfi_dca"],
      `${fiscal.methodology} Estágio: ${stage}. Conta observada: ${row.account || "não informada"}. Coluna observada: ${row.column || "não informada"}.`,
    );
  }
}

async function executeRefresh(trigger: RefreshTrigger): Promise<RefreshSummary> {
  const startedAt = new Date().toISOString();
  const id = createRun(trigger, startedAt);

  try {
    const baseSources = await Promise.all([
      safely("geomanaus_bairros", "GeoManaus", loadNeighborhoods),
      safely("seminf_obras", "SEMINF ArcGIS", loadMunicipalWorks),
      safely("geomanaus_saude", "GeoManaus", loadHealthUnits),
      safely("geomanaus_escolas", "GeoManaus", loadSchools),
      safely("cmm_sapl", "CMM/SAPL", () => loadSapl()),
      safely("obrasgov", "ObrasGov", loadObrasGov),
      safely("tce_am", "TCE-AM", loadTceAm),
      safely("transparencia_manaus", "Transparência Manaus", loadManausTransparency),
    ]);
    const expansion = await loadCanonicalExpansionSources();
    const expandedSources = [expansion.ibge, expansion.siconfi, expansion.pncp, expansion.cnes, expansion.inep];
    const sources = [...baseSources, ...expandedSources];

    for (const source of sources) recordSourceHealth(source);

    const [neighborhoods, works, health, schools] = baseSources;
    if (neighborhoods.data.length) {
      const territories = aggregateTerritories({ neighborhoods: neighborhoods.data, works: works.data, health: health.data, schools: schools.data });
      saveDailyTerritorySnapshots(territories, new Date(startedAt));
    }
    saveFiscalSnapshots(expansion.siconfi, new Date(startedAt));

    const details = sources.map((source) => ({
      source: source.source,
      availability: source.availability,
      records: Array.isArray(source.data) ? source.data.length : source.quality.total,
      fetchedAt: source.provenance.fetchedAt,
      sourceUpdatedAt: source.provenance.sourceUpdatedAt || null,
      fromCache: source.provenance.fromCache,
      error: source.error || null,
    }));

    const summary: RefreshSummary = {
      id,
      trigger,
      status: details.some((item) => item.availability === "unavailable") ? "completed_with_errors" : "completed",
      startedAt,
      finishedAt: new Date().toISOString(),
      sourcesTotal: details.length,
      sourcesAvailable: details.filter((item) => item.availability === "available").length,
      sourcesDegraded: details.filter((item) => item.availability === "degraded").length,
      sourcesUnavailable: details.filter((item) => item.availability === "unavailable").length,
      sourcesNotConfigured: details.filter((item) => item.availability === "not_configured").length,
      sources: details,
    };

    finishRun(summary);
    return summary;
  } catch (error) {
    failRun(id, new Date().toISOString(), error);
    throw error;
  }
}

export function runIntelligenceRefresh(trigger: RefreshTrigger = "manual") {
  if (activeRefresh) return activeRefresh;
  activeRefresh = executeRefresh(trigger).finally(() => { activeRefresh = null; });
  return activeRefresh;
}

export function refreshState() {
  const [latest] = refreshHistory(1);
  return { running: Boolean(activeRefresh), latest: latest || null };
}

export function startIntelligenceRefreshScheduler() {
  const enabled = String(process.env.INTELLIGENCE_AUTO_REFRESH || "true").toLowerCase() !== "false";
  if (!enabled) return null;
  const minutes = Math.max(15, Number(process.env.INTELLIGENCE_REFRESH_INTERVAL_MINUTES || 360));
  const intervalMs = minutes * 60 * 1000;
  const timer = setInterval(() => {
    runIntelligenceRefresh("scheduled").catch((error) => console.error("Falha no refresh automático de inteligência:", error));
  }, intervalMs);
  timer.unref?.();
  return timer;
}
