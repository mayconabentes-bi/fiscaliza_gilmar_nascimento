import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CepLookupError, lookupCepWithProviders } from "../../../src/server/cepLookup.js";

function normalizedCep(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const cep = normalizedCep(req.query.cep);
  if (!/^\d{8}$/.test(cep)) {
    return res.status(400).json({ error: "Informe um CEP válido com 8 dígitos." });
  }

  try {
    const payload = await lookupCepWithProviders(cep);
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).json(payload);
  } catch (error: unknown) {
    const code = error instanceof CepLookupError ? error.code : "unavailable";
    if (code === "not_found") {
      return res.status(404).json({ error: "CEP não encontrado." });
    }

    console.warn("Falha na consulta de CEP via Vercel:", code);
    return res.status(503).json({
      error: "Consulta de CEP temporariamente indisponível. Você pode informar a localização manualmente.",
    });
  }
}
