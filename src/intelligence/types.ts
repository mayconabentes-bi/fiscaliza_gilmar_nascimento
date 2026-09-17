export type SourceAvailability = "available" | "degraded" | "unavailable" | "not_configured";

export type DataQuality = {
  total: number;
  classified: number;
  unclassified: number;
  coverage: number;
  truncated?: boolean;
};

export type Provenance = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceUpdatedAt?: string | null;
  referencePeriod?: string | null;
  fromCache?: boolean;
};

export type SourceEnvelope<T> = {
  source: string;
  availability: SourceAvailability;
  provenance: Provenance;
  quality: DataQuality;
  data: T;
  error?: string | null;
};

export type TerritoryRecord = {
  bairro: string;
  demandas: number;
  prioritarias: number;
  concluidas: number;
  taxaConclusao: number;
  temas: number;
  obras: number;
  unidadesSaude: number;
  escolas: number;
  semClassificacao: number;
};

export type IntelligenceIndicator = {
  key: string;
  label: string;
  value: number;
  unit: "count" | "percent" | "ratio";
  methodology: string;
  sourceKeys: string[];
};
