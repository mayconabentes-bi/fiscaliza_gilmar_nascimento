import type { Express } from "express";

const CEP_RE = /^\d{8}$/;
const IBGE_RE = /^\d{7}$/;
const UF_RE = /^[A-Z]{2}$/;
const DEFAULT_VIACEP_BASE = "https://viacep.com.br/ws";
const DEFAULT_BRASILAPI_BASE = "https://brasilapi.com.br/api/cep/v1";
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const PRIMARY_PROVIDER_TIMEOUT_MS = 2000;

type CepProvider = "viacep" | "brasilapi";
type ProviderFailureCode = "not_found" | "transient" | "invalid_response" | "unexpected_status";

export type CepLookupPayload = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigo_ibge: string;
};

export class CepLookupError extends Error {
  readonly code: "invalid_request" | "not_found" | "unavailable";

  constructor(code: "invalid_request" | "not_found" | "unavailable") {
    super(code);
    this.name = "CepLookupError";
    this.code = code;
  }
}

class ProviderFailure extends Error {
  readonly code: ProviderFailureCode;
  readonly provider: CepProvider;

  constructor(code: ProviderFailureCode, provider: CepProvider) {
    super(`${provider}:${code}`);
    this.name = "ProviderFailure";
    this.code = code;
    this.provider = provider;
  }
}

function normalizedCep(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function lookupTimeoutMs() {
  const configured = Number(process.env.CEP_LOOKUP_TIMEOUT_MS || 4500);
  return Number.isFinite(configured) && configured >= 1500 && configured <= 8000 ? configured : 4500;
}

function controlledProviderBase(candidate: string | undefined, fallback: string, expectedHost: string) {
  try {
    const url = new URL(candidate || fallback);
    if (
      url.protocol !== "https:" ||
      url.hostname !== expectedHost ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return fallback;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function viaCepBase() {
  return controlledProviderBase(process.env.VIACEP_API_BASE, DEFAULT_VIACEP_BASE, "viacep.com.br");
}

function brasilApiBase() {
  return controlledProviderBase(process.env.BRASILAPI_CEP_BASE, DEFAULT_BRASILAPI_BASE, "brasilapi.com.br");
}

function providerUrl(provider: CepProvider, cep: string) {
  return provider === "viacep"
    ? `${viaCepBase()}/${cep}/json/`
    : `${brasilApiBase()}/${cep}`;
}

async function readLimitedJson(response: Response, provider: CepProvider) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new ProviderFailure("invalid_response", provider);
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new ProviderFailure("invalid_response", provider);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ProviderFailure("invalid_response", provider);
    }
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ProviderFailure("invalid_response", provider);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(merged)) as Record<string, unknown>;
  } catch {
    throw new ProviderFailure("invalid_response", provider);
  }
}

function normalizeProviderPayload(provider: CepProvider, requestedCep: string, data: Record<string, unknown>) {
  if (provider === "viacep" && (data.erro === true || data.erro === "true")) {
    throw new ProviderFailure("not_found", provider);
  }

  const returnedCep = normalizedCep(data.cep);
  if (returnedCep && returnedCep !== requestedCep) {
    throw new ProviderFailure("invalid_response", provider);
  }

  const ibgeValue = provider === "viacep"
    ? data.ibge
    : (data.ibge && typeof data.ibge === "object"
      ? (data.ibge as Record<string, unknown>).city
      : "");

  const payload: CepLookupPayload = {
    cep: returnedCep
      ? `${returnedCep.slice(0, 5)}-${returnedCep.slice(5)}`
      : `${requestedCep.slice(0, 5)}-${requestedCep.slice(5)}`,
    logradouro: safeText(provider === "viacep" ? data.logradouro : data.street, 180),
    complemento: safeText(provider === "viacep" ? data.complemento : "", 180),
    bairro: safeText(provider === "viacep" ? data.bairro : data.neighborhood, 160),
    municipio: safeText(provider === "viacep" ? data.localidade : data.city, 120),
    uf: safeText(provider === "viacep" ? data.uf : data.state, 2).toUpperCase(),
    codigo_ibge: safeText(ibgeValue, 16),
  };

  if (
    !payload.municipio ||
    !UF_RE.test(payload.uf) ||
    (payload.codigo_ibge && !IBGE_RE.test(payload.codigo_ibge))
  ) {
    throw new ProviderFailure("invalid_response", provider);
  }

  return payload;
}

async function requestProvider(
  provider: CepProvider,
  cep: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const response = await fetchImpl(providerUrl(provider, cep), {
      headers: {
        Accept: "application/json",
        "User-Agent": "FiscalizaGilmarNascimento/cep-lookup",
      },
      redirect: "error",
      signal: controller.signal,
    });

    if (response.status === 404) throw new ProviderFailure("not_found", provider);
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new ProviderFailure("transient", provider);
    }
    if (!response.ok) throw new ProviderFailure("unexpected_status", provider);

    const data = await readLimitedJson(response, provider);
    return normalizeProviderPayload(provider, cep, data);
  } catch (error: unknown) {
    if (error instanceof ProviderFailure) throw error;
    throw new ProviderFailure("transient", provider);
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupCepWithProviders(
  value: unknown,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    primaryTimeoutMs?: number;
  } = {},
) {
  const cep = normalizedCep(value);
  if (!CEP_RE.test(cep)) throw new CepLookupError("invalid_request");

  const fetchImpl = options.fetchImpl || fetch;
  const totalTimeoutMs = Math.max(50, options.timeoutMs ?? lookupTimeoutMs());
  const deadline = Date.now() + totalTimeoutMs;
  const primaryTimeoutMs = Math.min(
    Math.max(1, options.primaryTimeoutMs ?? PRIMARY_PROVIDER_TIMEOUT_MS),
    totalTimeoutMs,
  );

  try {
    return await requestProvider("viacep", cep, primaryTimeoutMs, fetchImpl);
  } catch (error: unknown) {
    const failure = error instanceof ProviderFailure ? error : null;
    if (failure?.code === "not_found") throw new CepLookupError("not_found");
    if (failure?.code === "unexpected_status") throw new CepLookupError("unavailable");
  }

  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new CepLookupError("unavailable");

  try {
    return await requestProvider("brasilapi", cep, remainingMs, fetchImpl);
  } catch (error: unknown) {
    const failure = error instanceof ProviderFailure ? error : null;
    if (failure?.code === "not_found") throw new CepLookupError("not_found");
    throw new CepLookupError("unavailable");
  }
}

export function setupCepLookup(app: Express) {
  app.get("/api/localizacao/cep/:cep", async (req, res) => {
    const cep = normalizedCep(req.params.cep);
    if (!CEP_RE.test(cep)) {
      return res.status(400).json({ error: "Informe um CEP válido com 8 dígitos." });
    }

    try {
      const payload = await lookupCepWithProviders(cep);
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      return res.json(payload);
    } catch (error: unknown) {
      const code = error instanceof CepLookupError ? error.code : "unavailable";
      if (code === "not_found") {
        return res.status(404).json({ error: "CEP não encontrado." });
      }
      console.warn("Falha na consulta de CEP:", code);
      return res.status(503).json({
        error: "Consulta de CEP temporariamente indisponível. Você pode informar a localização manualmente.",
      });
    }
  });
}
