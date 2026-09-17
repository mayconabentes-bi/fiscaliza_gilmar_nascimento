import { collectionFrom, coordinatesFrom, neighborhoodValue, normalizeText, pickField } from "./normalization.js";
import type { SourceEnvelope } from "./types.js";

const ARCGIS_CCC = "https://pmm.manaus.am.gov.br/arcgis/rest/services/CCC/CAMADAS_CCC_2025/FeatureServer";
const ARCGIS_OBRAS = "https://pmm.manaus.am.gov.br/arcgis/rest/services/PORTAL_TRANSPARENCIA/SEMINF_OBRAS_PORTAL_CIDADAO_SRGS/MapServer";
const SAPL_BASE = process.env.CMM_SAPL_API_BASE || "https://sapl.cmm.am.gov.br/api";
const OBRASGOV_BASE = process.env.OBRASGOV_API_URL || "https://api-publica.obrasgov.gestao.gov.br/obras";
const OBRASGOV_DOCS = "https://api-publica.obrasgov.gestao.gov.br/obras/docs";
const TCE_AM_BASE = process.env.TCE_AM_API_URL || "https://econtasapi.tce.am.gov.br";
const TCE_AM_DOCS = "https://transparencia-new.tceam.tc.br/dadosAbertos";
const MANAUS_IBGE = 1302603;

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: any }>();
let tceTokenCache: { token: string; expiresAt: number } | null = null;

async function fetchJson(
  url: string,
  options: { timeoutMs?: number; method?: string; headers?: Record<string, string>; body?: string; cache?: boolean } = {},
) {
  const method = options.method || "GET";
  const useCache = options.cache !== false && method === "GET";
  const key = `${method}:${url}`;
  const cached = useCache ? cache.get(key) : undefined;
  if (cached && cached.expiresAt > Date.now()) return { data: cached.value, fromCache: true };
  if (cached) cache.delete(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PulsoIntelligence/1.0",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      body: options.body,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (useCache) cache.set(key, { expiresAt: Date.now() + CACHE_TTL, value: data });
    return { data, fromCache: false };
  } finally { clearTimeout(timer); }
}

function quality(total: number, classified: number, truncated = false) {
  const unclassified = Math.max(0, total - classified);
  return { total, classified, unclassified, coverage: total ? classified / total : 1, truncated };
}

async function arcgisAll(service: string, layer: number, geometry = false, maxRecords = 20000) {
  const metadataUrl = `${service}/${layer}?f=json`;
  const meta = await fetchJson(metadataUrl);
  const metadata: any = meta.data;
  const objectIdField = metadata?.objectIdField || metadata?.objectIdFieldName || "OBJECTID";
  const pageSize = Math.min(Number(metadata?.maxRecordCount || 1000), 1000);
  const countParams = new URLSearchParams({ where: "1=1", returnCountOnly: "true", f: "json" });
  const count = await fetchJson(`${service}/${layer}/query?${countParams}`);
  const total = Number(count.data?.count || 0);
  const limit = Math.min(total || maxRecords, maxRecords);
  const features: any[] = [];
  let anyCache = meta.fromCache || count.fromCache;
  for (let offset = 0; offset < limit || (offset === 0 && total === 0); offset += pageSize) {
    const params = new URLSearchParams({
      where: "1=1", outFields: "*", returnGeometry: geometry ? "true" : "false", f: "json",
      resultOffset: String(offset), resultRecordCount: String(pageSize), orderByFields: `${objectIdField} ASC`,
    });
    if (geometry) params.set("outSR", "4326");
    const page = await fetchJson(`${service}/${layer}/query?${params}`);
    anyCache ||= page.fromCache;
    const rows = Array.isArray(page.data?.features) ? page.data.features : [];
    features.push(...rows);
    if (rows.length < pageSize || features.length >= maxRecords) break;
  }
  return { features: features.slice(0, maxRecords), total: total || features.length, truncated: total > features.length, fromCache: anyCache, sourceUpdatedAt: metadata?.editingInfo?.lastEditDate ? new Date(metadata.editingInfo.lastEditDate).toISOString() : null };
}

function arcgisEnvelope(source: string, sourceUrl: string, result: Awaited<ReturnType<typeof arcgisAll>>) : SourceEnvelope<any[]> {
  const classified = result.features.filter((feature) => neighborhoodValue(feature?.attributes || feature || {})).length;
  return {
    source,
    availability: result.truncated ? "degraded" : "available",
    provenance: { source, sourceUrl, fetchedAt: new Date().toISOString(), sourceUpdatedAt: result.sourceUpdatedAt, fromCache: result.fromCache },
    quality: quality(result.total, classified, result.truncated),
    data: result.features,
  };
}

