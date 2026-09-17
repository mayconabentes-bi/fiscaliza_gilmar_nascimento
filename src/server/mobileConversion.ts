import type { Express, NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, getDb } from "./db.js";
import { getPostgres } from "./postgres.js";

const ALLOWED_EVENTS = new Set(["qr_landing","home_view","cta_registrar","form_view","form_start","form_submit","protocolo_view","protocolo_share"]);
const ATTR = /^[a-z0-9_-]{1,64}$/i;
const FORBIDDEN = ["preferencia_politica","partido","religiao","saude","raca","etnia","orientacao_sexual","vida_sexual","renda","biometria","intencao_voto","perfil_eleitoral"];

function clean(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  return ATTR.test(text) ? text : "";
}

export function publicDemandIntakeEnabled() {
  if (process.env.NODE_ENV !== "production") return process.env.ENABLE_PUBLIC_DEMAND_INTAKE !== "false";
  return process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true";
}

export function ensureMobileConversionSchema() {
  if (process.env.NODE_ENV === "production") return;
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mobile_funil_agregado (
        dia TEXT NOT NULL,
        evento TEXT NOT NULL,
        src TEXT NOT NULL DEFAULT '',
        acao TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (dia, evento, src, acao)
      );
    `);
    try { db.exec(`ALTER TABLE demandas ADD COLUMN evidencia_foto_path TEXT;`); } catch (_) {}
    try { db.exec(`ALTER TABLE demandas ADD COLUMN evidencia_foto_mime TEXT;`); } catch (_) {}
    try { db.exec(`ALTER TABLE demandas ADD COLUMN evidencia_moderacao_status TEXT NOT NULL DEFAULT 'NAO_ENVIADA';`); } catch (_) {}
  } finally { db.close(); }
}

async function increment(evento: string, src = "", acao = "") {
  if (process.env.NODE_ENV === "production") {
    const sql = getPostgres();
    await sql`
      insert into public.mobile_funil_agregado (dia, evento, src, acao, total)
      values (current_date, ${evento}, ${src}, ${acao}, 1)
      on conflict (dia, evento, src, acao)
      do update set total = public.mobile_funil_agregado.total + 1
    `;
    return;
  }

  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO mobile_funil_agregado (dia, evento, src, acao, total)
      VALUES (date('now'), ?, ?, ?, 1)
      ON CONFLICT(dia, evento, src, acao) DO UPDATE SET total = total + 1
    `).run(evento, src, acao);
  } finally { db.close(); }
}

function validatePublicDemand(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || req.path !== "/api/demandas") return next();
  if (!publicDemandIntakeEnabled()) return res.status(503).json({ error: "A coleta pública de demandas ainda não está habilitada." });
  if (req.body?.aviso_privacidade_aceito !== true) return res.status(400).json({ error: "Confirme o aviso de privacidade para registrar a demanda." });
  const forbidden = FORBIDDEN.filter((field) => req.body?.[field] !== undefined && String(req.body[field]).trim() !== "");
  if (forbidden.length) return res.status(400).json({ error: "Dados sensíveis ou de segmentação política não são aceitos.", fields: forbidden });
  next();
}

function persistEvidenceLocal(req: any, demandId: string) {
  const raw = String(req.body?.foto_evidencia_base64 || "");
  if (!raw) return;
  const match = raw.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Formato de evidência inválido.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 700 * 1024) throw new Error("Evidência excede o limite local de 700 KB.");
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const mime = `image/${match[1]}`;
  const dir = process.env.EVIDENCE_DIR || path.join(path.dirname(DB_PATH), "evidence");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${demandId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer, { flag: "wx" });
  const db = getDb();
  try {
    db.prepare(`UPDATE demandas SET evidencia_foto_path = ?, evidencia_foto_mime = ?, evidencia_moderacao_status = 'PENDENTE' WHERE id = ?`)
      .run(filename, mime, demandId);
  } finally { db.close(); }
}

export function setupMobileConversion(app: Express) {
  app.get("/api/public-config", (_req, res) => res.json({
    publicDemandIntake: publicDemandIntakeEnabled(),
    photoEvidence: true,
    privacyContact: process.env.DPO_CONTACT_EMAIL || "",
    privacyNoticeVersion: process.env.LGPD_CONSENT_VERSION || "2026-09-v1",
  }));

  app.post("/api/mobile-events", async (req, res) => {
    const event = clean(req.body?.event);
    if (!ALLOWED_EVENTS.has(event)) return res.status(400).json({ error: "Evento inválido." });
    try {
      await increment(event, clean(req.body?.src), clean(req.body?.acao));
      return res.status(204).end();
    } catch (error) {
      console.error("Falha ao registrar evento agregado:", error);
      return res.status(503).json({ error: "Não foi possível registrar o evento neste momento." });
    }
  });

  app.use(validatePublicDemand);

  app.use((req: any, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || req.path !== "/api/demandas") return next();
    const src = clean(req.body?.src);
    const acao = clean(req.body?.acao);
    const original = res.json.bind(res);
    res.json = ((body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.id && body?.protocolo) {
        if (process.env.NODE_ENV !== "production") {
          try { persistEvidenceLocal(req, body.id); }
          catch (error) { console.error("Falha ao persistir evidência fotográfica local:", error); }
        }
        void increment("form_submit", src, acao).catch((error) => console.error("Falha ao registrar form_submit agregado:", error));
      }
      return original(body);
    }) as Response["json"];
    next();
  });
}
