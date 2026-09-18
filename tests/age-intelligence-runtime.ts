import assert from "node:assert/strict";
import {
  buildAgeIntelligenceAggregate,
  demographicDiversity,
  resolveAggregateMinGroupSize,
} from "../src/server/ageIntelligence.ts";

assert.equal(resolveAggregateMinGroupSize("2"), 5);
assert.equal(resolveAggregateMinGroupSize("10"), 10);
assert.equal(resolveAggregateMinGroupSize("invalid"), 5);

const freshStart = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_16_17", total: 5 },
  { faixa_etaria: "AGE_18_24", total: 7 },
  { faixa_etaria: "NAO_INFORMADA", total: 6 },
], 5);

assert.equal(freshStart.total, 18);
assert.equal(freshStart.classificados, 12);
assert.equal(freshStart.detalhados, 12);
assert.equal(freshStart.coberturaPercentual, 66.7);
assert.equal(freshStart.coberturaDetalhadaPercentual, 66.7);
assert.equal(freshStart.diversidadeGeracional, null);

const protectedSmallGroup = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_18_24", total: 1 },
  { faixa_etaria: "AGE_25_34", total: 8 },
  { faixa_etaria: "NAO_INFORMADA", total: 6 },
], 5);

const suppressed = protectedSmallGroup.faixas.filter((x) => x.suprimido).map((x) => x.codigo);
assert.deepEqual(suppressed.sort(), ["AGE_18_24", "AGE_25_34"].sort());
assert.equal(protectedSmallGroup.supressaoComplementarAplicada, true);
assert.equal(protectedSmallGroup.registrosProtegidos, 9);

const currentLike = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_16_17", total: 2 },
  { faixa_etaria: "AGE_18_24", total: 10 },
  { faixa_etaria: "AGE_25_34", total: 2 },
  { faixa_etaria: "AGE_35_44", total: 1 },
  { faixa_etaria: "AGE_45_59", total: 1 },
  { faixa_etaria: "AGE_60_PLUS", total: 1 },
], 5);

const currentVisible = currentLike.faixas.filter((x) => !x.suprimido && Number(x.total || 0) > 0).map((x) => x.codigo);
assert.deepEqual(currentVisible, ["AGE_18_24"]);
assert.equal(currentLike.faixasVisiveis, 1);
assert.equal(currentLike.faixasProtegidas, 5);
assert.equal(currentLike.registrosProtegidos, 7);
assert.equal(currentLike.supressaoComplementarAplicada, false);
assert.equal(currentLike.registrosParaDiversidade, 3);
assert.equal(currentLike.diversidadeGeracional, null);

const robust = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_16_17", total: 10 },
  { faixa_etaria: "AGE_18_24", total: 10 },
  { faixa_etaria: "AGE_25_34", total: 10 },
  { faixa_etaria: "AGE_35_44", total: 10 },
  { faixa_etaria: "AGE_45_59", total: 10 },
  { faixa_etaria: "AGE_60_PLUS", total: 10 },
], 5);

assert.equal(robust.total, 60);
assert.equal(robust.coberturaPercentual, 100);
assert.equal(robust.coberturaDetalhadaPercentual, 100);
assert.equal(robust.diversidadeGeracional, 1);
assert.equal(demographicDiversity([10, 10, 10, 10, 10, 10]), 1);

console.log("Age intelligence runtime OK: leitura útil, proteção de grupos pequenos e diversidade geracional.");
