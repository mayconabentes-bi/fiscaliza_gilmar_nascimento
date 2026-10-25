import { createApp } from "../src/server/app.js";
import { assertProductionReadiness } from "../src/server/goLiveSecurity.js";
import { ensurePreviewAdmin } from "../src/server/previewAdminBootstrap.js";

const app = createApp();
let readinessPromise: Promise<void> | null = null;

async function ensureReady() {
  if (process.env.NODE_ENV !== "production") return;
  if (!readinessPromise) {
    readinessPromise = assertProductionReadiness().catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }
  await readinessPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await ensurePreviewAdmin();
    await ensureReady();
    return app(req, res);
  } catch (error) {
    console.error("Vercel API readiness failure:", error);
    if (!res.headersSent) {
      return res.status(503).json({
        error: "Serviço temporariamente indisponível.",
        code: "PRODUCTION_NOT_READY",
      });
    }
    return undefined;
  }
}
