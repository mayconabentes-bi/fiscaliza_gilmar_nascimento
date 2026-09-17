import type { Express } from "express";
import { refreshHistory, refreshState, runIntelligenceRefresh } from "./refresh.js";

export function setupIntelligenceRefreshRoutes(app: Express) {
  app.get("/api/intelligence/refresh/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.json(refreshState());
  });

  app.get("/api/intelligence/refresh/history", (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ runs: refreshHistory(limit) });
  });

  app.post("/api/intelligence/refresh", async (_req, res) => {
    try {
      const summary = await runIntelligenceRefresh("manual");
      res.setHeader("Cache-Control", "no-store, private");
      res.json(summary);
    } catch (error) {
      res.status(502).json({
        error: "Falha ao atualizar núcleo de inteligência.",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });
}
