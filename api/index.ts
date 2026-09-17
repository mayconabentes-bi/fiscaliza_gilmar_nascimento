import express from "express";
import { createApp } from "../src/server/app.js";

let app;

try {
  app = createApp();
} catch (error) {
  console.error("Falha ao inicializar API:", error);
  app = express();
  app.disable("x-powered-by");
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "Serviço temporariamente indisponível.",
      code: "API_STARTUP_FAILED",
    });
  });
}

export default app;
