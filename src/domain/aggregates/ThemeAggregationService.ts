import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";
import { extractKeywords, calculateJaccardSimilarity } from "../utils/textUtils.js";

export class ThemeAggregationService {
  static aggregatePublicacoes() {
    const db = getDb();
    
    // Get all approved publications that are not yet aggregated
    const publicacoes = db.prepare(`
      SELECT * FROM publicacoes 
      WHERE status_moderacao = 'aprovado' 
      AND tema_agregado_id IS NULL
    `).all() as any[];

    if (publicacoes.length === 0) return [];

    // Group by area_tematica and municipio
    const groups: Record<string, any[]> = {};
    for (const pub of publicacoes) {
      const key = `${pub.area_tematica}_${pub.municipio}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(pub);
    }

    const processedTemas: any[] = [];
    const SIMILARITY_THRESHOLD = 0.4; // 40% similarity threshold

    db.transaction(() => {
      for (const key in groups) {
        const pubs = groups[key];
        
        // Get existing temas for this area and municipio
        const [area_tematica, municipio] = key.split('_');
        const existingTemas = db.prepare(`
          SELECT * FROM temas_agregados 
          WHERE area_tematica = ? AND municipio = ?
        `).all(area_tematica, municipio) as any[];

        for (const pub of pubs) {
          const pubKeywords = new Set(extractKeywords(pub.conteudo));
          
          let matchedTema = null;
          let maxSimilarity = 0;

          // Check against existing temas
          for (const tema of existingTemas) {
            const temaKeywords = new Set<string>(tema.titulo_normalizado.split(' '));
            const similarity = calculateJaccardSimilarity(pubKeywords, temaKeywords);
            
            if (similarity >= SIMILARITY_THRESHOLD && similarity > maxSimilarity) {
              maxSimilarity = similarity;
              matchedTema = tema;
            }
          }

          if (matchedTema) {
            // Update existing tema
            db.prepare(`
              UPDATE temas_agregados 
              SET total_publicacoes = total_publicacoes + 1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(matchedTema.id);

            db.prepare(`
              UPDATE publicacoes 
              SET tema_agregado_id = ? 
              WHERE id = ?
            `).run(matchedTema.id, pub.id);
            
            matchedTema.total_publicacoes += 1;
            processedTemas.push(matchedTema);
          } else {
            // Create new tema
            const newTemaId = uuidv4();
            const tituloNormalizado = Array.from(pubKeywords).slice(0, 5).join(' '); // Top 5 keywords
            
            db.prepare(`
              INSERT INTO temas_agregados (id, area_tematica, municipio, titulo_normalizado, total_publicacoes)
              VALUES (?, ?, ?, ?, 1)
            `).run(newTemaId, area_tematica, municipio, tituloNormalizado);

            db.prepare(`
              UPDATE publicacoes 
              SET tema_agregado_id = ? 
              WHERE id = ?
            `).run(newTemaId, pub.id);

            const newTema = {
              id: newTemaId,
              area_tematica,
              municipio,
              titulo_normalizado: tituloNormalizado,
              total_publicacoes: 1,
              score_recorrencia: 0
            };
            existingTemas.push(newTema);
            processedTemas.push(newTema);
          }
        }
      }
    })();

    return processedTemas;
  }
}
