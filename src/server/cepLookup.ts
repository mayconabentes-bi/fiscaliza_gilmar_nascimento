import type { Express } from "express";

const CEP_RE = /^\d{8}$/;
const DEFAULT_VIACEP_BASE = "https://viacep.com.br/ws";

function normalizedCep(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function lookupTimeoutMs() {
  const configured = Number(process.env.CEP_LOOKUP_TIMEOUT_MS || 4000);
  return Number.isFinite(configured) && configured >= 1000 && configured <= 10000 ? configured : 4000;
}

function viaCepBase() {
  return (process.env.VIACEP_API_BASE || DEFAULT_VIACEP_BASE).replace(/\/+$/, "");
}

export function setupCepLookup(app: Express) {
  app.get("/api/localizacao/cep/:cep", async (req, res) => {
    const cep = normalizedCep(req.params.cep);
    if (!CEP_RE.test(cep)) {
      return res.status(400).json({ error: "Informe um CEP válido com 8 dígitos." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), lookupTimeoutMs());

    try {
      const response = await fetch(`${viaCepBase()}/${cep}/json/`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`VIACEP_HTTP_${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      if (data.erro === true || data.erro === "true") {
        return res.status(404).json({ error: "CEP não encontrado." });
      }

      const payload = {
        cep: safeText(data.cep, 9) || `${cep.slice(0, 5)}-${cep.slice(5)}`,
        logradouro: safeText(data.logradouro, 180),
        complemento: safeText(data.complemento, 180),
        bairro: safeText(data.bairro, 160),
        municipio: safeText(data.localidade, 120),
        uf: safeText(data.uf, 2).toUpperCase(),
        codigo_ibge: safeText(data.ibge, 16),
      };

      if (!payload.municipio || !payload.uf) {
        throw new Error("VIACEP_INCOMPLETE_RESPONSE");
      }

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      return res.json(payload);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.warn("Falha na consulta de CEP:", error?.message || error);
      }
      return res.status(503).json({
        error: "Consulta de CEP temporariamente indisponível. Você pode informar a localização manualmente.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
