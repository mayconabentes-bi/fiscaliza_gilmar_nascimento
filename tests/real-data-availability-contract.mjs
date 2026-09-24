import assert from "node:assert/strict";
import { isTransientExternalFailure } from "./real-data-availability.mjs";

const pncp = (error, availability = "unavailable") => ({
  source: "pncp_manaus_cnpjs", availability, error,
});
assert.equal(isTransientExternalFailure(pncp(
  "Falhas parciais: PMM página 1: HTTP 429 | SEMSA página 1: HTTP 429 | IMMU página 1: HTTP 429"
)), true, "limite temporário 429 do PNCP deve gerar aviso, não falso defeito do build");
assert.equal(isTransientExternalFailure(pncp("PMM: HTTP 503 | SEMSA: HTTP 429")), true);
assert.equal(isTransientExternalFailure(pncp("PMM: HTTP 429 | SEMSA: HTTP 400")), false,
  "não esconder erros permanentes misturados aos 429");
assert.equal(isTransientExternalFailure(pncp("PNCP respondeu JSON inválido")), false);
assert.equal(isTransientExternalFailure(pncp("PMM: HTTP 429", "degraded")), false,
  "indisponibilidade parcial com dados deve passar pelas verificações dos dados retornados");
assert.equal(isTransientExternalFailure({
  source: "outro_provedor", availability: "unavailable", error: "HTTP 429",
}), false, "não flexibilizar indiscriminadamente as outras fontes");
assert.equal(isTransientExternalFailure({
  source: "outro_provedor", availability: "unavailable", error: "fetch failed: timeout",
}), true, "manter tratamento transitório já existente");

console.log("Deep QA availability: limites PNCP e erros permanentes discriminados corretamente.");
