export type DemandTaxonomyItem = {
  code: string;
  label: string;
};

export type DemandTaxonomyCategory = DemandTaxonomyItem & {
  problems: readonly DemandTaxonomyItem[];
};

export const DEMAND_TAXONOMY = [
  {
    code: "INFRAESTRUTURA_URBANA",
    label: "Infraestrutura urbana",
    problems: [
      { code: "BURACO_PAVIMENTACAO", label: "Buraco / pavimentação" },
      { code: "ILUMINACAO_PUBLICA", label: "Iluminação pública" },
      { code: "DRENAGEM_ALAGAMENTO", label: "Drenagem / alagamento" },
      { code: "CALCADA", label: "Calçada" },
      { code: "ACESSIBILIDADE", label: "Acessibilidade" },
      { code: "OBRA_PUBLICA", label: "Obra pública" },
      { code: "ESTRUTURA_DANIFICADA", label: "Estrutura pública danificada" },
    ],
  },
  {
    code: "LIMPEZA_URBANA",
    label: "Limpeza urbana",
    problems: [
      { code: "LIXO_ACUMULADO", label: "Lixo acumulado" },
      { code: "COLETA_NAO_REALIZADA", label: "Coleta não realizada" },
      { code: "ENTULHO", label: "Entulho" },
      { code: "DESCARTE_IRREGULAR", label: "Descarte irregular" },
      { code: "LIMPEZA_VIA", label: "Limpeza de via" },
      { code: "LIXEIRA_EQUIPAMENTO", label: "Lixeira / equipamento de limpeza" },
    ],
  },
  {
    code: "MOBILIDADE_TRANSITO",
    label: "Mobilidade e trânsito",
    problems: [
      { code: "SEMAFORO", label: "Semáforo" },
      { code: "SINALIZACAO", label: "Sinalização" },
      { code: "TRANSPORTE_COLETIVO", label: "Transporte coletivo" },
      { code: "PARADA_ONIBUS", label: "Parada de ônibus" },
      { code: "VIA_BLOQUEADA", label: "Via bloqueada" },
      { code: "TRANSITO", label: "Trânsito" },
      { code: "ACESSIBILIDADE_MOBILIDADE", label: "Acessibilidade na mobilidade" },
    ],
  },
  {
    code: "MEIO_AMBIENTE",
    label: "Meio ambiente",
    problems: [
      { code: "ARVORE_RISCO", label: "Árvore com risco" },
      { code: "PODA", label: "Poda" },
      { code: "QUEIMADA", label: "Queimada" },
      { code: "POLUICAO", label: "Poluição" },
      { code: "AREA_VERDE", label: "Área verde" },
      { code: "IGARAPE_CORPO_DAGUA", label: "Igarapé / corpo d'água" },
      { code: "DESCARTE_AMBIENTAL_IRREGULAR", label: "Descarte ambiental irregular" },
    ],
  },
  {
    code: "SAUDE",
    label: "Saúde",
    problems: [
      { code: "UNIDADE_SAUDE", label: "Unidade de saúde" },
      { code: "ESTRUTURA_EQUIPAMENTO_SAUDE", label: "Estrutura / equipamento de saúde" },
      { code: "ACESSO_SERVICO_SAUDE", label: "Acesso ao serviço" },
      { code: "VIGILANCIA_SANITARIA", label: "Vigilância sanitária" },
      { code: "OUTRO_PROBLEMA_COLETIVO_SAUDE", label: "Outro problema coletivo de saúde" },
    ],
  },
  {
    code: "EDUCACAO",
    label: "Educação",
    problems: [
      { code: "ESCOLA_ESTRUTURA", label: "Escola / estrutura" },
      { code: "MANUTENCAO_ESCOLAR", label: "Manutenção" },
      { code: "ACESSO_EDUCACAO", label: "Acesso ao serviço educacional" },
      { code: "TRANSPORTE_ESCOLAR", label: "Transporte escolar" },
      { code: "EQUIPAMENTO_EDUCACIONAL", label: "Equipamento público educacional" },
    ],
  },
  {
    code: "ASSISTENCIA_SOCIAL",
    label: "Assistência social",
    problems: [
      { code: "EQUIPAMENTO_SOCIAL", label: "Equipamento social" },
      { code: "ATENDIMENTO_SOCIAL", label: "Atendimento" },
      { code: "ACESSO_SERVICO_SOCIAL", label: "Acesso a serviço" },
      { code: "VULNERABILIDADE_COLETIVA", label: "Situação coletiva de vulnerabilidade" },
    ],
  },
  {
    code: "SEGURANCA_ORDEM_URBANA",
    label: "Segurança e ordem urbana",
    problems: [
      { code: "ILUMINACAO_SEGURANCA", label: "Iluminação relacionada à segurança" },
      { code: "ESPACO_PUBLICO_DEGRADADO", label: "Espaço público degradado" },
      { code: "OCUPACAO_IRREGULAR", label: "Ocupação irregular" },
      { code: "PERTURBACAO_URBANA", label: "Perturbação urbana" },
      { code: "RISCO_EQUIPAMENTO_PUBLICO", label: "Risco em equipamento público" },
    ],
  },
  {
    code: "OUTRO",
    label: "Outro",
    problems: [
      { code: "OUTRO_PROBLEMA", label: "Outro problema" },
    ],
  },
] as const satisfies readonly DemandTaxonomyCategory[];

export type DemandCategoryCode = (typeof DEMAND_TAXONOMY)[number]["code"];

export function getDemandCategory(code: string) {
  return DEMAND_TAXONOMY.find((item) => item.code === code) || null;
}

export function getDemandProblem(code: string, problemCode: string) {
  return getDemandCategory(code)?.problems.find((item) => item.code === problemCode) || null;
}

export function isValidDemandCategory(code: string) {
  return Boolean(getDemandCategory(code));
}

export function isValidDemandClassification(category: string, problemType: string) {
  return Boolean(getDemandProblem(category, problemType));
}

export function demandCategoryLabel(code: string) {
  return getDemandCategory(code)?.label || code;
}

export function demandProblemLabel(category: string, problemType: string) {
  return getDemandProblem(category, problemType)?.label || problemType;
}
