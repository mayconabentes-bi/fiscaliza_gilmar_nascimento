import type { Express, Request, Response, NextFunction } from "express";
import { checkPostgresConnection } from "./postgres.js";
import { checkEvidenceBucketPrivate } from "./evidenceStorage.js";
import { getDb } from "./db.js";

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "JWT_SECRET",
    "DATABASE_URL",
    "APP_ORIGIN",
    "DPO_CONTACT_EMAIL",
    "LGPD_CONSENT_VERSION",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_EVIDENCE_BUCKET",
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Configuração obrigatória ausente: ${missing.join(", ")}`);
  if ((process.env.JWT_SECRET || "").length < 32) throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres.");
}

export function allowedOrigins() {
  const origins = new Set<string>();
  for (const value of (process.env.APP_ORIGIN || "http://localhost:3000").split(",")) {
    const origin = value.trim();
    if (origin) origins.add(origin);
  }
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const normalized = host?.trim();
    if (normalized) origins.add(`https://${normalized}`);
  }
  return [...origins];
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  const trusted = allowedOrigins();
  const ok = trusted.some((base) => origin === base || (!origin && referer?.startsWith(`${base}/`)));
  if (!ok && process.env.NODE_ENV === "production") return res.status(403).json({ error: "Origem não autorizada para operação mutável." });
  next();
}

export function citizenRegistrationGuard(req: Request, res: Response, next: NextFunction) {
  if (req.path !== "/api/auth/register/cidadao" || req.method !== "POST") return next();
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PUBLIC_REGISTRATION !== "true") {
    return res.status(503).json({ error: "Cadastro público ainda não habilitado neste ambiente." });
  }
  if (req.body?.aceite_lgpd !== true || req.body?.aceite_codigo !== true) {
    return res.status(400).json({ error: "Aceite das regras de uso e da Política de Privacidade é obrigatório." });
  }
  next();
}

export function setupHealthRoutes(app: Express) {
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "pulso" }));

  app.get("/ready", async (_req, res) => {
    try {
      if (process.env.NODE_ENV !== "production") {
        const db = getDb();
        try {
          const integrity = db.pragma("quick_check", { simple: true });
          if (integrity !== "ok") return res.status(503).json({ status: "not_ready", database: integrity });
          return res.json({
            status: "ready",
            database: "sqlite-local",
            publicRegistration: process.env.ENABLE_PUBLIC_REGISTRATION === "true" ? "enabled" : "disabled",
            publicDemandIntake: process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true" ? "enabled" : "disabled",
          });
        } finally {
          db.close();
        }
      }

      validateProductionEnvironment();
      const databaseReady = await checkPostgresConnection();
      if (!databaseReady) return res.status(503).json({ status: "not_ready", database: "unavailable" });

      const evidenceBucketPrivate = await checkEvidenceBucketPrivate();
      if (!evidenceBucketPrivate) return res.status(503).json({ status: "not_ready", evidenceStorage: "unavailable" });

      return res.json({
        status: "ready",
        database: "postgres",
        evidenceStorage: "supabase-private",
        privacyNoticeVersion: process.env.LGPD_CONSENT_VERSION,
        publicRegistration: process.env.ENABLE_PUBLIC_REGISTRATION === "true" ? "enabled" : "disabled",
        publicDemandIntake: process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true" ? "enabled" : "disabled",
      });
    } catch (error: any) {
      console.error("Falha no readiness check:", error);
      return res.status(503).json({ status: "not_ready", error: error instanceof Error ? error.message : "Falha na verificação de prontidão." });
    }
  });
}
