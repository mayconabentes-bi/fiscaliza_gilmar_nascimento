import { buildMultiSourceContext } from "../dist-server/src/intelligence/multiSourceInsights.js";

function envelope(source, data, availability = "available") {
  return {
    source,
    availability,
    provenance: { source, sourceUrl: `https://example.test/${source}`, fetchedAt: "2026-09-12T12:00:00.000Z" },
    quality: { total: data.length, classified: data.length, unclassified: 0, coverage: 1 },
    data,
  };
}

const territories = [
  { bairro: "Centro", demandas: 10, prioritarias: 3, concluidas: 4, taxaConclusao: 40, temas: 3, obras: 6, unidadesSaude: 2, escolas: 3, semClassificacao: 0 },
  { bairro: "Flores", demandas: 5, prioritarias: 1, concluidas: 2, taxaConclusao: 40, temas: 2, obras: 4, unidadesSaude: 1, escolas: 2, semClassificacao: 0 },
];

const context = buildMultiSourceContext({
  territories,
  ibge: envelope("ibge_populacao", [{ populacao: 2_000_000 }]),
  siconfi: envelope("siconfi_dca", [{}, {}, {}]),
  pncp: envelope("pncp_contratos", [{}, {}]),
  cnes: envelope("cnes_datasus_catalogo", [{}]),
  inep: envelope("inep_censo_escolar", [], "not_configured"),
  obrasgov: envelope("obrasgov", [{}, {}, {}, {}]),
  tce: envelope("tce_am", [], "not_configured"),
});

const byKey = new Map(context.indicators.map((item) => [item.key, item]));
function expectValue(key, expected) {
  const actual = byKey.get(key)?.value;
  if (actual !== expected) throw new Error(`${key}: esperado ${expected}, recebido ${actual}`);
}

expectValue("populacao_manaus", 2_000_000);
expectValue("obras_municipais_por_100mil_hab", 0.5);
expectValue("saude_por_10mil_hab", 0.02);
expectValue("escolas_por_10mil_hab", 0.03);
expectValue("contratos_pncp_observados", 2);
expectValue("projetos_obrasgov", 4);
expectValue("registros_fiscais_siconfi", 3);

if (context.totals.demands !== 15) throw new Error(`demandas: esperado 15, recebido ${context.totals.demands}`);
if (!context.methodology.includes("Não produz score eleitoral")) throw new Error("Guardrail metodológico ausente.");

console.log("Multi-source Intelligence OK: população, indicadores proporcionais e contexto público validados.");
