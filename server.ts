import express from "express";
import { createServer as createViteServer } from "vite";
import { createApp } from "./src/server/app.js";
import { startIntelligenceRefreshScheduler } from "./src/intelligence/refresh.js";

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => res.sendFile("dist/index.html", { root: "." }));
  }

  startIntelligenceRefreshScheduler();
  app.listen(port, "0.0.0.0", () => console.log(`Server running on http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error("Falha fatal ao iniciar servidor:", error);
  process.exit(1);
});
