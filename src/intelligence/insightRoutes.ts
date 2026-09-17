import type { Express } from "express";
import { descriptiveChanges } from "./insights.js";

export function setupIntelligenceInsightRoutes(app: Express) {
  app.get("/api/intelligence/insights", (req, res) => {
    const bairro = typeof req.query.bairro === "string" ? req.query.bairro.trim().slice(0, 160) : "";
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      generatedAt: new Date().toISOString(),
      scope: bairro ? "territory" : "municipality",
      ...descriptiveChanges(bairro || "MANAUS"),
    });
  });
}
