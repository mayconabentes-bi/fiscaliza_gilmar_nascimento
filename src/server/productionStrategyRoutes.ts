import type { Express } from "express";
import { strategy2028 } from "./strategyRoutes.js";

export function setupProductionStrategyRoutes(app: Express) {
  app.get("/api/admin/strategy/2028", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.json(strategy2028);
  });
}
