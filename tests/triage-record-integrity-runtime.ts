import {
  ADMIN_DEMAND_LIST_LIMIT,
  normalizeAdminDemandListFilters,
} from "../src/server/adminDemandListIntegrity.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

expect(ADMIN_DEMAND_LIST_LIMIT === 500, "Limite T2 deve ser 500.");

let result = normalizeAdminDemandListFilters({});
expect(result.ok, "Filtros vazios devem ser válidos.");

result = normalizeAdminDemandListFilters({
  status: " recebida ",
  prioridade: " media ",
  protocolo: " am-2026 ",
  municipio: " Manaus ",
  bairro: " Centro ",
  categoria: " infraestrutura_urbana ",
  tipo_problema: " buraco_pavimentacao ",
});
expect(result.ok, "Filtros legítimos devem ser aceitos.");
if (result.ok) {
  expect(result.filters.status === "RECEBIDA", "Status deve ser normalizado.");
  expect(result.filters.prioridade === "MEDIA", "Prioridade deve ser normalizada.");
  expect(result.filters.categoria === "INFRAESTRUTURA_URBANA", "Categoria deve ser normalizada.");
  expect(result.filters.tipoProblema === "BURACO_PAVIMENTACAO", "Tipo deve ser normalizado.");
  expect(result.filters.municipio === "Manaus", "Município deve preservar caixa e remover espaços.");
}

result = normalizeAdminDemandListFilters({ status: "APAGADA" });
expect(!result.ok && result.error === "Status inválido.", "Status fora da taxonomia deve falhar fechado.");

result = normalizeAdminDemandListFilters({ prioridade: "URGENTE" });
expect(!result.ok && result.error === "Prioridade inválida.", "Prioridade fora da taxonomia deve falhar fechado.");

result = normalizeAdminDemandListFilters({ categoria: "INEXISTENTE" });
expect(!result.ok && result.error === "Categoria inválida.", "Categoria inexistente deve falhar fechado.");

result = normalizeAdminDemandListFilters({ tipo_problema: "BURACO_PAVIMENTACAO" });
expect(!result.ok && result.error.includes("Categoria é obrigatória"), "Tipo sem categoria deve ser recusado.");

result = normalizeAdminDemandListFilters({
  categoria: "SAUDE",
  tipo_problema: "BURACO_PAVIMENTACAO",
});
expect(!result.ok && result.error.includes("Tipo de problema inválido"), "Tipo incompatível com categoria deve ser recusado.");

result = normalizeAdminDemandListFilters({
  protocolo: "x".repeat(200),
  municipio: "m".repeat(300),
  bairro: "b".repeat(300),
});
expect(result.ok, "Filtros textuais longos devem ser limitados, não quebrar.");
if (result.ok) {
  expect(result.filters.protocolo.length === 80, "Protocolo deve limitar 80 caracteres.");
  expect(result.filters.municipio.length === 120, "Município deve limitar 120 caracteres.");
  expect(result.filters.bairro.length === 160, "Bairro deve limitar 160 caracteres.");
}

console.log("T2 triage record integrity runtime: ok");
