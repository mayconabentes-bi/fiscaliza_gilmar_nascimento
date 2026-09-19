export const DEMAND_STATUS_VALUES = [
  "RECEBIDA",
  "EM_TRIAGEM",
  "ENCAMINHADA",
  "EM_ANALISE",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "INDEFERIDA",
] as const;

export type DemandStatus = typeof DEMAND_STATUS_VALUES[number];

const ALLOWED_TRANSITIONS: Record<DemandStatus, readonly DemandStatus[]> = {
  RECEBIDA: ["EM_TRIAGEM", "ENCAMINHADA", "EM_ANALISE", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"],
  EM_TRIAGEM: ["ENCAMINHADA", "EM_ANALISE", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"],
  ENCAMINHADA: ["EM_ANALISE", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"],
  EM_ANALISE: ["ENCAMINHADA", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"],
  EM_EXECUCAO: ["EM_ANALISE", "CONCLUIDA", "INDEFERIDA"],
  CONCLUIDA: [],
  INDEFERIDA: [],
};

export function isDemandStatus(value: unknown): value is DemandStatus {
  return DEMAND_STATUS_VALUES.includes(String(value || "") as DemandStatus);
}

export function canTransitionDemandStatus(from: DemandStatus, to: DemandStatus) {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function allowedDemandStatusTargets(from: DemandStatus) {
  return [from, ...ALLOWED_TRANSITIONS[from]];
}
