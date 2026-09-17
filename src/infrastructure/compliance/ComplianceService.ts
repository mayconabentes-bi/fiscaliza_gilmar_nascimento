import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";
import { AuditService } from "../../infrastructure/audit/AuditService.js";

export class ComplianceService {
  static solicitarExportacao(usuarioId: string) {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO registros_acesso_dados (id, usuario_id, tipo_solicitacao, status)
      VALUES (?, ?, 'EXPORTACAO', 'PENDENTE')
    `).run(id, usuarioId);

    AuditService.log('usuario', usuarioId, 'SOLICITACAO_EXPORTACAO', usuarioId);
    return id;
  }

  static exportarDados(usuarioId: string) {
    const db = getDb();
    
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    const publicacoes = db.prepare('SELECT * FROM publicacoes WHERE usuario_id = ?').all(usuarioId);
    const avaliacoes = db.prepare('SELECT * FROM avaliacoes_respostas WHERE usuario_id = ?').all(usuarioId);
    const denuncias = db.prepare('SELECT * FROM denuncias WHERE usuario_denunciante_id = ?').all(usuarioId);

    // Update status
    db.prepare(`
      UPDATE registros_acesso_dados 
      SET status = 'CONCLUIDA' 
      WHERE usuario_id = ? AND tipo_solicitacao = 'EXPORTACAO' AND status = 'PENDENTE'
    `).run(usuarioId);

    AuditService.log('usuario', usuarioId, 'DADOS_EXPORTADOS', usuarioId);

    return {
      usuario,
      publicacoes,
      avaliacoes,
      denuncias
    };
  }

  static excluirConta(usuarioId: string) {
    const db = getDb();
    const id = uuidv4();

    db.transaction(() => {
      // Registrar solicitação
      db.prepare(`
        INSERT INTO registros_acesso_dados (id, usuario_id, tipo_solicitacao, status)
        VALUES (?, ?, 'EXCLUSAO', 'CONCLUIDA')
      `).run(id, usuarioId);

      // Soft delete: Anonymize data and change status
      db.prepare(`
        UPDATE usuarios 
        SET nome_completo = 'Usuário Excluído', 
            email = 'excluido_' || id || '@civic.local', 
            cpf_hash = 'excluido_' || id, 
            status = 'excluido'
        WHERE id = ?
      `).run(usuarioId);

      AuditService.log('usuario', usuarioId, 'CONTA_EXCLUIDA', usuarioId);
    })();

    return { success: true, message: "Conta excluída com sucesso" };
  }

  static getSolicitacoes() {
    const db = getDb();
    return db.prepare(`
      SELECT r.*, u.nome_completo 
      FROM registros_acesso_dados r
      JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.created_at DESC
    `).all();
  }
}