export async function loadNeighborhoods() {
  const sourceUrl = `${ARCGIS_CCC}/3`;
  const result = await arcgisAll(ARCGIS_CCC, 3, true, 500);
  return arcgisEnvelope("geomanaus_bairros", sourceUrl, result);
}

export async function loadHealthUnits() {
  const sourceUrl = `${ARCGIS_CCC}/17`;
  return arcgisEnvelope("geomanaus_saude", sourceUrl, await arcgisAll(ARCGIS_CCC, 17, true));
}

export async function loadSchools() {
  const sourceUrl = `${ARCGIS_CCC}/20`;
  return arcgisEnvelope("geomanaus_escolas", sourceUrl, await arcgisAll(ARCGIS_CCC, 20, true));
}

export async function loadMunicipalWorks() {
  const sourceUrl = `${ARCGIS_OBRAS}/0`;
  return arcgisEnvelope("seminf_obras", sourceUrl, await arcgisAll(ARCGIS_OBRAS, 0, true));
}

export async function loadSapl(year = new Date().getFullYear()) : Promise<SourceEnvelope<any[]>> {
  const source = "cmm_sapl";
  const sourceUrl = `${SAPL_BASE}/materia/materialegislativa/`;
  const rows: any[] = [];
  let next: string | null = `${sourceUrl}?ano=${year}&page_size=100`;
  let fromCache = false;
  let declaredCount: number | null = null;
  for (let page = 0; next && page < 100; page += 1) {
    const response = await fetchJson(next);
    fromCache ||= response.fromCache;
    const data: any = response.data;
    const items = collectionFrom(data);
    rows.push(...items);
    if (typeof data?.count === "number") declaredCount = data.count;
    if (typeof data?.next === "string" && data.next) next = data.next;
    else if (declaredCount != null && rows.length < declaredCount && items.length) {
      const url = new URL(`${sourceUrl}?ano=${year}&page_size=100`);
      url.searchParams.set("page", String(page + 2));
      next = url.toString();
    } else next = null;
  }
  const total = declaredCount ?? rows.length;
  return {
    source,
    availability: rows.length < total ? "degraded" : "available",
    provenance: { source, sourceUrl, fetchedAt: new Date().toISOString(), referencePeriod: String(year), fromCache },
    quality: quality(total, rows.length, rows.length < total),
    data: rows,
  };
}

function genericNormalize(item: Record<string, unknown>) {
  const coords = coordinatesFrom(item);
  const amount = Number(pickField(item, ["valor", "valor_total", "valorPago", "valor_pago", "vl_total", "investimento"]));
  return {
    id: String(pickField(item, ["id", "codigo", "cod", "numero", "identificador"]) ?? ""),
    titulo: String(pickField(item, ["titulo", "nome", "descricao", "objeto", "obra", "programa"]) ?? ""),
    bairro: neighborhoodValue(item),
    municipio: String(pickField(item, ["municipio", "cidade", "nome_municipio", "nm_municipio"]) ?? ""),
    situacao: String(pickField(item, ["situacao", "status", "estado", "fase"]) ?? ""),
    valor: Number.isFinite(amount) ? amount : null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lon ?? null,
  };
}

function paginatedData(data: any) {
  return {
    rows: Array.isArray(data?.data) ? data.data : collectionFrom(data),
    totalItems: Number(data?.total_items ?? data?.count ?? 0),
    totalPages: Number(data?.total_pages ?? 1),
    pageNumber: Number(data?.page_number ?? 1),
  };
}

