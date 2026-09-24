import { manausPublicEntities } from "./manausPublicEntities.js";
import type { SourceEnvelope } from "./types.js";

const PNCP_BASE = process.env.PNCP_API_URL || "https://pncp.gov.br/api/consulta/v1";

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

function collection(payload: any) {
  for (const key of ["data", "items", "results", "contratos"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return Array.isArray(payload) ? payload : [];
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, "").replace(/^\)\]\}',?\s*/, "").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(raw: string | null): number | null {
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const absolute = Date.parse(raw);
  return Number.isFinite(absolute) ? Math.max(0, absolute - Date.now()) : null;
}

async function fetchJson(url: string, timeoutMs = 18000, attempts = 3) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let delayMs = Math.min(4000, 400 * 2 ** (attempt - 1));
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "PulsoIntelligence/2.2" },
      });
      const text = await response.text();
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`HTTP ${response.status}: ${text.slice(0, 160).replace(/\\s+/g, " ")}`);
        lastError = error;
        // Credenciais/parâmetros incorretos não devem ser disfarçados como falha temporária.
        if (!retryable) break;
        if (attempt === attempts) throw error;

        if (response.status === 429) {
          const advisedMs = retryAfterMs(response.headers.get("retry-after"));
          // Evita manter requisições web presas por longos períodos. Não antecipar
          // um Retry-After superior ao orçamento: reportar indisponibilidade.
          if (advisedMs !== null && advisedMs > 30000) {
            lastError = new Error(`HTTP 429: Retry-After de ${Math.ceil(advisedMs / 1000)} s; consulta adiada`);
            break;
          }
          delayMs = Math.max(Math.min(12000, 2000 * 2 ** (attempt - 1)), advisedMs ?? 0);
        }
      } else {
        const normalized = normalizeJsonText(text);
        if (!normalized) {
          const error = new Error("PNCP respondeu com corpo vazio");
          if (attempt === attempts) throw error;
          lastError = error;
        } else {
          try {
            return JSON.parse(normalized);
          } catch {
            const error = new Error(`PNCP respondeu JSON inválido: ${normalized.slice(0, 120).replace(/\\s+/g, " ")}`);
            if (attempt === attempts) throw error;
            lastError = error;
          }
        }
      }
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("Falha ao consultar PNCP");
      lastError = normalizedError;
      if (attempt === attempts) throw normalizedError;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw lastError || new Error("Falha ao consultar PNCP");
}

function contractIdentity(row: any) {
  const control = String(row?.numeroControlePNCP || "").trim();
  if (control) return control;
  return [
    digits(row?.orgaoEntidade?.cnpj ?? row?.cnpjOrgao ?? row?.cadastroCnpj),
    String(row?.numeroContratoEmpenho ?? row?.numeroContrato ?? "").trim(),
    String(row?.dataAssinatura ?? "").trim(),
  ].join("|");
}

