import { getDb } from "../server/db.js";
import type { SourceEnvelope } from "./types.js";

export function recordSourceHealth<T>(envelope: SourceEnvelope<T>) {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO intelligence_source_health
        (source_key, availability, fetched_at, source_updated_at, total_records, classified_records, unclassified_records, coverage, error, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_key) DO UPDATE SET
        availability=excluded.availability,
        fetched_at=excluded.fetched_at,
        source_updated_at=excluded.source_updated_at,
        total_records=excluded.total_records,
        classified_records=excluded.classified_records,
        unclassified_records=excluded.unclassified_records,
        coverage=excluded.coverage,
        error=excluded.error,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      envelope.source,
      envelope.availability,
      envelope.provenance.fetchedAt,
      envelope.provenance.sourceUpdatedAt || null,
      envelope.quality.total,
      envelope.quality.classified,
      envelope.quality.unclassified,
      envelope.quality.coverage,
      envelope.error || null,
    );
  } finally { db.close(); }
}

export function sourceHealth() {
  const db = getDb();
  try {
    return db.prepare(`SELECT source_key, availability, fetched_at, source_updated_at, total_records, classified_records, unclassified_records, coverage, error, updated_at FROM intelligence_source_health ORDER BY source_key`).all();
  } finally { db.close(); }
}

export function saveSnapshot(metric: string, territory: string, period: string, value: number, sourceKeys: string[], methodology: string) {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO intelligence_snapshots (metric, territory, period, value, source_keys, methodology, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(metric, territory, period) DO UPDATE SET
        value=excluded.value,
        source_keys=excluded.source_keys,
        methodology=excluded.methodology,
        collected_at=CURRENT_TIMESTAMP
    `).run(metric, territory, period, value, JSON.stringify(sourceKeys), methodology);
  } finally { db.close(); }
}

export function snapshots(metric?: string, territory?: string) {
  const db = getDb();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (metric) { conditions.push("metric = ?"); params.push(metric); }
    if (territory) { conditions.push("territory = ?"); params.push(territory); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return db.prepare(`SELECT metric, territory, period, value, source_keys, methodology, collected_at FROM intelligence_snapshots ${where} ORDER BY period ASC, collected_at ASC`).all(...params);
  } finally { db.close(); }
}
