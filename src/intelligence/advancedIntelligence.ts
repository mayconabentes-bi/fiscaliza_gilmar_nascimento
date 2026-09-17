import fs from "node:fs";
import path from "node:path";
import { snapshots } from "./storage.js";
import type { SourceEnvelope, TerritoryRecord } from "./types.js";

const PNCP_BASE = process.env.PNCP_API_URL || "https://pncp.gov.br/api/consulta/v1";
const TCE_AM_BASE = process.env.TCE_AM_API_URL || "https://econtasapi.tce.am.gov.br";
const MANAUS_IBGE = 1302603;

type FetchOptions = { headers?: Record<string, string>; method?: string; body?: string };

export type InstitutionRecord = {
  key: string;
  nome: string;
  sigla?: string | null;
  cnpj: string;
  tipo: "municipio" | "secretaria" | "fundo" | "autarquia" | "fundacao" | "empresa_publica" | "outro";
  ativo: boolean;
  source: string;
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

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

function quality(total: number, classified = total, truncated = false) {
  const safeTotal = Math.max(0, total);
  const safeClassified = Math.max(0, Math.min(classified, safeTotal));
  return {
    total: safeTotal,
    classified: safeClassified,
    unclassified: Math.max(0, safeTotal - safeClassified),
    coverage: safeTotal ? safeClassified / safeTotal : 1,
    truncated,
  };
}

async function fetchJson(url: string, timeoutMs = 25000, options: FetchOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      method: options.method || "GET",
      body: options.body,
      headers: { Accept: "application/json", "User-Agent": "PulsoIntelligence/2.0", ...(options.headers || {}) },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 180).replace(/\s+/g, " ")}`);
    const normalized = text.replace(/^\uFEFF/, "").replace(/^\)\]\}',?\s*/, "").trim();
    if (!normalized) return null;
    return JSON.parse(normalized);
  } finally {
    clearTimeout(timer);
  }
}

function collection(payload: any, keys: string[]) {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  if (payload?.data && typeof payload.data === "object") {
    for (const key of keys) if (Array.isArray(payload.data?.[key])) return payload.data[key];
  }
  return [];
}

export function manausInstitutions(): InstitutionRecord[] {
  const defaults: InstitutionRecord[] = [{
    key: "municipio_manaus",
    nome: "Município de Manaus",
    sigla: "PMM",
    cnpj: "04365326000173",
    tipo: "municipio",
    ativo: true,
    source: "default_oficial",
  }];

  const raw = process.env.MANAUS_INSTITUTIONS_JSON || "";
  if (!raw.trim()) return defaults;

  try {
    const parsed = JSON.parse(raw);
    const extra = (Array.isArray(parsed) ? parsed : []).flatMap((item: any, index: number) => {
      const cnpj = digits(item?.cnpj);
      if (cnpj.length !== 14) return [];
      const allowedTypes = ["municipio", "secretaria", "fundo", "autarquia", "fundacao", "empresa_publica", "outro"];
      return [{
        key: String(item?.key || item?.sigla || `cadastro_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        nome: String(item?.nome || item?.name || "Cadastro público").trim(),
        sigla: item?.sigla ? String(item.sigla).trim() : null,
        cnpj,
        tipo: (allowedTypes.includes(String(item?.tipo)) ? String(item.tipo) : "outro") as InstitutionRecord["tipo"],
        ativo: item?.ativo !== false,
        source: "env",
      } satisfies InstitutionRecord];
    });
    const byCnpj = new Map<string, InstitutionRecord>();
    for (const item of [...defaults, ...extra]) byCnpj.set(item.cnpj, item);
    return [...byCnpj.values()];
  } catch {
    return defaults;
  }
}

