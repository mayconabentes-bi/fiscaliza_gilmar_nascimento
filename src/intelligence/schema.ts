import { getDb } from "../server/db.js";

export function ensureIntelligenceSchema() {
  const db = getDb();
  try {
    for (const column of [
      "latitude REAL",
      "longitude REAL",
      "bairro_oficial TEXT",
      "geocoding_source TEXT",
      "geocoding_confidence REAL",
    ]) {
      try { db.exec(`ALTER TABLE demandas ADD COLUMN ${column};`); } catch (_) {}
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS intelligence_source_health (
        source_key TEXT PRIMARY KEY,
        availability TEXT NOT NULL,
        fetched_at DATETIME NOT NULL,
        source_updated_at DATETIME,
        total_records INTEGER NOT NULL DEFAULT 0,
        classified_records INTEGER NOT NULL DEFAULT 0,
        unclassified_records INTEGER NOT NULL DEFAULT 0,
        coverage REAL NOT NULL DEFAULT 0,
        error TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS intelligence_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric TEXT NOT NULL,
        territory TEXT NOT NULL,
        period TEXT NOT NULL,
        value REAL NOT NULL,
        source_keys TEXT NOT NULL,
        methodology TEXT NOT NULL,
        collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric, territory, period)
      );

      CREATE TABLE IF NOT EXISTS intelligence_refresh_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at DATETIME NOT NULL,
        finished_at DATETIME,
        sources_total INTEGER NOT NULL DEFAULT 0,
        sources_available INTEGER NOT NULL DEFAULT 0,
        sources_degraded INTEGER NOT NULL DEFAULT 0,
        sources_unavailable INTEGER NOT NULL DEFAULT 0,
        sources_not_configured INTEGER NOT NULL DEFAULT 0,
        details_json TEXT NOT NULL DEFAULT '[]',
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_intelligence_snapshots_metric ON intelligence_snapshots(metric);
      CREATE INDEX IF NOT EXISTS idx_intelligence_snapshots_territory ON intelligence_snapshots(territory);
      CREATE INDEX IF NOT EXISTS idx_intelligence_refresh_started_at ON intelligence_refresh_runs(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_demandas_bairro_oficial ON demandas(bairro_oficial);
    `);
  } finally { db.close(); }
}
