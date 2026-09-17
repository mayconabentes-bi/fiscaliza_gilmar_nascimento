import { getDb } from './db.js';

const MIN_GROUP_SIZE = Math.max(5, Number(process.env.CIVIC_AGGREGATE_MIN_GROUP_SIZE || 5));

export type CivicAggregateRow = {
  bairro: string;
  categoria: string;
  total: number;
};

/**
 * Única interface autorizada para expor dados derivados de demandas ao núcleo estratégico.
 * Retorna somente grupos territoriais agregados. Não retorna nome, contato, protocolo,
 * usuário, descrição livre, evidência, IP, identificadores ou qualquer atributo eleitoral.
 */
export function getCivicTerritorialAggregate(): CivicAggregateRow[] {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') AS bairro,
             categoria,
             COUNT(*) AS total
      FROM demandas
      GROUP BY COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado'), categoria
      HAVING COUNT(*) >= ?
      ORDER BY total DESC, bairro ASC, categoria ASC
      LIMIT 500
    `).all(MIN_GROUP_SIZE) as CivicAggregateRow[];
    return rows.map((row) => ({ bairro: String(row.bairro), categoria: String(row.categoria), total: Number(row.total) }));
  } finally { db.close(); }
}

export function civicAggregatePolicy() {
  return {
    minGroupSize: MIN_GROUP_SIZE,
    individualData: false,
    politicalProfiling: false,
    permittedFields: ['bairro', 'categoria', 'total'],
  };
}
