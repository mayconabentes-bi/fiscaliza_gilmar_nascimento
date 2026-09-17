import type { Express } from "express";
import { aggregateTerritories } from "./analytics.js";
import {
  historicalSeries,
  loadInepMicrodataFile,
  loadTceFinancialPortfolio,
  territorialQuality,
} from "./advancedIntelligence.js";
import { loadCnesManausFull } from "./cnesFull.js";
import { fiscalOverview } from "./fiscalEngine.js";
import { financialCrosswalk } from "./financialCrosswalk.js";
import { manausPublicEntities } from "./manausPublicEntities.js";
import { loadPncpManausContracts } from "./pncpManaus.js";
import { loadHealthUnits, loadMunicipalWorks, loadNeighborhoods, loadSchools } from "./sources.js";

function yearParam(value: unknown, fallback = new Date().getFullYear()) {
  const text = String(value || "");
  return /^20\d{2}$/.test(text) ? Number(text) : fallback;
}

export function setupAdvancedIntelligenceRoutes(app: Express) {
  app.get("/api/intelligence/institutions", (_req, res) => {
    const institutions = manausPublicEntities();
    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      generatedAt: new Date().toISOString(),
      total: institutions.length,
      institutions,
      methodology: "Cadastro de CNPJs públicos usados nas consultas ao PNCP. A lista padrão inclui entidades de Manaus verificadas no próprio PNCP e pode ser ampliada por configuração auditável.",
    });
  });

  app.get("/api/intelligence/contracts/institutional", async (req, res) => {
    const year = yearParam(req.query.year);
    const source = await loadPncpManausContracts(year);
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/fiscal/overview", async (req, res) => {
    const year = yearParam(req.query.year, new Date().getFullYear() - 1);
    res.json(await fiscalOverview(year));
  });

  app.get("/api/intelligence/health/cnes", async (_req, res) => {
    const source = await loadCnesManausFull();
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/education/inep", (_req, res) => {
    const source = loadInepMicrodataFile();
    res.status(source.availability === "unavailable" ? 500 : 200).json(source);
  });

  app.get("/api/intelligence/tce/portfolio", async (req, res) => {
    const year = yearParam(req.query.year);
    const source = await loadTceFinancialPortfolio(year);
    res.status(source.availability === "unavailable" ? 502 : 200).json(source);
  });

  app.get("/api/intelligence/financial-crosswalk", async (req, res) => {
    const year = yearParam(req.query.year);
    res.json(await financialCrosswalk(year));
  });

  app.get("/api/intelligence/quality/territorial", async (_req, res) => {
    const [neighborhoods, works, health, schools] = await Promise.all([
      loadNeighborhoods(),
      loadMunicipalWorks(),
      loadHealthUnits(),
      loadSchools(),
    ]);
    const territories = neighborhoods.data.length
      ? aggregateTerritories({ neighborhoods: neighborhoods.data, works: works.data, health: health.data, schools: schools.data })
      : [];
    res.json({
      generatedAt: new Date().toISOString(),
      ...territorialQuality({
        raw: { works: works.data, health: health.data, schools: schools.data },
        territories,
      }),
    });
  });

  app.get("/api/intelligence/series", (req, res) => {
    const metric = typeof req.query.metric === "string" ? req.query.metric.slice(0, 120) : undefined;
    const territory = typeof req.query.territory === "string" ? req.query.territory.slice(0, 160) : "MANAUS";
    const granularity = ["daily", "weekly", "monthly", "yearly"].includes(String(req.query.granularity))
      ? String(req.query.granularity) as "daily" | "weekly" | "monthly" | "yearly"
      : "monthly";
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ metric: metric || null, territory, granularity, series: historicalSeries(metric, territory, granularity) });
  });
}
