import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";

export class AuditService {
  static log(
    entidade: string,
    entidade_id: string,
    acao: string,
    usuario_responsavel_id: string | null = null,
    metadata: Record<string, any> = {}
  ) {
    const db = getDb();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO logs_auditoria (id, entidade, entidade_id, acao, usuario_responsavel_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entidade, entidade_id, acao, usuario_responsavel_id, JSON.stringify(metadata));
  }

  static getLogs(limit = 100, offset = 0) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM logs_auditoria
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
}
