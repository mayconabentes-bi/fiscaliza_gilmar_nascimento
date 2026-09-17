import type { SourceEnvelope } from "./types.js";

const MANAUS_IBGE = 1302603;
const MANAUS_IBGE_SIX = 130260;
const MANAUS_CNPJ = "04365326000173";
const IBGE_POPULATION_URL = process.env.IBGE_POPULATION_API_URL || `https://apisidra.ibge.gov.br/values/t/6579/n6/${MANAUS_IBGE}/v/9324/p/last%201?formato=json`;
const SICONFI_BASE = process.env.SICONFI_API_URL || "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const PNCP_BASE = process.env.PNCP_API_URL || "https://pncp.gov.br/api/consulta/v1";
const CNES_DATASUS_API_URL = process.env.CNES_DATASUS_API_URL || process.env.CNES_DATASUS_CATALOG_URL || "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const INEP_CENSO_ESCOLAR_API_URL = process.env.INEP_CENSO_ESCOLAR_API_URL || "";
const OBRASGOV_BASE = process.env.OBRASGOV_API_URL || "https://api-publica.obrasgov.gestao.gov.br/obras";

function quality(total: number, classified = total, truncated = false) {
  const safeTotal = Math.max(0, total);
  const safeClassified = Math.max(0, Math.min(classified, safeTotal));
  return { total: safeTotal, classified: safeClassified, unclassified: Math.max(0, safeTotal - safeClassified), coverage: safeTotal ? safeClassified / safeTotal : 1, truncated };
}

function parseJsonText(text: string) {
  const normalized = String(text || "").replace(/^\uFEFF/, "").replace(/^\)\]\}',?\s*/, "").trim();
  if (!normalized) return null;
  try { return JSON.parse(normalized); }
  catch {
    const preview = normalized.slice(0, 180).replace(/\s+/g, " ");
    throw new Error(`Resposta JSON inválida: ${preview}`);
  }
}

async function fetchJson(url: string, timeoutMs = 20000, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "PulsoIntelligence/1.0", ...headers } });
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!response.ok) {
      const preview = text.slice(0, 180).replace(/\s+/g, " ");
      throw new Error(`HTTP ${response.status}${preview ? `: ${preview}` : ""}`);
    }
    if (!contentType.toLowerCase().includes("json")) throw new Error(`Resposta não JSON (${contentType || "content-type ausente"}): ${text.slice(0, 180).replace(/\s+/g, " ")}`);
    return parseJsonText(text);
  } finally { clearTimeout(timer); }
}

function unavailable(source: string, sourceUrl: string, error: unknown): SourceEnvelope<any[]> {
  return { source, availability: "unavailable", provenance: { source, sourceUrl, fetchedAt: new Date().toISOString() }, quality: quality(0), data: [], error: error instanceof Error ? error.message : "Fonte indisponível" };
}

function notConfigured(source: string, sourceUrl: string, message: string): SourceEnvelope<any[]> {
  return { source, availability: "not_configured", provenance: { source, sourceUrl, fetchedAt: new Date().toISOString() }, quality: quality(0), data: [], error: message };
}

