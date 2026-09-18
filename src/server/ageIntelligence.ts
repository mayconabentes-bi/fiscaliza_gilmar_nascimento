export const AGE_INTELLIGENCE_BANDS = [
  { codigo: "AGE_16_17", label: "16 a 17 anos", detalhada: true },
  { codigo: "AGE_18_24", label: "18 a 24 anos", detalhada: true },
  { codigo: "AGE_25_34", label: "25 a 34 anos", detalhada: true },
  { codigo: "AGE_35_44", label: "35 a 44 anos", detalhada: true },
  { codigo: "AGE_45_59", label: "45 a 59 anos", detalhada: true },
  { codigo: "AGE_60_PLUS", label: "60 anos ou mais", detalhada: true },
  { codigo: "NAO_INFORMADA", label: "Não informado", detalhada: false, naoInformada: true },
] as const;

type AgeCountRow = { faixa_etaria: string; total: number | string };

function percentage(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}

export function resolveAggregateMinGroupSize(value?: string | number | null) {
  const configured = Number.parseInt(String(value ?? "5"), 10);
  return Number.isFinite(configured) ? Math.max(5, configured) : 5;
}

export function demographicDiversity(counts: number[]) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total < 20) return null;

  const entropy = counts.reduce((sum, value) => {
    if (!value) return sum;
    const p = value / total;
    return sum - p * Math.log(p);
  }, 0);

  // Normalização fixa nas seis faixas detalhadas evita que duas categorias
  // igualmente distribuídas pareçam representar diversidade total.
  return Number((entropy / Math.log(6)).toFixed(3));
}

export function buildAgeIntelligenceAggregate(rows: AgeCountRow[], minGroupInput?: string | number | null) {
  const counts = new Map<string, number>(
    rows.map((row) => [String(row.faixa_etaria), Number(row.total || 0)])
  );
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const naoInformados = counts.get("NAO_INFORMADA") || 0;
  const classificados = Math.max(0, total - naoInformados);
  const detalhados = AGE_INTELLIGENCE_BANDS
    .filter((band) => band.detalhada)
    .reduce((sum, band) => sum + (counts.get(band.codigo) || 0), 0);
  const minGroupSize = resolveAggregateMinGroupSize(minGroupInput);

  const suppress = new Set<string>();
  const demographicBands = AGE_INTELLIGENCE_BANDS.filter(
    (band) => !("naoInformada" in band && band.naoInformada)
  );

  for (const band of demographicBands) {
    const value = counts.get(band.codigo) || 0;
    if (value > 0 && value < minGroupSize) suppress.add(band.codigo);
  }

  // Supressão complementar só é necessária quando existe exatamente um grupo
  // pequeno protegido. Com dois ou mais grupos ocultos, mostrar categorias que
  // já atingiram o limiar não permite reconstruir individualmente os valores
  // protegidos por simples subtração do total.
  let complementarySuppressionApplied = false;
  if (suppress.size === 1) {
    const complement = demographicBands
      .filter((band) => !suppress.has(band.codigo) && (counts.get(band.codigo) || 0) >= minGroupSize)
      .sort((a, b) => (counts.get(a.codigo) || 0) - (counts.get(b.codigo) || 0))[0];
    if (complement) {
      suppress.add(complement.codigo);
      complementarySuppressionApplied = true;
    }
  }

  const faixas = AGE_INTELLIGENCE_BANDS.map((band) => {
    const value = counts.get(band.codigo) || 0;
    const suprimido = suppress.has(band.codigo);
    return {
      codigo: band.codigo,
      label: band.label,
      total: suprimido ? null : value,
      percentual: suprimido ? null : percentage(value, total),
      suprimido,
    };
  });

  const diversityCounts = AGE_INTELLIGENCE_BANDS
    .filter((band) => band.detalhada)
    .map((band) => counts.get(band.codigo) || 0);
  const protectedValues = demographicBands
    .filter((band) => suppress.has(band.codigo))
    .map((band) => counts.get(band.codigo) || 0);
  const protectedRecords = protectedValues.reduce((sum, value) => sum + value, 0);
  const visibleDetailedBands = faixas.filter(
    (band) => band.codigo !== "NAO_INFORMADA" && !band.suprimido && Number(band.total || 0) > 0
  ).length;
  const diversityMinimum = 20;

  return {
    total,
    classificados,
    naoInformados,
    detalhados,
    coberturaPercentual: percentage(classificados, total),
    coberturaDetalhadaPercentual: percentage(detalhados, total),
    limiarMinimo: minGroupSize,
    diversidadeGeracional: demographicDiversity(diversityCounts),
    diversidadeMinimo: diversityMinimum,
    registrosParaDiversidade: Math.max(0, diversityMinimum - detalhados),
    faixasVisiveis: visibleDetailedBands,
    faixasProtegidas: suppress.size,
    registrosProtegidos: suppress.size >= 2 ? protectedRecords : null,
    supressaoComplementarAplicada: complementarySuppressionApplied,
    faixas,
    metodologia:
      "Faixas autodeclaradas e agregadas no nível municipal. Nenhuma idade exata é armazenada. Grupos abaixo do limiar são protegidos; quando há apenas um grupo pequeno, aplica-se supressão complementar. O Radar não cruza faixa etária com bairro, protocolo ou identidade.",
  };
}
