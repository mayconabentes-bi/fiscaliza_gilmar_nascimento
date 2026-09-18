import assert from "node:assert/strict";
import {
  buildAgeIntelligenceAggregate,
  demographicDiversity,
  resolveAggregateMinGroupSize,
} from "../src/server/ageIntelligence.ts";

assert.equal(resolveAggregateMinGroupSize("2"), 5);
assert.equal(resolveAggregateMinGroupSize("10"), 10);
assert.equal(resolveAggregateMinGroupSize("invalid"), 5);

const currentLike = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_16_17", total: 5 },
  { faixa_etaria: "AGE_18_PLUS", total: 7 },
  { faixa_etaria: "NAO_INFORMADA", total: 6 },
], 5);

assert.equal(currentLike.total, 18);
assert.equal(currentLike.classificados, 12);
assert.equal(currentLike.detalhados, 5);
assert.equal(currentLike.coberturaPercentual, 66.7);
assert.equal(currentLike.coberturaDetalhadaPercentual, 27.8);
assert.equal(currentLike.diversidadeGeracional, null);
assert.equal(currentLike.faixas.find((x) => x.codigo === "AGE_16_17")?.suprimido, false);
assert.equal(currentLike.faixas.find((x) => x.codigo === "AGE_18_PLUS")?.legado, true);

const protectedSmallGroup = buildAgeIntelligenceAggregate([
  { faixa_etaria: "AGE_18_24", total: 1 },
  { faixa_etaria: "AGE_18_PLUS", total: 8 },
  { faixa_etaria: "NAO_INFORMADA", total: 6 },
], 5);

const suppressed = protectedSmallGroup.faixas.filter((x) => x.suprimido).map((x) => x.codigo);
assert.deepEqual(suppressed.sort(), ["AGE_18_24", "AGE_18_PLUS"].sort());
assert.equal(protectedSmallGroup.faixas.find((x) => x.codigo === "AGE_18_24")?.total, null);
assert.equal(protectedSmallGroup.faixas.find((x) => x.codigo === "AGE_18_PLUS")?.total, null);

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

console.log("Age intelligence runtime OK: cobertura, legado, supressão complementar e diversidade geracional.");
