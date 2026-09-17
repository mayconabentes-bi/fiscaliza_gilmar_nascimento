import { loadObrasGov, loadTceAm } from "./sources.js";
import { fiscalOverview } from "./fiscalEngine.js";
import { loadTceFinancialPortfolio } from "./advancedIntelligence.js";
import { manausPublicEntities } from "./manausPublicEntities.js";
import { loadPncpManausContracts } from "./pncpManaus.js";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

export async function financialCrosswalk(year = new Date().getFullYear()) {
  const fiscalYear = year > new Date().getFullYear() - 1 ? new Date().getFullYear() - 1 : year;
  const [pncp, fiscal, obrasgov, tceBase, tcePortfolio] = await Promise.all([
    loadPncpManausContracts(year),
    fiscalOverview(fiscalYear),
    loadObrasGov(),
    loadTceAm(),
    loadTceFinancialPortfolio(year),
  ]);

  const pncpDocs = new Set((pncp.data || []).map((item: any) => digits(item?.fornecedorDocumento)).filter(Boolean));
  const obrasGovCnpjs = new Set((obrasgov.data || []).map((item: any) => digits(item?.cnpjOrganizacaoResponsavel)).filter(Boolean));
  const sharedOrganizations = [...obrasGovCnpjs].filter((cnpj) => pncpDocs.has(cnpj));
  const tceContracts = (tcePortfolio.data || []).reduce((sum: number, item: any) => sum + (Array.isArray(item?.contratos) ? item.contratos.length : 0), 0);
  const tceEmpenhos = (tcePortfolio.data || []).reduce((sum: number, item: any) => sum + (Array.isArray(item?.empenhos) ? item.empenhos.length : 0), 0);
  const tceWorks = (tcePortfolio.data || []).reduce((sum: number, item: any) => sum + (Array.isArray(item?.obras) ? item.obras.length : 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    year,
    fiscalYear,
    institutions: manausPublicEntities(),
    totals: {
      pncpContracts: pncp.data.length,
      obrasGovProjects: obrasgov.data.length,
      tceWorksBase: tceBase.data.length,
      tceContracts,
      tceEmpenhos,
      tceWorks,
      sharedOrganizationsByCnpj: sharedOrganizations.length,
    },
    fiscal: fiscal.stages,
    availability: {
      pncp: pncp.availability,
      siconfi: fiscal.source.availability,
      obrasgov: obrasgov.availability,
      tce: tcePortfolio.availability,
    },
    methodology: "Cruzamento financeiro descritivo. Valores fiscais usam o motor fiscal canônico do SICONFI; PNCP consulta CNPJs públicos de Manaus verificados e configurados; ObrasGov e TCE permanecem fontes independentes. Correspondências por CNPJ só são apresentadas quando o identificador é explícito na fonte.",
  };
}
