import { getDb } from "../../server/db.js";

export class DashboardService {
  static getDemandOverview() {
    const db = getDb();
    try {
      const resumo = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS concluidas,
          SUM(CASE WHEN status NOT IN ('CONCLUIDA', 'INDEFERIDA') THEN 1 ELSE 0 END) AS em_aberto
        FROM demandas
      `).get();

      const porTema = db.prepare(`
        SELECT categoria, COUNT(*) AS total
        FROM demandas
        GROUP BY categoria
        ORDER BY total DESC, categoria ASC
        LIMIT 12
      `).all();

      const porBairro = db.prepare(`
        SELECT COALESCE(NULLIF(TRIM(bairro), ''), 'Sem bairro') AS bairro, COUNT(*) AS total
        FROM demandas
        GROUP BY COALESCE(NULLIF(TRIM(bairro), ''), 'Sem bairro')
        ORDER BY total DESC, bairro ASC
        LIMIT 12
      `).all();

      const evolucao = db.prepare(`
        SELECT date(created_at) AS data, COUNT(*) AS total
        FROM demandas
        WHERE created_at >= date('now', '-30 days')
        GROUP BY date(created_at)
        ORDER BY data ASC
      `).all();

      return { resumo, porTema, porBairro, evolucao };
    } finally {
      db.close();
    }
  }

  static generateReportData(type: 'MENSAL' | 'TEMATICA' | 'TERRITORIAL') {
    const db = getDb();
    try {
      if (type === 'MENSAL') {
        return db.prepare(`
          SELECT protocolo, municipio, bairro, categoria, prioridade, status, date(created_at) AS data
          FROM demandas
          ORDER BY created_at DESC
        `).all();
      }

      if (type === 'TEMATICA') {
        return db.prepare(`
          SELECT categoria, COUNT(*) AS total,
            SUM(CASE WHEN status = 'CONCLUIDA' THEN 1 ELSE 0 END) AS concluidas
          FROM demandas
          GROUP BY categoria
          ORDER BY total DESC, categoria ASC
        `).all();
      }

      if (type === 'TERRITORIAL') {
        return db.prepare(`
          SELECT municipio, COALESCE(NULLIF(TRIM(bairro), ''), 'Sem bairro') AS bairro,
            COUNT(*) AS total,
            SUM(CASE WHEN status NOT IN ('CONCLUIDA', 'INDEFERIDA') THEN 1 ELSE 0 END) AS em_aberto
          FROM demandas
          GROUP BY municipio, COALESCE(NULLIF(TRIM(bairro), ''), 'Sem bairro')
          ORDER BY total DESC, municipio ASC, bairro ASC
        `).all();
      }

      return [];
    } finally {
      db.close();
    }
  }
}
