import { loadSiconfi } from "./expansionSources.js";

export type FiscalStage = "previsto" | "realizado" | "empenhado" | "liquidado" | "pago";
type FiscalSelection = { value: number; account: string; column: string; selection: "canonical" | "fallback" };

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

function fiscalStage(row: any): FiscalStage | null {
  const label = normalize(row?.coluna ?? row?.no_coluna ?? row?.column ?? row?.descricao_coluna ?? row?.ds_coluna);
  const account = normalize(row?.conta ?? row?.no_conta ?? row?.descricao_conta ?? row?.ds_conta);
  const combined = `${label} ${account}`;

  if (/DESPESAS?\s+PAG|\bPAGO\b|\bPAGA\b|\bPAGAS\b|\bPAGAMENTO/.test(combined)) return "pago";
  if (/LIQUIDAD/.test(combined)) return "liquidado";
  if (/EMPENHAD/.test(combined)) return "empenhado";
  if (/REALIZAD|ARRECADAD/.test(combined)) return "realizado";
  if (/PREVIS|PREVIST|DOTACAO|ORCAD/.test(combined)) return "previsto";
  return null;
}

function rowAmount(row: any) {
  for (const key of ["valor", "vl_conta", "valor_conta", "value", "vl"] as const) {
    const parsed = numberValue(row?.[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function rowFields(row: any) {
  return {
    annex: normalize(row?.anexo ?? row?.no_anexo ?? row?.cod_anexo ?? row?.co_anexo),
    code: normalize(row?.cod_conta ?? row?.co_conta ?? row?.codigo_conta),
    account: String(row?.conta ?? row?.no_conta ?? row?.descricao_conta ?? row?.ds_conta ?? ""),
    accountNormalized: normalize(row?.conta ?? row?.no_conta ?? row?.descricao_conta ?? row?.ds_conta),
    column: String(row?.coluna ?? row?.no_coluna ?? row?.column ?? row?.descricao_coluna ?? row?.ds_coluna ?? ""),
    columnNormalized: normalize(row?.coluna ?? row?.no_coluna ?? row?.column ?? row?.descricao_coluna ?? row?.ds_coluna),
  };
}

function canonicalDcaSelection(rows: any[], stage: Exclude<FiscalStage, "previsto">): FiscalSelection | null {
  const wantedColumn: Record<Exclude<FiscalStage, "previsto">, string> = {
    realizado: "RECEITAS BRUTAS REALIZADAS",
    empenhado: "DESPESAS EMPENHADAS",
    liquidado: "DESPESAS LIQUIDADAS",
    pago: "DESPESAS PAGAS",
  };

  for (const row of rows || []) {
    const value = rowAmount(row);
    if (value == null) continue;
    const fields = rowFields(row);

    if (
      stage === "realizado" &&
      fields.annex === "DCA-ANEXO I-C" &&
      fields.code === "TOTALRECEITAS" &&
      fields.columnNormalized === wantedColumn.realizado &&
      fields.accountNormalized.includes("TOTAL DAS RECEITAS")
    ) {
      return { value, account: fields.account, column: fields.column, selection: "canonical" };
    }

    if (
      stage !== "realizado" &&
      fields.annex === "DCA-ANEXO I-D" &&
      fields.code === "TOTALDESPESAS" &&
      fields.columnNormalized === wantedColumn[stage] &&
      fields.accountNormalized === "TOTAL GERAL DA DESPESA"
    ) {
      return { value, account: fields.account, column: fields.column, selection: "canonical" };
    }
  }
  return null;
}

function hasDcaShape(rows: any[]) {
  return (rows || []).some((row) => {
    const annex = normalize(row?.anexo ?? row?.no_anexo ?? row?.cod_anexo ?? row?.co_anexo);
    const code = normalize(row?.cod_conta ?? row?.co_conta ?? row?.codigo_conta);
    return annex.startsWith("DCA-ANEXO") && Boolean(code);
  });
}

export function buildFiscalEngine(rows: any[]) {
  const dca = hasDcaShape(rows);
  const candidates: Record<FiscalStage, FiscalSelection[]> = {
    previsto: [],
    realizado: [],
    empenhado: [],
    liquidado: [],
    pago: [],
  };

  for (const row of rows || []) {
    const stage = fiscalStage(row);
    const value = rowAmount(row);
    if (!stage || value == null) continue;
    const fields = rowFields(row);
    candidates[stage].push({
      value,
      account: fields.account,
      column: fields.column,
      selection: "fallback",
    });
  }

  const stages: Record<FiscalStage, FiscalSelection | null> = {
    // O DCA observado não oferece um total de previsão/dotação comparável aos totais
    // canônicos de receita realizada e despesa executada. Não inferimos esse valor.
    previsto: dca
      ? null
      : candidates.previsto.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null,
    realizado: canonicalDcaSelection(rows, "realizado") || (!dca ? candidates.realizado.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null : null),
    empenhado: canonicalDcaSelection(rows, "empenhado") || (!dca ? candidates.empenhado.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null : null),
    liquidado: canonicalDcaSelection(rows, "liquidado") || (!dca ? candidates.liquidado.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null : null),
    pago: canonicalDcaSelection(rows, "pago") || (!dca ? candidates.pago.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null : null),
  };

  return {
    stages,
    candidateCounts: Object.fromEntries((Object.keys(candidates) as FiscalStage[]).map((stage) => [stage, candidates[stage].length])),
    methodology: dca
      ? "Para DCA/SICONFI, o motor usa apenas totais canônicos e comparáveis: receita bruta realizada no Anexo I-C (TotalReceitas) e despesa empenhada, liquidada e paga no Anexo I-D (TotalDespesas / Total Geral da Despesa). O valor previsto não é inferido do DCA quando não existe total compatível na resposta; permanece indisponível até ser conectado a uma fonte orçamentária apropriada."
      : "Para entradas sem estrutura DCA identificável, o motor usa classificação por rótulo e escolhe o maior valor absoluto por estágio, preservando conta e coluna para auditoria.",
  };
}

export async function fiscalOverview(year = new Date().getFullYear() - 1) {
  const siconfi = await loadSiconfi(year);
  const engine = buildFiscalEngine(Array.isArray(siconfi.data) ? siconfi.data : []);
  return { year, source: siconfi, ...engine };
}
