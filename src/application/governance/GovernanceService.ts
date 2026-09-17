import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";
import { AuditService } from "../../infrastructure/audit/AuditService.js";

export class GovernanceService {
  static registrarDenuncia(publicacaoId: string, usuarioDenuncianteId: string, motivo: string) {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO denuncias (id, publicacao_id, usuario_denunciante_id, motivo, status)
      VALUES (?, ?, ?, ?, 'PENDENTE')
    `).run(id, publicacaoId, usuarioDenuncianteId, motivo);

    AuditService.log('denuncia', id, 'DENUNCIA_CRIADA', usuarioDenuncianteId, { publicacaoId, motivo });

    return id;
  }

  static getDenunciasPendentes() {
    const db = getDb();
    return db.prepare(`
      SELECT d.*, p.conteudo as publicacao_conteudo, u.nome_completo as denunciante_nome
      FROM denuncias d
      JOIN publicacoes p ON d.publicacao_id = p.id
      JOIN usuarios u ON d.usuario_denunciante_id = u.id
      WHERE d.status = 'PENDENTE'
      ORDER BY d.created_at ASC
    `).all();
  }

  static resolverDenuncia(denunciaId: string, acao: 'MANTER' | 'REMOVER', moderadorId: string) {
    const db = getDb();
    
    db.transaction(() => {
      // Update denuncia status
      db.prepare(`
        UPDATE denuncias SET status = 'RESOLVIDA' WHERE id = ?
      `).run(denunciaId);

      if (acao === 'REMOVER') {
        // Get publicacaoId
        const denuncia = db.prepare('SELECT publicacao_id FROM denuncias WHERE id = ?').get(denunciaId) as any;
        if (denuncia) {
          db.prepare(`UPDATE publicacoes SET status_moderacao = 'rejeitado' WHERE id = ?`).run(denuncia.publicacao_id);
          AuditService.log('publicacao', denuncia.publicacao_id, 'REMOVIDA_POR_DENUNCIA', moderadorId, { denunciaId });
        }
      }

      AuditService.log('denuncia', denunciaId, `DENUNCIA_RESOLVIDA_${acao}`, moderadorId);
    })();
  }

  static avaliarComportamentoUsuario(usuarioId: string) {
    const db = getDb();
    
    // Check if user has multiple rejected publications or resolved reports against them
    const rejeitadas = db.prepare(`
      SELECT COUNT(*) as count FROM publicacoes WHERE usuario_id = ? AND status_moderacao = 'rejeitado'
    `).get(usuarioId) as any;

    const denunciasContra = db.prepare(`
      SELECT COUNT(*) as count 
      FROM denuncias d
      JOIN publicacoes p ON d.publicacao_id = p.id
      WHERE p.usuario_id = ? AND d.status = 'RESOLVIDA'
    `).get(usuarioId) as any;

    if (rejeitadas.count >= 3 || denunciasContra.count >= 2) {
      // Suspend user
      db.prepare(`UPDATE usuarios SET status = 'suspenso' WHERE id = ?`).run(usuarioId);
      AuditService.log('usuario', usuarioId, 'SUSPENSAO_AUTOMATICA', 'sistema', {
        motivo: 'Reincidência de infrações',
        rejeitadas: rejeitadas.count,
        denuncias: denunciasContra.count
      });
      return { status: 'suspenso', message: 'Usuário suspenso por reincidência' };
    }

    return { status: 'ativo', message: 'Comportamento dentro dos limites' };
  }
}
