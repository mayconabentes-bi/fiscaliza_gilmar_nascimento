import { createApp } from "../src/server/app.js";
import { assertProductionReadiness } from "../src/server/goLiveSecurity.js";

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

function requestPath(req: any) {
  const rawUrl = String(req.url || "");
  const pathname = rawUrl.split("?")[0];
  if (pathname && pathname !== "/api/[...path]") return pathname;

  const rawPath = req.query?.path;
  const parts = Array.isArray(rawPath) ? rawPath : typeof rawPath === "string" ? rawPath.split("/") : [];
  return parts.length ? `/api/${parts.filter(Boolean).join("/")}` : pathname;
}

function canBypassGlobalReadiness(req: any) {
  const pathname = requestPath(req);

  if (req.method === "GET" && pathname === "/api/public-config") return true;
  if (req.method === "POST" && pathname === "/api/demandas") return true;
  if (req.method === "POST" && pathname === "/api/auth/admin/login") return true;

  return false;
}

export default async function handler(req: any, res: any) {
  try {
    if (!canBypassGlobalReadiness(req)) {
      await ensureReady();
    }
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
