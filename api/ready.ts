import { checkPostgresConnection } from "../src/server/postgres.js";
import {
  checkEvidenceBucketPrivate,
  EvidenceStorageUnavailableError,
} from "../src/server/evidenceStorage.js";
import { validateProductionEnvironment } from "../src/server/goLiveSecurity.js";

export default async function handler(_req: any, res: any) {
  try {
    validateProductionEnvironment();
  } catch (error) {
    console.error("Vercel readiness configuration failure:", error);
    return res.status(503).json({
      status: "not_ready",
      stage: "configuration",
      code: "CONFIG_INVALID",
    });
  }

  try {
    const databaseReady = await checkPostgresConnection();
    if (!databaseReady) {
      return res.status(503).json({
        status: "not_ready",
        stage: "database",
        code: "DATABASE_UNAVAILABLE",
      });
    }
  } catch (error) {
    console.error("Vercel readiness database failure:", error);
    return res.status(503).json({
      status: "not_ready",
      stage: "database",
      code: "DATABASE_UNAVAILABLE",
    });
  }

  try {
    const evidenceBucketPrivate = await checkEvidenceBucketPrivate();
    if (!evidenceBucketPrivate) {
      return res.status(503).json({
        status: "not_ready",
        stage: "storage",
        code: "STORAGE_INVALID",
      });
    }
  } catch (error) {
    if (error instanceof EvidenceStorageUnavailableError) {
      return res.json({
        status: "ready",
        database: "postgres",
        evidenceStorage: "degraded",
      });
    }

    console.error("Vercel readiness storage failure:", error);
    return res.status(503).json({
      status: "not_ready",
      stage: "storage",
      code: "STORAGE_INVALID",
    });
  }

  return res.json({
    status: "ready",
    database: "postgres",
    evidenceStorage: "supabase-private",
    publicRegistration: process.env.ENABLE_PUBLIC_REGISTRATION === "true" ? "enabled" : "disabled",
    publicDemandIntake: process.env.ENABLE_PUBLIC_DEMAND_INTAKE === "true" ? "enabled" : "disabled",
  });
}