export async function loadPncpManausContracts(year = new Date().getFullYear()): Promise<SourceEnvelope<any[]>> {
  const source = "pncp_manaus_cnpjs";
  const entries = manausPublicEntities().filter((item) => item.ativo);
  const maxPages = Math.min(50, Math.max(1, Number(process.env.PNCP_MAX_PAGES_PER_ENTITY || 15)));
  const pageSize = Math.min(100, Math.max(10, Number(process.env.PNCP_PAGE_SIZE || 100)));
  const timeoutMs = Math.min(60000, Math.max(5000, Number(process.env.PNCP_TIMEOUT_MS || 18000)));
  const attempts = Math.min(5, Math.max(1, Number(process.env.PNCP_RETRY_ATTEMPTS || 3)));
  const requestGapMs = Math.min(5000, Math.max(0, Number(process.env.PNCP_REQUEST_GAP_MS ?? 500)));
  const start = `${year}0101`;
  const now = new Date();
  const end = year === now.getFullYear()
    ? `${year}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
    : `${year}1231`;

  // Um órgão por vez evita bursts de requisições ao PNCP.
  const results = [];
  for (const entry of entries) {
    if (results.length && requestGapMs) await sleep(requestGapMs);
    const result = await (async () => {
    const rows: any[] = [];
    let total = 0;
    let truncated = false;
    let completedPages = 0;
    let failedPage: number | null = null;
    let errorMessage: string | null = null;

    for (let page = 1; page <= maxPages; page += 1) {
      if (page > 1 && requestGapMs) await sleep(requestGapMs);
      const url = new URL(`${PNCP_BASE}/contratos`);
      url.searchParams.set("dataInicial", start);
      url.searchParams.set("dataFinal", end);
      url.searchParams.set("cnpjOrgao", entry.cnpj);
      url.searchParams.set("pagina", String(page));
      url.searchParams.set("tamanhoPagina", String(pageSize));
      try {
        const payload: any = await fetchJson(url.toString(), timeoutMs, attempts);
        const pageRows = collection(payload);
        completedPages = page;
        if (page === 1) {
          const reported = Number(payload?.totalRegistros ?? payload?.totalItens ?? payload?.total ?? payload?.count ?? pageRows.length);
          total = Number.isFinite(reported) ? Math.max(0, reported) : pageRows.length;
        }
        rows.push(...pageRows.map((item: any) => ({ ...item, cadastroKey: entry.key, cadastroNome: entry.nome, cadastroCnpj: entry.cnpj })));
        const totalPages = Number(payload?.totalPaginas ?? payload?.totalPages ?? payload?.paginas ?? 1);
        if (!pageRows.length || page >= totalPages) break;
        if (page === maxPages && totalPages > maxPages) truncated = true;
      } catch (error) {
        failedPage = page;
        errorMessage = error instanceof Error ? error.message : "falha";
        break;
      }
    }

    return {
      entry,
      rows,
      total: Math.max(total, rows.length),
      truncated,
      completedPages,
      failedPage,
      error: errorMessage,
    };
    })();
    results.push(result);
  }

  const byId = new Map<string, any>();
  for (const result of results) {
    for (const row of result.rows) {
      const key = contractIdentity(row);
      if (!byId.has(key)) byId.set(key, row);
    }
  }

  const failures = results.filter((result) => result.error);
  const empty = results.filter((result) => !result.error && !result.rows.length);
  const reportedTotal = results.reduce((sum, result) => sum + result.total, 0);
  const completedEntities = results.filter((result) => !result.error).length;
  const truncated = results.some((result) => result.truncated);

  const data = [...byId.values()].map((row: any) => ({
    id: row?.numeroControlePNCP || row?.numeroContratoEmpenho || row?.numeroContrato || null,
    numero: row?.numeroContratoEmpenho || row?.numeroContrato || null,
    objeto: row?.objetoContrato || row?.objetoCompra || row?.objeto || null,
    valorInicial: numberValue(row?.valorInicial ?? row?.valorGlobal ?? row?.valorTotal),
    valorParcelas: numberValue(row?.valorParcelas),
    dataAssinatura: row?.dataAssinatura || null,
    vigenciaInicio: row?.dataVigenciaInicio || null,
    vigenciaFim: row?.dataVigenciaFim || null,
    fornecedorNome: row?.nomeRazaoSocialFornecedor || row?.fornecedor?.nomeRazaoSocial || null,
    fornecedorDocumento: digits(row?.niFornecedor ?? row?.fornecedor?.niFornecedor) || null,
    cadastroKey: row.cadastroKey,
    cadastroNome: row.cadastroNome,
    cadastroCnpj: row.cadastroCnpj,
    raw: row,
  }));

  const availability = failures.length === entries.length && !data.length
    ? "unavailable"
    : data.length
      ? (failures.length || truncated ? "degraded" : "available")
      : "degraded";

  const notes = [
    failures.length
      ? `Falhas parciais: ${failures.slice(0, 8).map((item) => `${item.entry.sigla || item.entry.nome} página ${item.failedPage ?? "?"}: ${item.error}`).join(" | ")}`
      : "",
    empty.length ? `Sem contratos no período: ${empty.map((item) => item.entry.sigla || item.entry.nome).join(", ")}` : "",
    truncated ? `Uma ou mais consultas excederam o limite de ${maxPages} páginas.` : "",
    reportedTotal > data.length ? `Deduplicação/cobertura: ${data.length} contratos únicos para ${reportedTotal} registros reportados/somados pelas consultas.` : "",
  ].filter(Boolean);

  return {
    source,
    availability,
    provenance: {
      source,
      sourceUrl: `${PNCP_BASE}/contratos`,
      fetchedAt: new Date().toISOString(),
      referencePeriod: String(year),
    },
    quality: {
      total: data.length,
      classified: data.length,
      unclassified: 0,
      coverage: entries.length ? completedEntities / entries.length : 0,
      truncated,
    },
    data,
    ...(notes.length ? { error: notes.join(" ") } : {}),
  };
}
