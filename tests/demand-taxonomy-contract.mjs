import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const taxonomy = read("src/shared/demandTaxonomy.ts");
const form = read("src/pages/NovaDemanda.tsx");
const postgres = read("src/server/citizenDemandPostgres.ts");
const local = read("src/server/routes.ts");
const admin = read("src/pages/AdminDemandas.tsx");
const adminFast = read("src/server/productionFastAdminRoutes.ts");
const radar = read("src/server/productionRadarRoutes.ts");
const expand = read("supabase/migrations/20260918151000_demand_taxonomy_expand.sql");
const enforce = read("supabase/migrations/20260918152000_demand_taxonomy_enforce.sql");

for (const code of [
  "INFRAESTRUTURA_URBANA","LIMPEZA_URBANA","MOBILIDADE_TRANSITO","MEIO_AMBIENTE",
  "SAUDE","EDUCACAO","ASSISTENCIA_SOCIAL","SEGURANCA_ORDEM_URBANA","OUTRO"
]) {
  expect(taxonomy.includes(`code: "${code}"`), `Macroárea ausente: ${code}`);
  expect(enforce.includes(`'${code}'`), `Constraint não contém macroárea: ${code}`);
}

expect(form.includes("DEMAND_TAXONOMY.map"), "Formulário deve derivar macroáreas da taxonomia compartilhada.");
expect(form.includes('name="tipo_problema"'), "Formulário deve coletar tipo_problema.");
expect(form.includes("selectedCategory.problems.map"), "Tipos devem depender da macroárea selecionada.");
expect(form.includes("tipo_problema: form.tipo_problema"), "Rascunho seguro deve preservar tipo estruturado.");

for (const source of [postgres, local]) {
  expect(source.includes("isValidDemandClassification"), "Backend deve validar categoria + tipo pela taxonomia compartilhada.");
  expect(source.includes("tipo_problema"), "Backend deve persistir tipo_problema.");
}

expect(admin.includes("demandProblemLabel"), "Triagem deve exibir rótulo humano do tipo.");
expect(admin.includes("demandCategoryLabel"), "Triagem deve exibir macroárea humana.");
expect(adminFast.includes("d.tipo_problema"), "Fast path ADMIN deve retornar tipo_problema.");
expect(radar.includes("porTipo"), "Radar deve agregar por tipo de problema.");
expect(radar.includes("demandasPorTipo"), "Resumo do Radar deve expor agregado por tipo.");

expect(expand.includes("add column if not exists tipo_problema text"), "Migration expand deve ser backward-compatible.");
expect(!expand.includes("set not null"), "Migration expand não deve bloquear aplicação antiga.");
expect(enforce.includes("alter column tipo_problema set not null"), "Migration enforce deve tornar tipo obrigatório.");
expect(enforce.includes("demandas_tipo_problema_taxonomia_check"), "Migration enforce deve validar pares categoria/tipo.");
expect(enforce.includes("not valid"), "Constraint deve ser criada com validação controlada.");
expect(enforce.includes("validate constraint"), "Constraint deve ser validada antes do NOT NULL.");

console.log("Demand taxonomy contract OK: UI, backends, ADMIN, Radar and migrations aligned.");
