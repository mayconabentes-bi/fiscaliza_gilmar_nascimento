import type { Express, Request, Response, NextFunction } from "express";
import { checkPostgresConnection } from "./postgres.js";
import { checkEvidenceBucketPrivate, EvidenceStorageUnavailableError, validateStorageServiceKey } from "./evidenceStorage.js";
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
  validateStorageServiceKey(String(process.env.SUPABASE_SERVICE_ROLE_KEY || ""));
}

export async function assertProductionReadiness() {
  if (process.env.NODE_ENV !== "production") return;
  validateProductionEnvironment();
  const databaseReady = await checkPostgresConnection();
  if (!databaseReady) throw new Error("Banco de dados de produção indisponível");
  try {
    await checkEvidenceBucketPrivate();
  } catch (error) {
    if (error instanceof EvidenceStorageUnavailableError) {
      console.warn("Storage de evidências temporariamente indisponível no startup; registro seguirá sem bloquear protocolos.");
      return;
    }
    throw error;
  }
}

export function allowedOrigins() {
  const origins = new Set<string>();
  for (const value of (process.env.APP_ORIGIN || "http://localhost:3000").split(",")) {
    const origin = value.trim();
    if (origin) origins.add(origin);
  }
  // Railway injeta o domínio público gerado do serviço (sem protocolo).
  // Domínios personalizados continuam sendo declarados em APP_ORIGIN.
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) origins.add(`https://${railwayDomain}`);
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
            passwordRecovery: process.env.ENABLE_PASSWORD_RECOVERY === "true" ? "enabled" : "disabled",
          });
        } finally {
          db.close();
        }
      }

      validateProductionEnvironment();
      const databaseReady = await checkPostgresConnection();
      if (!databaseReady) return res.status(503).json({ status: "not_ready", database: "unavailable" });

      let evidenceStorage = "supabase-private";
      try {
        const evidenceBucketPrivate = await checkEvidenceBucketPrivate();
        if (!evidenceBucketPrivate) return res.status(503).json({ status: "not_ready", evidenceStorage: "unavailable" });
      } catch (error) {
        if (error instanceof EvidenceStorageUnavailableError) {
          evidenceStorage = "degraded";
        } else {
          throw error;
        }
      }

      return res.json({
        status: "ready",
        database: "postgres",
        evidenceStorage,
        privacyNoticeVersion: process.env.LGPD_CONSENT_VERSION,
        publicRegistration: process.env.ENABLE_PUBLIC_REGISTRATION === "true" ? "enabled" : "disabled",
        publicDemandIntake: process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true" ? "enabled" : "disabled",
        passwordRecovery: process.env.ENABLE_PASSWORD_RECOVERY === "true" ? "enabled" : "disabled",
      });
    } catch (error: any) {
      console.error("Falha no readiness check:", error);
      return res.status(503).json({ status: "not_ready", error: error instanceof Error ? error.message : "Falha na verificação de prontidão." });
    }
  });
}
