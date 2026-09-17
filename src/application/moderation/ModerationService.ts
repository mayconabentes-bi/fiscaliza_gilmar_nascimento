import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";
import { AuditService } from "../../infrastructure/audit/AuditService.js";

export type ResultadoModeracao = 'APROVADA' | 'PENDENTE_ANALISE' | 'BLOQUEADA';

export class ModerationService {
  static avaliarPublicacao(conteudo: string, usuarioId: string): ResultadoModeracao {
    const db = getDb();
    
    // 1. Check daily limit (e.g., max 5 publications per day)
    const today = new Date().toISOString().split('T')[0];
    const pubCount = db.prepare(`
      SELECT COUNT(*) as count FROM publicacoes 
      WHERE usuario_id = ? AND date(created_at) = ?
    `).get(usuarioId, today) as any;

    if (pubCount.count >= 5) {
      return 'BLOQUEADA';
    }

    // 2. Filter forbidden words
    const forbiddenWords = ["propaganda irregular", "ataque pessoal", "idiota", "imbecil", "corrupto", "ladrão"];
    const hasForbidden = forbiddenWords.some(word => conteudo.toLowerCase().includes(word));
    
    if (hasForbidden) {
      return 'PENDENTE_ANALISE'; // Send to human moderation instead of outright rejection
    }

    // 3. Electoral pattern detection (simple regex)
    const electoralPattern = /(vote em|candidato|número \d{2})/i;
    if (electoralPattern.test(conteudo)) {
      return 'BLOQUEADA';
    }

    return 'APROVADA';
  }

  static registrarDecisao(publicacaoId: string, decisao: 'APROVADA' | 'REJEITADA' | 'EDITADA', justificativa: string, moderadorId: string) {
    const db = getDb();
    const id = uuidv4();

    db.transaction(() => {
      // Registrar a decisão
      db.prepare(`
        INSERT INTO registros_moderacao (id, publicacao_id, decisao, justificativa, moderador_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, publicacaoId, decisao, justificativa, moderadorId);

      // Atualizar status da publicação
      const novoStatus = decisao === 'REJEITADA' ? 'rejeitado' : 'aprovado';
      db.prepare(`
        UPDATE publicacoes SET status_moderacao = ? WHERE id = ?
      `).run(novoStatus, publicacaoId);

      // Log de auditoria
      AuditService.log('publicacao', publicacaoId, `MODERACAO_${decisao}`, moderadorId, { justificativa });
    })();
  }

  static getPendentes() {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, u.nome_completo 
      FROM publicacoes p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.status_moderacao = 'pendente'
      ORDER BY p.created_at ASC
    `).all();
  }
}