async function obrasGovManausGeometry(maxPages = 100) {
  const rows: any[] = [];
  let fromCache = false;
  let totalItems = 0;
  for (let pagina = 1; pagina <= maxPages; pagina += 1) {
    const url = new URL(`${OBRASGOV_BASE}/geometria`);
    url.searchParams.set("cod_ibge", String(MANAUS_IBGE));
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanho_da_pagina", "100");
    const response = await fetchJson(url.toString());
    fromCache ||= response.fromCache;
    const page = paginatedData(response.data);
    totalItems = page.totalItems || rows.length + page.rows.length;
    rows.push(...page.rows);
    if (pagina >= page.totalPages || page.rows.length === 0) break;
  }
  return { rows, totalItems: totalItems || rows.length, fromCache, truncated: rows.length < totalItems };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function normalizeObrasGovProject(project: any, geometry: any) {
  const pins = Array.isArray(project?.pins) ? project.pins : [];
  const pin = pins.find((item: any) => Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude))) || null;
  const investments = Array.isArray(project?.investimentos_previstos) ? project.investimentos_previstos : [];
  const valorPrevisto = investments.reduce((sum: number, item: any) => sum + (Number(item?.vl_investimento_previsto) || 0), 0);
  return {
    id: String(project?.id_projeto_investimento || geometry?.id_projeto_investimento || ""),
    titulo: String(project?.desc_nome || ""),
    descricao: String(project?.desc_projeto || ""),
    municipio: "Manaus",
    codIbge: Number(geometry?.cod_ibge || MANAUS_IBGE),
    situacao: String(project?.situacao || ""),
    natureza: String(project?.natureza_intervencao || ""),
    especie: String(project?.especie_intervencao || ""),
    organizacaoResponsavel: String(project?.organizacao_resp || ""),
    cnpjOrganizacaoResponsavel: String(project?.cnpj_organizacao_resp || ""),
    valorPrevisto: valorPrevisto || null,
    inicioPrevisto: project?.dt_inicial_prevista || null,
    fimPrevisto: project?.dt_final_prevista || null,
    inicioEfetivo: project?.dt_inicial_efetiva || null,
    fimEfetivo: project?.dt_final_efetiva || null,
    latitude: pin ? Number(pin.latitude) : null,
    longitude: pin ? Number(pin.longitude) : null,
    origemGeometria: geometry?.origem_geometria || null,
    sourceUrl: `${OBRASGOV_BASE}/projeto-investimento?id_projeto_investimento=${encodeURIComponent(String(project?.id_projeto_investimento || geometry?.id_projeto_investimento || ""))}`,
  };
}

export async function loadObrasGov(): Promise<SourceEnvelope<any[]>> {
  const source = "obrasgov";
  try {
    const geometry = await obrasGovManausGeometry();
    const byProject = new Map<string, any>();
    for (const item of geometry.rows) {
      const id = String(item?.id_projeto_investimento || "");
      if (id && !byProject.has(id)) byProject.set(id, item);
    }
    const ids = [...byProject.keys()];
    const projects = await mapWithConcurrency(ids, 5, async (id) => {
      try {
        const url = new URL(`${OBRASGOV_BASE}/projeto-investimento`);
        url.searchParams.set("id_projeto_investimento", id);
        url.searchParams.set("pagina", "1");
        url.searchParams.set("tamanho_da_pagina", "5");
        const response = await fetchJson(url.toString());
        return paginatedData(response.data).rows[0] || null;
      } catch { return null; }
    });
    const data = projects
      .map((project, index) => project ? normalizeObrasGovProject(project, byProject.get(ids[index])) : null)
      .filter(Boolean);
    const classified = data.filter((item: any) => item.codIbge === MANAUS_IBGE).length;
    return {
      source,
      availability: data.length < ids.length || geometry.truncated ? "degraded" : "available",
      provenance: { source, sourceUrl: `${OBRASGOV_BASE}/geometria?cod_ibge=${MANAUS_IBGE}`, fetchedAt: new Date().toISOString(), fromCache: geometry.fromCache },
      quality: quality(ids.length, classified, data.length < ids.length || geometry.truncated),
      data,
      ...(data.length < ids.length ? { error: `${ids.length - data.length} projeto(s) não puderam ser detalhados.` } : {}),
    };
  } catch (error: any) {
    return {
      source, availability: "unavailable",
      provenance: { source, sourceUrl: OBRASGOV_DOCS, fetchedAt: new Date().toISOString() },
      quality: quality(0, 0), data: [], error: error?.message || "Falha ao consultar ObrasGov",
    };
  }
}

function tceCredentialsConfigured() {
  return Boolean(
    process.env.TCE_AM_API_TOKEN ||
    (process.env.TCE_AM_CLIENT_ID && process.env.TCE_AM_USERNAME && process.env.TCE_AM_PASSWORD),
  );
}

async function tceToken() {
  if (process.env.TCE_AM_API_TOKEN) return process.env.TCE_AM_API_TOKEN;
  if (tceTokenCache && tceTokenCache.expiresAt > Date.now() + 60_000) return tceTokenCache.token;
  const clientId = process.env.TCE_AM_CLIENT_ID;
  const username = process.env.TCE_AM_USERNAME;
  const password = process.env.TCE_AM_PASSWORD;
  if (!clientId || !username || !password) return null;
  const response = await fetchJson(`${TCE_AM_BASE}/auth`, {
    method: "POST",
    cache: false,
    body: JSON.stringify({ client_id: clientId, username, password }),
  });
  const token = String(response.data?.access_token || "");
  if (!token) throw new Error("TCE-AM não retornou access_token");
  const expiresSeconds = Math.max(120, Number(response.data?.expires_in) || 900);
  tceTokenCache = { token, expiresAt: Date.now() + expiresSeconds * 1000 };
  return token;
}