export async function loadPncpInstitutional(year = new Date().getFullYear()): Promise<SourceEnvelope<any[]>> {
  const source = "pncp_manaus_cnpjs";
  const entries = manausInstitutions().filter((item) => item.ativo);
  const rows: any[] = [];
  const failures: string[] = [];
  const start = `${year}0101`;
  const now = new Date();
  const end = year === now.getFullYear()
    ? `${year}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
    : `${year}1231`;

  for (const entry of entries) {
    try {
      for (let page = 1; page <= 20; page += 1) {
        const url = new URL(`${PNCP_BASE}/contratos`);
        url.searchParams.set("dataInicial", start);
        url.searchParams.set("dataFinal", end);
        url.searchParams.set("cnpjOrgao", entry.cnpj);
        url.searchParams.set("pagina", String(page));
        url.searchParams.set("tamanhoPagina", "100");
        const payload: any = await fetchJson(url.toString(), 20000);
        const pageRows = collection(payload, ["data", "items", "results", "contratos"]);
        for (const item of pageRows) rows.push({
          ...item,
          cadastroKey: entry.key,
          cadastroNome: entry.nome,
          cadastroCnpj: entry.cnpj,
        });
        const totalPages = Number(payload?.totalPaginas ?? payload?.totalPages ?? payload?.paginas ?? 1);
        if (!pageRows.length || page >= totalPages) break;
      }
    } catch (error) {
      failures.push(`${entry.nome}: ${error instanceof Error ? error.message : "falha"}`);
    }
  }

  const normalized = rows.map((row: any) => ({
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
    publicadorNome: row?.orgaoEntidade?.razaosocial || row?.orgaoEntidade?.razaoSocial || row?.orgaoNome || null,
    unidadeNome: row?.unidadeOrgao?.nomeUnidade || row?.unidadeNome || null,
    cadastroKey: row.cadastroKey,
    cadastroNome: row.cadastroNome,
    cadastroCnpj: row.cadastroCnpj,
  }));

  const availability = failures.length
    ? (normalized.length ? "degraded" : "unavailable")
    : (normalized.length ? "available" : "degraded");

  return {
    source,
    availability,
    provenance: { source, sourceUrl: `${PNCP_BASE}/contratos`, fetchedAt: new Date().toISOString(), referencePeriod: String(year) },
    quality: quality(entries.length, entries.length - failures.length, failures.length > 0),
    data: normalized,
    ...(failures.length
      ? { error: failures.slice(0, 5).join(" | ") }
      : normalized.length
        ? {}
        : { error: "Nenhum contrato foi retornado para os CNPJs públicos configurados no período consultado." }),
  };
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(current);
      current = "";
    } else current += char;
  }
  result.push(current);
  return result;
}

export function loadInepMicrodataFile(): SourceEnvelope<any[]> {
  const source = "inep_censo_escolar_arquivo";
  const configured = process.env.INEP_CENSO_ESCOLAR_FILE || "";
  if (!configured) return {
    source,
    availability: "not_configured",
    provenance: { source, sourceUrl: "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar", fetchedAt: new Date().toISOString() },
    quality: quality(0),
    data: [],
    error: "Configure INEP_CENSO_ESCOLAR_FILE com o caminho local de um CSV oficial do Censo Escolar já extraído.",
  };

  try {
    const resolved = path.resolve(configured);
    if (!fs.existsSync(resolved)) throw new Error("Arquivo configurado não encontrado");
    const text = fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) throw new Error("Arquivo vazio");
    const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
    const headers = parseDelimitedLine(lines[0], delimiter).map((item) => item.trim());
    const rows: any[] = [];

    for (const line of lines.slice(1)) {
      const values = parseDelimitedLine(line, delimiter);
      const row: any = {};
      headers.forEach((header, index) => { row[header] = values[index] ?? ""; });
      const municipioCode = digits(row.CO_MUNICIPIO ?? row.COD_MUNICIPIO ?? row.co_municipio);
      const municipioName = normalize(row.NO_MUNICIPIO ?? row.NOME_MUNICIPIO ?? row.no_municipio);
      if (municipioCode === String(MANAUS_IBGE) || municipioName === "MANAUS") rows.push(row);
    }

    return {
      source,
      availability: rows.length ? "available" : "degraded",
      provenance: { source, sourceUrl: `file://${resolved}`, fetchedAt: new Date().toISOString() },
      quality: quality(Math.max(0, lines.length - 1), rows.length),
      data: rows,
      ...(rows.length ? {} : { error: "O arquivo foi lido, mas nenhum registro de Manaus foi identificado pelos campos de município conhecidos." }),
    };
  } catch (error) {
    return {
      source,
      availability: "unavailable",
      provenance: { source, sourceUrl: configured, fetchedAt: new Date().toISOString() },
      quality: quality(0),
      data: [],
      error: error instanceof Error ? error.message : "Falha ao ler microdados INEP",
    };
  }
}

async function tceToken() {
  if (process.env.TCE_AM_API_TOKEN) return process.env.TCE_AM_API_TOKEN;
  const clientId = process.env.TCE_AM_CLIENT_ID;
  const username = process.env.TCE_AM_USERNAME;
  const password = process.env.TCE_AM_PASSWORD;
  if (!clientId || !username || !password) return null;

  const payload: any = await fetchJson(`${TCE_AM_BASE}/auth`, 20000, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, username, password }),
  });
  return String(payload?.access_token ?? payload?.data?.access_token ?? "") || null;
}

async function tceGet(pathname: string, token: string) {
  return fetchJson(`${TCE_AM_BASE}${pathname}`, 25000, { headers: { Authorization: `Bearer ${token}` } });
}

