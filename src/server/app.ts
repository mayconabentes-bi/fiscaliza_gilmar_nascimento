import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { setupDatabase } from "./db.js";
import { setupRoutes } from "./routes.js";
import { setupCitizenAuthPostgres } from "./citizenAuthPostgres.js";
import { setupCitizenDemandPostgres } from "./citizenDemandPostgres.js";
import { setupCitizenCompliancePostgres } from "./citizenCompliancePostgres.js";
import { setupPrivateAdminPostgresRoutes } from "./privateAdminPostgresRoutes.js";
import { setupProductionFastAdminRoutes } from "./productionFastAdminRoutes.js";
import { setupProductionRadarRoutes } from "./productionRadarRoutes.js";
import { setupProductionIntelligenceRoutes } from "./productionIntelligenceRoutes.js";
import { setupProductionStrategyRoutes } from "./productionStrategyRoutes.js";
import { setupManausRadarRoutes } from "./manausRadarRoutes.js";
import { setupStrategyRoutes } from "./strategyRoutes.js";
import { setupPrivateAdminRoutes } from "./privateAdminRoutes.js";
import { allowedOrigins, citizenRegistrationGuard, csrfOriginGuard, setupHealthRoutes } from "./goLiveSecurity.js";
import { ensureMobileConversionSchema, setupMobileConversion } from "./mobileConversion.js";
import { requireInternalAccess } from "./internalAccess.js";
import { ensurePrivateAdminSchema, setupPrivateAdminAuth } from "./privateAdminAuth.js";
import { setupCepLookup } from "./cepLookup.js";
import { ensureIntelligenceSchema } from "../intelligence/schema.js";
import { setupIntelligenceRoutes } from "../intelligence/routes.js";
import { setupIntelligenceRefreshRoutes } from "../intelligence/refreshRoutes.js";
import { setupIntelligenceInsightRoutes } from "../intelligence/insightRoutes.js";
import { setupIntelligenceExpansionRoutes } from "../intelligence/expansionRoutes.js";
import { setupAdvancedIntelligenceRoutes } from "../intelligence/advancedRoutes.js";

const limiter = (windowMs: number, max: number) => rateLimit({ windowMs, max, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas solicitações. Tente novamente mais tarde." } });

export function createApp() {
  const app = express();
  const production = process.env.NODE_ENV === "production";
  const origins = allowedOrigins();
  const demandIntakeLimiter = limiter(60 * 60 * 1000, 20);

  app.use(helmet({ contentSecurityPolicy: production ? undefined : false, crossOriginEmbedderPolicy: false }));
  app.set("trust proxy", 1);
  app.use(cors({ origin(origin, callback) { if (!origin || origins.includes(origin)) return callback(null, true); callback(new Error("Origem não permitida por CORS")); }, credentials: true }));
  app.use(express.json({ limit: "4mb" }));
  app.use(cookieParser());
  app.use(csrfOriginGuard);
  app.use(citizenRegistrationGuard);
  app.use("/api/auth/admin/login", limiter(15 * 60 * 1000, 10));
  app.use("/api/auth/login", limiter(15 * 60 * 1000, 15));
  app.use("/api/auth/register/cidadao", limiter(60 * 60 * 1000, 10));
  app.use("/api/auth/recovery/request", limiter(60 * 60 * 1000, 6));
  app.use("/api/auth/recovery/reset", limiter(15 * 60 * 1000, 12));
  app.use("/api/demandas/protocolo", limiter(15 * 60 * 1000, 30));
  app.use("/api/demandas", (req, res, next) => req.method === "POST" ? demandIntakeLimiter(req, res, next) : next());
  app.use("/api/localizacao/cep", limiter(15 * 60 * 1000, 60));
  app.use("/api/radar", limiter(15 * 60 * 1000, 300));
  app.use("/api/intelligence", limiter(15 * 60 * 1000, 240));
  app.use("/api/", limiter(15 * 60 * 1000, 200));

  if (!production) {
    const startupDb = setupDatabase(); startupDb.close();
    ensurePrivateAdminSchema();
    ensureMobileConversionSchema();
    ensureIntelligenceSchema();
  }

  setupMobileConversion(app);
  setupHealthRoutes(app);
  setupPrivateAdminAuth(app);
  setupCepLookup(app);

  if (production) {
    setupCitizenAuthPostgres(app);
    setupCitizenDemandPostgres(app);
    setupCitizenCompliancePostgres(app);

    app.get("/api/auth/session", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, private");
      res.status(401).json({ authenticated: false });
    });

    const requireAdmin = requireInternalAccess();
    app.use("/api/admin", requireAdmin);
    app.use("/api/demandas/metricas", requireAdmin);
    app.use("/api/relatorios", requireAdmin);
    app.use("/api/radar/manaus", requireAdmin);
    app.use("/api/intelligence", requireAdmin);

    // Fast paths primeiro: Painel e Triagem não precisam passar pelas versões
    // legadas mais pesadas quando executados em produção.
    setupProductionFastAdminRoutes(app);
    setupPrivateAdminPostgresRoutes(app);
    setupProductionRadarRoutes(app);
    setupProductionStrategyRoutes(app);
    setupProductionIntelligenceRoutes(app);

    app.post("/api/auth/logout", (_req, res) => {
      res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
      res.json({ success: true });
    });

    // Rotas internas ainda dependentes do legado SQLite permanecem fail-closed
    // quando não possuem implementação de produção equivalente acima.
    app.use(["/api/intelligence", "/api/admin/strategy"], (_req, res) => {
      res.status(503).json({ error: "Operação interna ainda não migrada para a persistência de produção." });
    });

    return app;
  }

  const requireAdmin = requireInternalAccess();
  app.use("/api/admin", requireAdmin);
  app.use("/api/demandas/metricas", requireAdmin);
  app.use("/api/relatorios", requireAdmin);
  app.use("/api/radar/manaus", requireAdmin);
  app.use("/api/intelligence", requireAdmin);

  setupPrivateAdminRoutes(app);
  setupStrategyRoutes(app);
  setupRoutes(app);
  setupIntelligenceExpansionRoutes(app);
  setupAdvancedIntelligenceRoutes(app);
  setupManausRadarRoutes(app);
  setupIntelligenceRoutes(app);
  setupIntelligenceRefreshRoutes(app);
  setupIntelligenceInsightRoutes(app);
  return app;
}
