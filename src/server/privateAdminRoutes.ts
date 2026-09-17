import type { Express } from "express";
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from "uuid";
import { DB_PATH, getDb } from "./db.js";
import { ModerationService } from "../application/moderation/ModerationService.js";
import { GovernanceService } from "../application/governance/GovernanceService.js";
import { AuditService } from "../infrastructure/audit/AuditService.js";
import { SecurityAuditService } from "../infrastructure/security/SecurityAuditService.js";
import { applyRetention, retentionPreview } from './retentionPolicy.js';

const STATUS_VALIDOS = ['RECEBIDA', 'EM_TRIAGEM', 'ENCAMINHADA', 'EM_ANALISE', 'EM_EXECUCAO', 'CONCLUIDA', 'INDEFERIDA'];
const PRIORIDADES_VALIDAS = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const EVIDENCIA_DECISOES = ['APROVAR_PRIVADA', 'REJEITAR', 'REQUER_ANONIMIZACAO'] as const;

function evidenceDir() {
  return process.env.EVIDENCE_DIR || path.join(path.dirname(DB_PATH), 'evidence');
}

function deleteEvidenceFile(filename?: string | null) {
  if (!filename) return;
  const safe = path.basename(filename);
  const file = path.join(evidenceDir(), safe);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function setupPrivateAdminRoutes(app: Express) {
  app.get("/api/admin/demandas", (req, res) => {
    const db = getDb();
    try {
      const { status, municipio, categoria } = req.query;
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (typeof status === 'string' && status) { conditions.push('status = ?'); params.push(status); }
      if (typeof municipio === 'string' && municipio) { conditions.push('municipio LIKE ?'); params.push(`%${municipio}%`); }
      if (typeof categoria === 'string' && categoria) { conditions.push('categoria LIKE ?'); params.push(`%${categoria}%`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db.prepare(`SELECT * FROM demandas ${where} ORDER BY created_at DESC LIMIT 500`).all(...params);
      res.setHeader('Cache-Control', 'no-store, private');
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao listar demandas." });
    } finally {
      db.close();
    }
  });

  app.patch("/api/admin/demandas/:id/status", (req: any, res) => {
    const { status, prioridade, observacao_interna } = req.body || {};
    if (!STATUS_VALIDOS.includes(status)) return res.status(400).json({ error: "Status inválido." });
    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) return res.status(400).json({ error: "Prioridade inválida." });

    const db = getDb();
    try {
      const atual = db.prepare('SELECT id, status, prioridade FROM demandas WHERE id = ?').get(req.params.id) as any;
      if (!atual) return res.status(404).json({ error: "Demanda não encontrada." });

      db.transaction(() => {
        db.prepare(`UPDATE demandas SET status = ?, prioridade = ?, observacao_interna = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(status, prioridade || atual.prioridade, observacao_interna || null, req.params.id);
        db.prepare(`INSERT INTO historico_status_demandas (id, demanda_id, status_anterior, status_novo, usuario_responsavel_id, observacao) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(uuidv4(), req.params.id, atual.status, status, req.user?.id || 'admin', observacao_interna || null);
        AuditService.log('demanda', req.params.id, 'STATUS_ATUALIZADO', req.user?.id || 'admin', { status_anterior: atual.status, status_novo: status });
      })();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao atualizar demanda." });
    } finally {
      db.close();
    }
  });

  app.get('/api/admin/evidencias/pendentes', (_req, res) => {
    const db = getDb();
    try {
      const rows = db.prepare(`SELECT id, protocolo, municipio, bairro, categoria, evidencia_foto_mime, evidencia_moderacao_status, created_at FROM demandas WHERE evidencia_foto_path IS NOT NULL AND evidencia_moderacao_status IN ('PENDENTE','REQUER_ANONIMIZACAO') ORDER BY created_at ASC LIMIT 200`).all();
      res.setHeader('Cache-Control', 'no-store, private');
      res.json(rows);
    } finally { db.close(); }
  });

  app.post('/api/admin/evidencias/:id/decisao', (req: any, res) => {
    const decisao = String(req.body?.decisao || '');
    const observacao = String(req.body?.observacao || '').trim().slice(0, 1000);
    if (!EVIDENCIA_DECISOES.includes(decisao as any)) return res.status(400).json({ error: 'Decisão de evidência inválida.' });
    const db = getDb();
    try {
      const row = db.prepare('SELECT id, evidencia_foto_path FROM demandas WHERE id = ?').get(req.params.id) as any;
      if (!row?.evidencia_foto_path) return res.status(404).json({ error: 'Evidência não encontrada.' });
      let status = 'APROVADA_PRIVADA';
      if (decisao === 'REJEITAR') status = 'REJEITADA';
      if (decisao === 'REQUER_ANONIMIZACAO') status = 'REQUER_ANONIMIZACAO';
      if (decisao === 'REJEITAR') deleteEvidenceFile(row.evidencia_foto_path);
      db.prepare(`UPDATE demandas SET evidencia_moderacao_status = ?, evidencia_revisada_em = CURRENT_TIMESTAMP, evidencia_revisada_por = ?, evidencia_moderacao_observacao = ?, evidencia_foto_path = CASE WHEN ? = 'REJEITADA' THEN NULL ELSE evidencia_foto_path END, evidencia_foto_mime = CASE WHEN ? = 'REJEITADA' THEN NULL ELSE evidencia_foto_mime END WHERE id = ?`)
        .run(status, req.user?.id || 'admin', observacao || null, status, status, req.params.id);
      AuditService.log('demanda', req.params.id, 'EVIDENCIA_MODERADA', req.user?.id || 'admin', { decisao, status });
      res.json({ success: true, status });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao moderar evidência.' });
    } finally { db.close(); }
  });

  app.get('/api/admin/compliance/retention-preview', (_req, res) => {
    try { res.json(retentionPreview()); }
    catch (error) { console.error(error); res.status(500).json({ error: 'Erro ao simular retenção.' }); }
  });

  app.post('/api/admin/compliance/retention-run', (req: any, res) => {
    if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmação explícita é obrigatória para aplicar descarte.' });
    try {
      const result = applyRetention();
      AuditService.log('compliance', 'retention', 'RETENCAO_APLICADA', req.user?.id || 'admin', result);
      res.json(result);
    } catch (error) { console.error(error); res.status(500).json({ error: 'Erro ao aplicar política de retenção.' }); }
  });

  app.get("/api/admin/moderacao/pendentes", (_req, res) => {
    try { res.json(ModerationService.getPendentes()); }
    catch { res.status(500).json({ error: "Erro ao buscar publicações pendentes." }); }
  });

  app.post("/api/admin/moderacao/decisao", (req: any, res) => {
    const { publicacaoId, decisao, justificativa } = req.body || {};
    if (!publicacaoId || !['APROVADA', 'REJEITADA', 'EDITADA'].includes(decisao) || !justificativa) return res.status(400).json({ error: "Decisão inválida." });
    try {
      ModerationService.registrarDecisao(publicacaoId, decisao, justificativa, req.user?.id || 'admin');
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Erro ao registrar decisão." }); }
  });

  app.get("/api/admin/denuncias", (_req, res) => {
    try { res.json(GovernanceService.getDenunciasPendentes()); }
    catch { res.status(500).json({ error: "Erro ao buscar denúncias." }); }
  });

  app.post("/api/admin/denuncias/:id/resolver", (req: any, res) => {
    const acao = req.body?.acao;
    if (acao !== 'MANTER' && acao !== 'REMOVER') return res.status(400).json({ error: "Ação inválida." });
    try {
      GovernanceService.resolverDenuncia(req.params.id, acao, req.user?.id || 'admin');
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Erro ao resolver denúncia." }); }
  });

  app.get("/api/admin/auditoria/logs", (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try { res.json(AuditService.getLogs(limit, offset)); }
    catch { res.status(500).json({ error: "Erro ao carregar auditoria." }); }
  });

  app.get("/api/admin/audit", async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, private');
      res.json(await SecurityAuditService.runAudit());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao executar auditoria de segurança." });
    }
  });
}