export async function loadTceFinancialPortfolio(year = new Date().getFullYear()) {
  const source = "tce_am_portfolio";
  const token = await tceToken().catch(() => null);
  if (!token) return {
    source,
    availability: "not_configured" as const,
    provenance: { source, sourceUrl: `${TCE_AM_BASE}/v3/api-docs`, fetchedAt: new Date().toISOString(), referencePeriod: String(year) },
    quality: quality(0),
    data: [],
    error: "Credenciais TCE-AM não configuradas para o portfólio financeiro.",
  };

  try {
    const unitsPayload: any = await tceGet("/transparencia/dados-abertos/unidades", token);
    const units = (Array.isArray(unitsPayload) ? unitsPayload : collection(unitsPayload, ["data", "items", "results"]))
      .filter((unit: any) => normalize(unit?.desMunicipio ?? unit?.municipio) === "MANAUS" && unit?.ativo !== false)
      .slice(0, Number(process.env.TCE_AM_MAX_UNITS || 30));
    const data: any[] = [];

    for (const unit of units) {
      const id = unit?.id_unidade_gestora ?? unit?.idUnidadeGestora;
      if (!id) continue;
      const [contracts, works] = await Promise.all([
        tceGet(`/transparencia/dados-abertos/contratos/${encodeURIComponent(String(id))}/${year}`, token).catch(() => []),
        tceGet(`/audicop/listaObras/${encodeURIComponent(String(id))}/${year}`, token).catch(() => []),
      ]);
      const empenhos: any[] = [];
      for (let month = 1; month <= 12; month += 1) {
        const monthRows = await tceGet(`/transparencia/dados-abertos/empenhos/${encodeURIComponent(String(id))}/${year}/${month}`, token).catch(() => []);
        empenhos.push(...(Array.isArray(monthRows) ? monthRows : collection(monthRows, ["data", "items", "results"])));
      }
      data.push({
        unidadeGestoraId: id,
        unidadeGestora: unit?.nome ?? unit?.desUnidadeGestora ?? null,
        contratos: Array.isArray(contracts) ? contracts : collection(contracts, ["data", "items", "results"]),
        empenhos,
        obras: Array.isArray(works) ? works : collection(works, ["data", "items", "results"]),
      });
    }

    return {
      source,
      availability: "available" as const,
      provenance: { source, sourceUrl: `${TCE_AM_BASE}/v3/api-docs`, fetchedAt: new Date().toISOString(), referencePeriod: String(year) },
      quality: quality(units.length),
      data,
    };
  } catch (error) {
    return {
      source,
      availability: "unavailable" as const,
      provenance: { source, sourceUrl: `${TCE_AM_BASE}/v3/api-docs`, fetchedAt: new Date().toISOString(), referencePeriod: String(year) },
      quality: quality(0),
      data: [],
      error: error instanceof Error ? error.message : "Falha ao consultar portfólio TCE-AM",
    };
  }
}

export function territorialQuality(input: { raw: { works: any[]; health: any[]; schools: any[] }; territories: TerritoryRecord[] }) {
  const territorialized = {
    works: input.territories.reduce((sum, item) => sum + Number(item.obras || 0), 0),
    health: input.territories.reduce((sum, item) => sum + Number(item.unidadesSaude || 0), 0),
    schools: input.territories.reduce((sum, item) => sum + Number(item.escolas || 0), 0),
  };

  const result = (Object.keys(territorialized) as Array<keyof typeof territorialized>).map((key) => {
    const received = input.raw[key].length;
    const classified = territorialized[key];
    return {
      key,
      received,
      classified,
      unclassified: Math.max(0, received - classified),
      coverage: received ? classified / received : 1,
    };
  });

  return {
    dimensions: result,
    methodology: "Cobertura territorial = registros associados a algum território / registros recebidos da fonte. Registros sem bairro não são descartados do estado da fonte; apenas ficam fora dos indicadores territoriais.",
  };
}

function periodDate(period: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return new Date(`${period}T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(period)) return new Date(`${period}-01T00:00:00Z`);
  if (/^\d{4}$/.test(period)) return new Date(`${period}-01-01T00:00:00Z`);
  return new Date(period);
}

function bucketPeriod(period: string, granularity: "daily" | "weekly" | "monthly" | "yearly") {
  const date = periodDate(period);
  if (Number.isNaN(date.getTime())) return period;
  if (granularity === "daily") return date.toISOString().slice(0, 10);
  if (granularity === "monthly") return date.toISOString().slice(0, 7);
  if (granularity === "yearly") return String(date.getUTCFullYear());
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function historicalSeries(metric?: string, territory = "MANAUS", granularity: "daily" | "weekly" | "monthly" | "yearly" = "monthly") {
  const rows = snapshots(metric, territory) as any[];
  const groups = new Map<string, any>();
  for (const row of rows) {
    const bucket = bucketPeriod(String(row.period), granularity);
    const key = `${row.metric}|${bucket}`;
    const current = groups.get(key);
    if (!current || String(row.collected_at) >= String(current.collected_at)) groups.set(key, { ...row, bucket });
  }
  return [...groups.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)) || String(a.metric).localeCompare(String(b.metric)));
}
