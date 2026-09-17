import { getDb } from "../../server/db.js";

export class RecurrenceScoreService {
  static calculateScores() {
    const db = getDb();
    
    // Calculate average publications per tema per municipio
    const averages = db.prepare(`
      SELECT municipio, AVG(total_publicacoes) as media_municipal
      FROM temas_agregados
      GROUP BY municipio
    `).all() as any[];

    const mediaMap = new Map<string, number>();
    for (const avg of averages) {
      mediaMap.set(avg.municipio, avg.media_municipal);
    }

    const temas = db.prepare(`SELECT * FROM temas_agregados`).all() as any[];

    db.transaction(() => {
      for (const tema of temas) {
        const media = mediaMap.get(tema.municipio) || 1;
        // Avoid division by zero
        const score = tema.total_publicacoes / (media === 0 ? 1 : media);
        
        db.prepare(`
          UPDATE temas_agregados 
          SET score_recorrencia = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(score, tema.id);
      }
    })();
  }
}
