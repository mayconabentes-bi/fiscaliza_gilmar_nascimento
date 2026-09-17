import type { SourceEnvelope } from "./types.js";

const MANAUS_IBGE_SIX = 130260;
const CNES_API_URL = process.env.CNES_DATASUS_API_URL || "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";

function quality(total: number, classified = total, truncated = false) {
  const safeTotal = Math.max(0, total);
  const safeClassified = Math.max(0, Math.min(classified, safeTotal));
  return { total: safeTotal, classified: safeClassified, unclassified: Math.max(0, safeTotal - safeClassified), coverage: safeTotal ? safeClassified / safeTotal : 1, truncated };
}

function collection(payload: any) {
  for (const key of ["data", "results", "items", "estabelecimentos", "records"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload)) return payload;
  if (payload?.data && typeof payload.data === "object") {
    for (const key of ["data", "results", "items", "estabelecimentos", "records"]) {
      if (Array.isArray(payload.data?.[key])) return payload.data[key];
    }
  }
  return [];
}

async function fetchJson(url: string, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = process.env.CNES_DATASUS_API_TOKEN || "";
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PulsoIntelligence/2.1",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    return JSON.parse(text.replace(/^\uFEFF/, "").trim());
  } finally {
    clearTimeout(timer);
  }
}

function normalizedFacility(row: any) {
  return {
    cnes: row?.codigo_cnes ?? row?.co_cnes ?? row?.cnes ?? row?.codigoCnes ?? null,
    nome: row?.nome_fantasia ?? row?.no_fantasia ?? row?.nomeFantasia ?? row?.nome ?? null,
    razaoSocial: row?.razao_social ?? row?.no_razao_social ?? row?.razaoSocial ?? null,
    tipo: row?.descricao_tipo_estabelecimento ?? row?.ds_tipo_estabelecimento ?? row?.tipo_estabelecimento ?? row?.tipo ?? null,
    naturezaJuridica: row?.descricao_natureza_juridica ?? row?.natureza_juridica ?? row?.naturezaJuridica ?? null,
    gestao: row?.tipo_gestao ?? row?.tp_gestao ?? row?.gestao ?? null,
    municipioCodigo: row?.codigo_municipio ?? row?.co_municipio_gestor ?? row?.co_municipio ?? null,
    bairro: row?.bairro_estabelecimento ?? row?.no_bairro ?? row?.bairro ?? null,
    logradouro: row?.endereco_estabelecimento ?? row?.no_logradouro ?? row?.logradouro ?? null,
    numero: row?.numero_estabelecimento ?? row?.nu_endereco ?? row?.numero ?? null,
    telefone: row?.numero_telefone_estabelecimento ?? row?.nu_telefone ?? row?.telefone ?? null,
    latitude: Number.isFinite(Number(row?.latitude_estabelecimento ?? row?.latitude)) ? Number(row?.latitude_estabelecimento ?? row?.latitude) : null,
    longitude: Number.isFinite(Number(row?.longitude_estabelecimento ?? row?.longitude)) ? Number(row?.longitude_estabelecimento ?? row?.longitude) : null,
    ativo: String(row?.status ?? row?.st_ativo ?? row?.situacao ?? "1") !== "0",
    raw: row,
  };
}

function rowIdentity(row: any) {
  return String(row?.codigo_cnes ?? row?.co_cnes ?? row?.cnes ?? row?.codigoCnes ?? "").trim();
}

export async function loadCnesManausFull(): Promise<SourceEnvelope<any[]>> {
  const source = "cnes_manaus_completo";
  const rows: any[] = [];
  const seen = new Set<string>();
  const pageSize = Math.min(20, Math.max(1, Number(process.env.CNES_PAGE_SIZE || 20)));
  const maxPages = Math.min(150, Math.max(1, Number(process.env.CNES_MAX_PAGES || 100)));
  let explicitTotal = 0;
  let stoppedNormally = false;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL(CNES_API_URL);
      url.searchParams.set("codigo_municipio", String(MANAUS_IBGE_SIX));
      url.searchParams.set("status", "1");
      url.searchParams.set("limit", String(pageSize));
      // O contrato DEMAS define offset como número da página, iniciando em zero.
      url.searchParams.set("offset", String(page));
      const payload: any = await fetchJson(url.toString());
      const pageRows = collection(payload);
      const rawTotal = payload?.total ?? payload?.totalRegistros ?? payload?.quantidade;
      if (Number.isFinite(Number(rawTotal)) && Number(rawTotal) > 0) explicitTotal = Number(rawTotal);

      let added = 0;
      for (const row of pageRows) {
        const id = rowIdentity(row);
        const fallbackId = JSON.stringify([row?.nome_fantasia ?? row?.no_fantasia ?? row?.nome, row?.endereco_estabelecimento ?? row?.logradouro, row?.numero_estabelecimento ?? row?.numero]);
        const key = id || fallbackId;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        added += 1;
      }

      if (!pageRows.length || pageRows.length < pageSize) {
        stoppedNormally = true;
        break;
      }
      // Protege contra APIs que ignorem offset e repitam a mesma página.
      if (!added && page > 0) {
        stoppedNormally = true;
        break;
      }
    }

    const data = rows.map(normalizedFacility);
    const classified = data.filter((item) => item.bairro || (item.latitude != null && item.longitude != null)).length;
    const total = Math.max(explicitTotal || 0, data.length);
    const truncated = !stoppedNormally && data.length >= pageSize * maxPages || Boolean(explicitTotal && data.length < explicitTotal);
    return {
      source,
      availability: data.length ? (truncated ? "degraded" : "available") : "degraded",
      provenance: { source, sourceUrl: CNES_API_URL, fetchedAt: new Date().toISOString() },
      quality: quality(total, classified, truncated),
      data,
      ...(truncated ? { error: `Consulta CNES limitada a ${data.length} registros no ciclo atual.` } : data.length ? {} : { error: "CNES respondeu sem estabelecimentos ativos normalizáveis para Manaus." }),
    };
  } catch (error) {
    return {
      source,
      availability: "unavailable",
      provenance: { source, sourceUrl: CNES_API_URL, fetchedAt: new Date().toISOString() },
      quality: quality(0),
      data: [],
      error: error instanceof Error ? error.message : "Falha ao consultar CNES",
    };
  }
}
