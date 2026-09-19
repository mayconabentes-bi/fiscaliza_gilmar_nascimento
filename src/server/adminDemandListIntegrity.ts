import { isValidDemandCategory, isValidDemandClassification } from "../shared/demandTaxonomy.js";

const STATUS_VALIDOS = new Set(["RECEBIDA","EM_TRIAGEM","ENCAMINHADA","EM_ANALISE","EM_EXECUCAO","CONCLUIDA","INDEFERIDA"]);
const PRIORIDADES_VALIDAS = new Set(["BAIXA","MEDIA","ALTA","CRITICA"]);

export const ADMIN_DEMAND_LIST_LIMIT = 500;

export type AdminDemandListFilters = {
  status: string;
  prioridade: string;
  protocolo: string;
  municipio: string;
  bairro: string;
  categoria: string;
  tipoProblema: string;
};

export type AdminDemandListFilterResult =
  | { ok: true; filters: AdminDemandListFilters; error?: never }
  | { ok: false; error: string; filters?: never };

function queryString(value: unknown, maxLength: number, upper = false) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, maxLength);
  return upper ? trimmed.toUpperCase() : trimmed;
}

export function normalizeAdminDemandListFilters(query: Record<string, unknown>): AdminDemandListFilterResult {
  const filters: AdminDemandListFilters = {
    status: queryString(query.status, 32, true),
    prioridade: queryString(query.prioridade, 20, true),
    protocolo: queryString(query.protocolo, 80, true),
    municipio: queryString(query.municipio, 120),
    bairro: queryString(query.bairro, 160),
    categoria: queryString(query.categoria, 80, true),
    tipoProblema: queryString(query.tipo_problema, 100, true),
  };

  if (filters.status && !STATUS_VALIDOS.has(filters.status)) {
    return { ok: false, error: "Status inválido." };
  }
  if (filters.prioridade && !PRIORIDADES_VALIDAS.has(filters.prioridade)) {
    return { ok: false, error: "Prioridade inválida." };
  }
  if (filters.categoria && !isValidDemandCategory(filters.categoria)) {
    return { ok: false, error: "Categoria inválida." };
  }
  if (filters.tipoProblema && !filters.categoria) {
    return { ok: false, error: "Categoria é obrigatória ao filtrar por tipo de problema." };
  }
  if (filters.tipoProblema && !isValidDemandClassification(filters.categoria, filters.tipoProblema)) {
    return { ok: false, error: "Tipo de problema inválido para a categoria informada." };
  }

  return { ok: true, filters };
}
