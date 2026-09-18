import assert from "node:assert/strict";
import {
  DEMAND_TAXONOMY,
  demandCategoryLabel,
  demandProblemLabel,
  isValidDemandCategory,
  isValidDemandClassification,
} from "../src/shared/demandTaxonomy.ts";

assert.equal(DEMAND_TAXONOMY.length, 9, "Esperadas 9 macroáreas.");
assert(DEMAND_TAXONOMY.every((category) => category.problems.length > 0), "Toda macroárea deve ter ao menos um tipo.");

const categoryCodes = new Set(DEMAND_TAXONOMY.map((category) => category.code));
assert.equal(categoryCodes.size, DEMAND_TAXONOMY.length, "Códigos de macroárea devem ser únicos.");

const problemCodes = new Set<string>();
for (const category of DEMAND_TAXONOMY) {
  assert.equal(isValidDemandCategory(category.code), true);
  assert.equal(demandCategoryLabel(category.code), category.label);
  for (const problem of category.problems) {
    assert.equal(isValidDemandClassification(category.code, problem.code), true, `Combinação válida rejeitada: ${category.code}/${problem.code}`);
    assert.equal(demandProblemLabel(category.code, problem.code), problem.label);
    assert(!problemCodes.has(problem.code), `Código de problema duplicado: ${problem.code}`);
    problemCodes.add(problem.code);
  }
}

assert.equal(isValidDemandCategory("INVENTADO"), false);
assert.equal(isValidDemandClassification("INFRAESTRUTURA_URBANA", "SEMAFORO"), false);
assert.equal(isValidDemandClassification("MOBILIDADE_TRANSITO", "BURACO_PAVIMENTACAO"), false);
assert.equal(isValidDemandClassification("OUTRO", "BURACO_PAVIMENTACAO"), false);

console.log(`Demand taxonomy runtime OK: ${DEMAND_TAXONOMY.length} macroáreas e ${problemCodes.size} tipos válidos.`);
