import { getDb } from "../server/db.js";
import type { TerritoryRecord } from "./types.js";

const METRICS = [
  ["demandas", "Demandas registradas", "count"],
  ["prioritarias", "Demandas de prioridade alta ou crítica", "count"],
  ["concluidas", "Demandas concluídas", "count"],
  ["obras", "Obras municipais mapeadas", "count"],
  ["unidades_saude", "Unidades de saúde mapeadas", "count"],
  ["escolas", "Escolas municipais mapeadas", "count"],
] as const;

type SnapshotMetric = typeof METRICS[number][0];

type SnapshotRow = {
  metric: SnapshotMetric;
  territory: string;
  period: string;
  value: number;
  source_keys: string;
  methodology: string;
  collected_at: string;
};

function metricValue(metric: SnapshotMetric, territory: TerritoryRecord) {
  if (metric === "demandas") return territory.demandas;
  if (metric === "prioritarias") return territory.prioritarias;
  if (metric === "concluidas") return territory.concluidas;
  if (metric === "obras") return territory.obras;
  if (metric === "unidades_saude") return territory.unidadesSaude;
  return territory.escolas;
}

function sourceKeys(metric: SnapshotMetric) {
  if (["demandas", "prioritarias", "concluidas"].includes(metric)) return ["demandas_internas"];
  if (metric === "obras") return ["seminf_obras", "geomanaus_bairros"];
  if (metric === "unidades_saude") return ["geomanaus_saude", "geomanaus_bairros"];
  return ["geomanaus_escolas", "geomanaus_bairros"];
}

function methodology(metric: SnapshotMetric) {
  if (metric === "demandas") return "Contagem de demandas registradas e classificadas territorialmente.";
  if (metric === "prioritarias") return "Contagem de demandas com prioridade ALTA ou CRÍTICA classificadas territorialmente.";
  if (metric === "concluidas") return "Contagem de demandas com status CONCLUIDA classificadas territorialmente.";
  if (metric === "obras") return "Contagem de obras municipais associadas ao território por coordenada/polígono ou bairro informado.";
  if (metric === "unidades_saude") return "Contagem de unidades de saúde associadas ao território por coordenada/polígono ou bairro informado.";
  return "Contagem de escolas municipais associadas ao território por coordenada/polígono ou bairro informado.";
}

export function saveDailyTerritorySnapshots(territories: TerritoryRecord[], collectedAt = new Date()) {
  const period = collectedAt.toISOString().slice(0, 10);
  const db = getDb();
  try {
    const statement = db.prepare(`
      INSERT INTO intelligence_snapshots (metric, territory, period, value, source_keys, methodology, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(metric, territory, period) DO UPDATE SET
        value=excluded.value,
        source_keys=excluded.source_keys,
        methodology=excluded.methodology,
        collected_at=excluded.collected_at
    `);

    const write = db.transaction(() => {
      for (const territory of territories) {
        for (const [metric] of METRICS) {
          statement.run(
            metric,
            territory.bairro,
            period,
            metricValue(metric, territory),
            JSON.stringify(sourceKeys(metric)),
            methodology(metric),
            collectedAt.toISOString(),
          );
        }
      }

      const municipality: TerritoryRecord = {
        bairro: "MANAUS",
        demandas: territories.reduce((sum, row) => sum + row.demandas, 0),
        prioritarias: territories.reduce((sum, row) => sum + row.prioritarias, 0),
        concluidas: territories.reduce((sum, row) => sum + row.concluidas, 0),
        taxaConclusao: 0,
        temas: 0,
        obras: territories.reduce((sum, row) => sum + row.obras, 0),
        unidadesSaude: territories.reduce((sum, row) => sum + row.unidadesSaude, 0),
        escolas: territories.reduce((sum, row) => sum + row.escolas, 0),
        semClassificacao: territories.reduce((sum, row) => sum + row.semClassificacao, 0),
      };
      for (const [metric] of METRICS) {
        statement.run(
          metric,
          municipality.bairro,
          period,
          metricValue(metric, municipality),
          JSON.stringify(sourceKeys(metric)),
          methodology(metric),
          collectedAt.toISOString(),
        );
      }
    });

    write();
    return { period, territories: territories.length, metrics: METRICS.length };
  } finally {
    db.close();
  }
}

function latestPeriods(territory: string) {
  const db = getDb();
  try {
    return (db.prepare(`
      SELECT DISTINCT period
      FROM intelligence_snapshots
      WHERE territory = ? AND metric IN (${METRICS.map(() => "?").join(",")})
      ORDER BY period DESC
      LIMIT 2
    `).all(territory, ...METRICS.map(([metric]) => metric)) as Array<{ period: string }>).map((row) => row.period);
  } finally {
    db.close();
  }
}

function rowsForPeriod(territory: string, period: string) {
  const db = getDb();
  try {
    return db.prepare(`
      SELECT metric, territory, period, value, source_keys, methodology, collected_at
      FROM intelligence_snapshots
      WHERE territory = ? AND period = ? AND metric IN (${METRICS.map(() => "?").join(",")})
      ORDER BY metric
    `).all(territory, period, ...METRICS.map(([metric]) => metric)) as SnapshotRow[];
  } finally {
    db.close();
  }
}

export function descriptiveChanges(territory = "MANAUS") {
  const periods = latestPeriods(territory);
  if (!periods.length) {
    return {
      territory,
      currentPeriod: null,
      previousPeriod: null,
      hasComparison: false,
      changes: [],
      message: "Ainda não há snapshots históricos suficientes para comparação.",
    };
  }

  const current = rowsForPeriod(territory, periods[0]);
  const previous = periods[1] ? rowsForPeriod(territory, periods[1]) : [];
  const previousByMetric = new Map(previous.map((row) => [row.metric, row]));

  const changes = current.map((row) => {
    const before = previousByMetric.get(row.metric);
    const definition = METRICS.find(([metric]) => metric === row.metric)!;
    const delta = before ? row.value - before.value : null;
    return {
      metric: row.metric,
      label: definition[1],
      unit: definition[2],
      current: row.value,
      previous: before?.value ?? null,
      delta,
      changed: delta == null ? null : delta !== 0,
      methodology: row.methodology,
      sourceKeys: (() => { try { return JSON.parse(row.source_keys || "[]"); } catch { return []; } })(),
      collectedAt: row.collected_at,
    };
  });

  return {
    territory,
    currentPeriod: periods[0],
    previousPeriod: periods[1] || null,
    hasComparison: Boolean(periods[1]),
    changes,
    message: periods[1]
      ? "Comparação descritiva entre os dois snapshots diários mais recentes."
      : "Primeiro snapshot registrado; a comparação ficará disponível após um novo dia de coleta.",
  };
}
