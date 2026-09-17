import type { SourceEnvelope } from "./types.js";
import type { TerritoryRecord } from "./types.js";

function total(territories: TerritoryRecord[], key: "obras" | "unidadesSaude" | "escolas" | "demandas") {
  return territories.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function ratio(value: number, population: number, base: number) {
  return population > 0 ? Number(((value / population) * base).toFixed(2)) : null;
}

function populationFrom(source: SourceEnvelope<any[]>) {
  const row = Array.isArray(source.data) ? source.data.find((item: any) => Number.isFinite(Number(item?.populacao))) : null;
  return row ? Number(row.populacao) : null;
}

function sourceCount(source: SourceEnvelope<any[]>) {
  return Array.isArray(source.data) && source.data.length ? source.data.length : Number(source.quality?.total || 0);
}

export function buildMultiSourceContext(input: {
  territories: TerritoryRecord[];
  ibge: SourceEnvelope<any[]>;
  siconfi: SourceEnvelope<any[]>;
  pncp: SourceEnvelope<any[]>;
  cnes: SourceEnvelope<any[]>;
  inep: SourceEnvelope<any[]>;
  obrasgov: SourceEnvelope<any[]>;
  tce: SourceEnvelope<any[]>;
}) {
  const population = populationFrom(input.ibge);
  const works = total(input.territories, "obras");
  const health = total(input.territories, "unidadesSaude");
  const schools = total(input.territories, "escolas");
  const demands = total(input.territories, "demandas");
  const pncpContracts = sourceCount(input.pncp);
  const federalProjects = sourceCount(input.obrasgov);
  const fiscalRecords = sourceCount(input.siconfi);

  const indicators = [
    {
      key: "populacao_manaus",
      label: "População de referência",
      value: population,
      unit: "people",
      methodology: "Valor populacional mais recente retornado pelo IBGE/SIDRA para o município de Manaus (código IBGE 1302603).",
      sourceKeys: ["ibge_populacao"],
    },
    {
      key: "obras_municipais_por_100mil_hab",
      label: "Obras municipais por 100 mil habitantes",
      value: population ? ratio(works, population, 100000) : null,
      unit: "ratio",
      methodology: "Obras municipais territorializadas / população de referência × 100.000.",
      sourceKeys: ["seminf_obras", "geomanaus_bairros", "ibge_populacao"],
    },
    {
      key: "saude_por_10mil_hab",
      label: "Unidades de saúde por 10 mil habitantes",
      value: population ? ratio(health, population, 10000) : null,
      unit: "ratio",
      methodology: "Unidades de saúde mapeadas / população de referência × 10.000.",
      sourceKeys: ["geomanaus_saude", "ibge_populacao"],
    },
    {
      key: "escolas_por_10mil_hab",
      label: "Escolas municipais por 10 mil habitantes",
      value: population ? ratio(schools, population, 10000) : null,
      unit: "ratio",
      methodology: "Escolas municipais mapeadas / população de referência × 10.000.",
      sourceKeys: ["geomanaus_escolas", "ibge_populacao"],
    },
    {
      key: "contratos_pncp_observados",
      label: "Contratos PNCP observados no período",
      value: pncpContracts,
      unit: "count",
      methodology: "Quantidade de contratos observados na última coleta canônica multi-CNPJ do PNCP para órgãos públicos de Manaus.",
      sourceKeys: ["pncp_contratos"],
    },
    {
      key: "projetos_obrasgov",
      label: "Projetos ObrasGov associados a Manaus",
      value: federalProjects,
      unit: "count",
      methodology: "Projetos de investimento deduplicados a partir das geometrias ObrasGov associadas ao código IBGE de Manaus.",
      sourceKeys: ["obrasgov"],
    },
    {
      key: "registros_fiscais_siconfi",
      label: "Registros fiscais SICONFI observados",
      value: fiscalRecords,
      unit: "count",
      methodology: "Quantidade de registros retornados pelo demonstrativo DCA do SICONFI para Manaus no exercício de referência.",
      sourceKeys: ["siconfi_dca"],
    },
  ];

  const sourceStatus = [input.ibge, input.siconfi, input.pncp, input.cnes, input.inep, input.obrasgov, input.tce].map((source) => ({
    source: source.source,
    availability: source.availability,
    records: sourceCount(source),
    coverage: source.quality.coverage,
    fetchedAt: source.provenance.fetchedAt,
    error: source.error || null,
  }));

  const observations: string[] = [];
  if (population) observations.push(`População de referência disponível para normalizar indicadores: ${population.toLocaleString("pt-BR")} habitantes.`);
  else observations.push("População de referência indisponível; indicadores proporcionais permanecem sem cálculo.");
  observations.push(`${works} obras municipais, ${health} unidades de saúde e ${schools} escolas foram territorializadas no recorte atual.`);
  if (pncpContracts) observations.push(`${pncpContracts} contratos do PNCP foram observados na última coleta canônica.`);
  if (federalProjects) observations.push(`${federalProjects} projetos ObrasGov estão associados ao recorte municipal consultado.`);
  if (demands) observations.push(`${demands} demandas internas entram apenas como contexto agregado do banco local.`);

  return {
    generatedAt: new Date().toISOString(),
    municipality: "Manaus",
    codIbge: 1302603,
    population,
    totals: { works, healthUnits: health, schools, demands, pncpContracts, federalProjects, fiscalRecords },
    indicators,
    observations,
    sourceStatus,
    methodology: "Cruzamento descritivo de fontes públicas e dados operacionais agregados. Não produz score eleitoral, perfil individual ou recomendação de direcionamento político.",
  };
}