function collectionFromPayload(payload: any, keys: string[]) {
  for (const key of keys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(payload)) return payload;
  if (payload?.data && typeof payload.data === "object") {
    for (const key of keys) {
      const value = payload.data?.[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export async function loadIbgePopulation(): Promise<SourceEnvelope<any[]>> {
  const source = "ibge_populacao";
  try {
    const payload = await fetchJson(IBGE_POPULATION_URL);
    const rows = Array.isArray(payload) ? payload.slice(1) : [];
    const data = rows.map((row: any) => ({ municipio: row?.D1N || "Manaus", codIbge: MANAUS_IBGE, periodo: String(row?.D3N || row?.D2N || ""), populacao: Number(String(row?.V || "").replace(/\./g, "").replace(",", ".")), unidade: row?.MN || "Pessoas" })).filter((row: any) => Number.isFinite(row.populacao));
    return { source, availability: data.length ? "available" : "degraded", provenance: { source, sourceUrl: IBGE_POPULATION_URL, fetchedAt: new Date().toISOString(), referencePeriod: data[0]?.periodo || undefined }, quality: quality(Math.max(rows.length, data.length), data.length), data, ...(data.length ? {} : { error: "IBGE respondeu sem valor populacional normalizável para Manaus." }) };
  } catch (error) { return unavailable(source, IBGE_POPULATION_URL, error); }
}

export async function loadSiconfi(year = new Date().getFullYear() - 1): Promise<SourceEnvelope<any[]>> {
  const source = "siconfi_dca";
  const url = new URL(`${SICONFI_BASE}/dca`);
  url.searchParams.set("an_exercicio", String(year));
  url.searchParams.set("id_ente", String(MANAUS_IBGE));
  try {
    const payload: any = await fetchJson(url.toString(), 30000);
    const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
    return { source, availability: rows.length ? "available" : "degraded", provenance: { source, sourceUrl: url.toString(), fetchedAt: new Date().toISOString(), referencePeriod: String(year) }, quality: quality(rows.length), data: rows, ...(rows.length ? {} : { error: "SICONFI respondeu sem itens para o exercício consultado." }) };
  } catch (error) { return unavailable(source, url.toString(), error); }
}

export async function loadPncpContracts(year = new Date().getFullYear()): Promise<SourceEnvelope<any[]>> {
  const source = "pncp_contratos";
  const rows: any[] = [];
  let total = 0;
  const start = `${year}0101`;
  const today = new Date();
  const currentYear = today.getFullYear();
  const end = year === currentYear
    ? `${year}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    : `${year}1231`;
  try {
    for (let page = 1; page <= 20; page += 1) {
      const url = new URL(`${PNCP_BASE}/contratos`);
      url.searchParams.set("dataInicial", start);
      url.searchParams.set("dataFinal", end);
      url.searchParams.set("cnpjOrgao", MANAUS_CNPJ);
      url.searchParams.set("pagina", String(page));
      url.searchParams.set("tamanhoPagina", "100");
      const payload: any = await fetchJson(url.toString(), 20000);
      const pageRows = collectionFromPayload(payload, ["data", "items", "results", "contratos"]);
      const reportedTotal = payload?.totalRegistros ?? payload?.totalItens ?? payload?.total ?? payload?.count ?? null;
      total = Number(reportedTotal != null ? reportedTotal : Math.max(total, rows.length + pageRows.length));
      rows.push(...pageRows);
      const totalPages = Number(payload?.totalPaginas ?? payload?.totalPages ?? payload?.paginas ?? 1);
      if (!pageRows.length || page >= totalPages) break;
    }
    const truncated = Boolean(total && rows.length < total);
    return {
      source,
      availability: rows.length ? (truncated ? "degraded" : "available") : "degraded",
      provenance: { source, sourceUrl: `${PNCP_BASE}/contratos?cnpjOrgao=${MANAUS_CNPJ}`, fetchedAt: new Date().toISOString(), referencePeriod: String(year) },
      quality: quality(total || rows.length, rows.length, truncated),
      data: rows,
      ...(rows.length ? (truncated ? { error: `Consulta limitada a ${rows.length} de ${total} contratos do Município de Manaus no ciclo atual.` } : {}) : { error: "PNCP respondeu sem contratos normalizáveis para o Município de Manaus no período consultado." }),
    };
  } catch (error) { return unavailable(source, `${PNCP_BASE}/contratos?cnpjOrgao=${MANAUS_CNPJ}`, error); }
}

export async function loadCnesDataSusCatalog(): Promise<SourceEnvelope<any[]>> {
  const source = "cnes_datasus_catalogo";
  const url = new URL(CNES_DATASUS_API_URL);
  url.searchParams.set("codigo_municipio", String(MANAUS_IBGE_SIX));
  url.searchParams.set("status", "1");
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", "0");
  const token = process.env.CNES_DATASUS_API_TOKEN || "";
  try {
    const payload: any = await fetchJson(url.toString(), 20000, token ? { Authorization: `Bearer ${token}` } : {});
    const rows = collectionFromPayload(payload, ["data", "results", "items", "estabelecimentos", "records"]);
    const total = Number(payload?.count ?? payload?.total ?? payload?.totalRegistros ?? payload?.quantidade ?? rows.length);
    const truncated = total > rows.length;
    return {
      source,
      availability: rows.length ? (truncated ? "degraded" : "available") : "degraded",
      provenance: { source, sourceUrl: url.toString(), fetchedAt: new Date().toISOString() },
      quality: quality(total || rows.length, rows.length, truncated),
      data: rows,
      ...(rows.length ? (truncated ? { error: `CNES retornou ${rows.length} de ${total} estabelecimentos ativos no recorte atual.` } : {}) : { error: "CNES respondeu sem estabelecimentos normalizáveis para Manaus; revisar o envelope retornado pela API." }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar CNES";
    if (/HTTP 401|HTTP 403/.test(message) && !token) {
      return notConfigured(source, "https://dados.gov.br/dados/conjuntos-dados/cnes-cadastro-nacional-de-estabelecimentos-de-saude", "A API CNES respondeu exigindo autenticação. Configure CNES_DATASUS_API_TOKEN para habilitar a consulta direta; o GeoManaus continua fornecendo a camada municipal de unidades de saúde.");
    }
    return unavailable(source, url.toString(), error);
  }
}

export async function loadInepCensoEscolar(): Promise<SourceEnvelope<any[]>> {
  const source = "inep_censo_escolar";
  if (!INEP_CENSO_ESCOLAR_API_URL) return notConfigured(source, "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar", "INEP publica o Censo Escolar principalmente como microdados. Configure INEP_CENSO_ESCOLAR_API_URL apenas quando houver um endpoint JSON estável ou serviço próprio de ingestão.");
  try {
    const payload: any = await fetchJson(INEP_CENSO_ESCOLAR_API_URL, 30000);
    const rows = collectionFromPayload(payload, ["data", "results", "items", "records"]);
    return { source, availability: rows.length ? "available" : "degraded", provenance: { source, sourceUrl: INEP_CENSO_ESCOLAR_API_URL, fetchedAt: new Date().toISOString() }, quality: quality(rows.length), data: rows, ...(rows.length ? {} : { error: "INEP respondeu sem registros normalizáveis." }) };
  } catch (error) { return unavailable(source, INEP_CENSO_ESCOLAR_API_URL, error); }
}

export async function loadObrasGovProjectEnrichment(projectId: string) {
  const safeId = String(projectId || "").trim().slice(0, 160);
  if (!safeId) throw new Error("id_projeto_investimento obrigatório");
  const endpoints = ["execucao-fisica", "contrato", "empenho", "historico-situacao-cancelada-paralisada", "data-atualizacao"];
  const result: Record<string, any> = {};
  await Promise.all(endpoints.map(async (endpoint) => {
    const url = new URL(`${OBRASGOV_BASE}/${endpoint}`);
    url.searchParams.set("id_projeto_investimento", safeId);
    url.searchParams.set("pagina", "1");
    url.searchParams.set("tamanho_da_pagina", "100");
    try { result[endpoint] = await fetchJson(url.toString(), 30000); }
    catch (error) { result[endpoint] = { error: error instanceof Error ? error.message : "Falha ao consultar endpoint" }; }
  }));
  return { source: "obrasgov_detalhes", projectId: safeId, fetchedAt: new Date().toISOString(), sourceUrl: `${OBRASGOV_BASE}/projeto-investimento?id_projeto_investimento=${encodeURIComponent(safeId)}`, ...result };
}

export async function loadExpansionSources() {
  const [ibge, siconfi, pncp, cnes, inep] = await Promise.all([loadIbgePopulation(), loadSiconfi(), loadPncpContracts(), loadCnesDataSusCatalog(), loadInepCensoEscolar()]);
  return { ibge, siconfi, pncp, cnes, inep };
}
