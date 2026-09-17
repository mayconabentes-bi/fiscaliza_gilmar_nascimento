import { getDb } from "../../server/db.js";
import { v4 as uuidv4 } from "uuid";
import { AuditService } from "../../infrastructure/audit/AuditService.js";

export class PropostasService {
  static createProposta(autorId: string, municipio: string, data: any) {
    const db = getDb();
    try {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO propostas_civicas (
          id, autor_id, municipio, area_tematica, problema_resumido,
          proposta_solucao, impacto_estimado, custo_estimado, status,
          latitude, longitude, bairro, foto_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ABERTA', ?, ?, ?, ?)
      `).run(
        id, autorId, municipio, data.area_tematica, data.problema_resumido,
        data.proposta_solucao, data.impacto_estimado, data.custo_estimado || null,
        data.latitude !== undefined ? Number(data.latitude) : null,
        data.longitude !== undefined ? Number(data.longitude) : null,
        data.bairro || "",
        data.foto_url || null
      );

      AuditService.log('proposta_civica', id, 'PROPOSTA_CRIADA', autorId, { municipio, area_tematica: data.area_tematica });
      return id;
    } finally {
      db.close();
    }
  }

  static getPropostas(filters: any = {}) {
    const db = getDb();
    try {
      let query = `
        SELECT p.*, u.nome_completo as autor_nome
        FROM propostas_civicas p
        JOIN usuarios u ON p.autor_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters.municipio) {
        query += ` AND p.municipio = ?`;
        params.push(filters.municipio);
      }
      if (filters.area_tematica) {
        query += ` AND p.area_tematica = ?`;
        params.push(filters.area_tematica);
      }
      if (filters.status) {
        query += ` AND p.status = ?`;
        params.push(filters.status);
      }

      query += ` ORDER BY p.score_prioridade DESC, p.created_at DESC`;
      return db.prepare(query).all(...params);
    } finally {
      db.close();
    }
  }

  static getPropostaById(id: string) {
    const db = getDb();
    try {
      const proposta = db.prepare(`
        SELECT p.*, u.nome_completo as autor_nome
        FROM propostas_civicas p
        JOIN usuarios u ON p.autor_id = u.id
        WHERE p.id = ?
      `).get(id) as any;

      if (!proposta) return null;

      const apoios = db.prepare(`
        SELECT a.*, u.nome_completo as autor_nome
        FROM apoios_qualificados a
        JOIN usuarios u ON a.autor_id = u.id
        WHERE a.proposta_id = ?
        ORDER BY a.created_at DESC
      `).all(id);

      const comentarios = db.prepare(`
        SELECT c.*, u.nome_completo as autor_nome
        FROM comentarios_tecnicos c
        JOIN usuarios u ON c.autor_id = u.id
        WHERE c.proposta_id = ?
        ORDER BY c.created_at ASC
      `).all(id);

      return { ...proposta, apoios, comentarios };
    } finally {
      db.close();
    }
  }

  static addApoio(propostaId: string, autorId: string, municipioAutor: string, data: any) {
    const db = getDb();
    try {
      const existing = db.prepare(`SELECT id FROM apoios_qualificados WHERE proposta_id = ? AND autor_id = ?`).get(propostaId, autorId);
      if (existing) throw new Error("Usuário já apoiou esta proposta");

      const id = uuidv4();
      db.prepare(`
        INSERT INTO apoios_qualificados (id, proposta_id, autor_id, tipo_apoio, justificativa, prioridade, municipio_autor)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, propostaId, autorId, data.tipo_apoio, data.justificativa, data.prioridade, municipioAutor);

      this.recalculateScore(propostaId, db);
      AuditService.log('apoio_qualificado', id, 'APOIO_REGISTRADO', autorId, { proposta_id: propostaId, tipo: data.tipo_apoio });
      return id;
    } finally {
      db.close();
    }
  }

  static addComentario(propostaId: string, autorId: string, conteudo: string) {
    const db = getDb();
    try {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO comentarios_tecnicos (id, proposta_id, autor_id, tipo_autor, conteudo)
        VALUES (?, ?, ?, 'cidadao', ?)
      `).run(id, propostaId, autorId, conteudo);
      AuditService.log('proposta_civica', propostaId, 'COMENTARIO_ADICIONADO', autorId, { comentario_id: id });
      return id;
    } finally {
      db.close();
    }
  }

  static updateStatus(propostaId: string, status: string, actorId: string) {
    const db = getDb();
    try {
      db.prepare(`UPDATE propostas_civicas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, propostaId);
      AuditService.log('proposta_civica', propostaId, `STATUS_ALTERADO_${status}`, actorId);
    } finally {
      db.close();
    }
  }

  private static recalculateScore(propostaId: string, db: ReturnType<typeof getDb>) {
    const apoios = db.prepare(`SELECT prioridade, municipio_autor FROM apoios_qualificados WHERE proposta_id = ?`).all(propostaId) as any[];
    let score = 0;
    const municipios = new Set<string>();

    for (const apoio of apoios) {
      score += 1;
      if (apoio.prioridade === 'ALTA') score += 3;
      if (apoio.prioridade === 'MEDIA') score += 2;
      if (apoio.prioridade === 'BAIXA') score += 1;
      municipios.add(apoio.municipio_autor);
    }

    score += municipios.size * 2;
    db.prepare(`UPDATE propostas_civicas SET nivel_apoio = ?, score_prioridade = ? WHERE id = ?`)
      .run(apoios.length, score, propostaId);
  }
}