async function tceGet(pathname: string) {
  const token = await tceToken();
  if (!token) throw new Error("Credenciais TCE-AM não configuradas");
  return fetchJson(`${TCE_AM_BASE}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
}

function normalizeTceWork(item: any, unit: any) {
  return {
    id: String(item?.idObra ?? ""),
    titulo: String(item?.bemPublico || item?.desTipoObra || ""),
    municipio: String(unit?.desMunicipio || ""),
    unidadeGestoraId: Number(item?.idUnidadeGestora || unit?.id_unidade_gestora || 0) || null,
    unidadeGestora: String(unit?.nome || ""),
    numeroContrato: item?.numeroContrato || null,
    tipoObra: item?.desTipoObra || null,
    natureza: item?.desTipoNaturezaObra || null,
    situacao: item?.desTipoSituacaoObra || null,
    origemRecurso: item?.desTipoOrigemRecursoObra || null,
    percentualCusto: Number.isFinite(Number(item?.percentualCustoObra)) ? Number(item.percentualCustoObra) : null,
    valorEstimado: Number.isFinite(Number(item?.vlEstimado)) ? Number(item.vlEstimado) : null,
    exercicio: Number(item?.exercicio || new Date().getFullYear()),
  };
}

export async function loadTceAm(): Promise<SourceEnvelope<any[]>> {
  const source = "tce_am";
  if (!tceCredentialsConfigured()) {
    return {
      source,
      availability: "not_configured",
      provenance: { source, sourceUrl: TCE_AM_DOCS, fetchedAt: new Date().toISOString() },
      quality: quality(0, 0), data: [],
      error: "A API oficial do TCE-AM exige Bearer JWT. Configure TCE_AM_API_TOKEN ou TCE_AM_CLIENT_ID/TCE_AM_USERNAME/TCE_AM_PASSWORD.",
    };
  }
  try {
    const unitsResponse = await tceGet("/transparencia/dados-abertos/unidades");
    const units = Array.isArray(unitsResponse.data) ? unitsResponse.data : [];
    const manausUnits = units.filter((unit: any) => normalizeText(unit?.desMunicipio) === "MANAUS" && unit?.ativo !== false);
    const year = new Date().getFullYear();
    const worksNested = await mapWithConcurrency(manausUnits.slice(0, 50), 4, async (unit: any) => {
      try {
        const response = await tceGet(`/audicop/listaObras/${encodeURIComponent(String(unit.id_unidade_gestora))}/${year}`);
        const rows = Array.isArray(response.data) ? response.data : [];
        return rows.map((item: any) => normalizeTceWork(item, unit));
      } catch { return []; }
    });
    const data = worksNested.flat();
    return {
      source,
      availability: manausUnits.length > 50 ? "degraded" : "available",
      provenance: { source, sourceUrl: `${TCE_AM_BASE}/v3/api-docs`, fetchedAt: new Date().toISOString(), referencePeriod: String(year), fromCache: unitsResponse.fromCache },
      quality: quality(data.length, data.length, manausUnits.length > 50),
      data,
      ...(manausUnits.length > 50 ? { error: "Consulta limitada às primeiras 50 unidades gestoras ativas de Manaus." } : {}),
    };
  } catch (error: any) {
    return {
      source, availability: "unavailable",
      provenance: { source, sourceUrl: TCE_AM_DOCS, fetchedAt: new Date().toISOString() },
      quality: quality(0, 0), data: [], error: error?.message || "Falha ao consultar TCE-AM",
    };
  }
}

async function configuredJsonSource(source: string, endpoint: string | undefined, officialUrl: string) : Promise<SourceEnvelope<any[]>> {
  if (!endpoint) return {
    source,
    availability: "not_configured",
    provenance: { source, sourceUrl: officialUrl, fetchedAt: new Date().toISOString() },
    quality: quality(0, 0), data: [], error: "Endpoint JSON oficial não configurado no ambiente.",
  };
  try {
    const response = await fetchJson(endpoint);
    const collection = collectionFrom(response.data).map((item) => genericNormalize(item || {}));
    const total = typeof response.data?.count === "number" ? response.data.count : collection.length;
    const classified = collection.filter((item) => item.bairro || normalizeText(item.municipio) === "MANAUS").length;
    return {
      source,
      availability: "available",
      provenance: { source, sourceUrl: endpoint, fetchedAt: new Date().toISOString(), fromCache: response.fromCache },
      quality: quality(total, classified), data: collection,
    };
  } catch (error: any) {
    return {
      source, availability: "unavailable",
      provenance: { source, sourceUrl: endpoint, fetchedAt: new Date().toISOString() },
      quality: quality(0, 0), data: [], error: error?.message || "Falha na fonte externa",
    };
  }
}

export function loadManausTransparency() {
  return configuredJsonSource("transparencia_manaus", process.env.MANAUS_TRANSPARENCIA_API_URL, "https://transparencia.manaus.am.gov.br/");
}
