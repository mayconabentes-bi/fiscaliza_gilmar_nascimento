import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const agePolicy = read("src/server/agePolicy.ts");
const register = read("src/pages/RegisterCidadao.tsx");
const demandForm = read("src/pages/NovaDemanda.tsx");
const stats = read("src/server/ageIntelligence.ts");
const radarRoutes = read("src/server/productionRadarRoutes.ts");
const radarPage = read("src/pages/RadarTerritorial.tsx");
const app = read("src/server/app.ts");
const migration = read("supabase/migrations/20260918143000_age_intelligence_bands.sql");

for (const code of ["AGE_16_17", "AGE_18_24", "AGE_25_34", "AGE_35_44", "AGE_45_59", "AGE_60_PLUS", "AGE_18_PLUS"]) {
  expect(agePolicy.includes(code), `agePolicy deve aceitar ${code}.`);
  expect(migration.includes(code), `migration deve aceitar ${code}.`);
}

for (const code of ["AGE_18_24", "AGE_25_34", "AGE_35_44", "AGE_45_59", "AGE_60_PLUS"]) {
  expect(register.includes(`option value="${code}"`), `Cadastro deve oferecer ${code}.`);
  expect(demandForm.includes(`option value="${code}"`), `Demanda deve oferecer ${code}.`);
}

expect(!register.includes('option value="AGE_18_PLUS"'), "Cadastro novo não deve oferecer a faixa legada AGE_18_PLUS.");
expect(!demandForm.includes('option value="AGE_18_PLUS"'), "Demanda nova não deve oferecer a faixa legada AGE_18_PLUS.");
expect(migration.includes("AGE_18_PLUS permanece válido"), "Migration deve preservar compatibilidade histórica.");
expect(migration.includes("Não cria data de nascimento"), "Migration deve documentar minimização de dados.");

expect(stats.includes("supressão complementar") || stats.includes("Supressão complementar"), "Estatística deve aplicar supressão complementar.");
expect(stats.includes("Math.log(6)"), "Diversidade deve usar normalização fixa das seis faixas detalhadas.");
expect(stats.includes("CIVIC_AGGREGATE") === false, "Módulo estatístico puro não deve depender diretamente do ambiente.");

expect(radarRoutes.includes("buildAgeIntelligenceAggregate"), "Resumo do Radar deve usar o módulo estatístico testado.");
expect(radarRoutes.includes("demografiaEtaria"), "Resumo do Radar deve retornar somente o agregado demográfico.");
expect(!radarRoutes.includes("faixa_etaria, bairro"), "Radar não deve cruzar faixa etária com bairro.");
expect(app.includes('app.use("/api/radar/manaus", requireAdmin)'), "Radar etário deve permanecer no perímetro ADMIN.");

expect(radarPage.includes("Perfil etário dos registros"), "Radar deve exibir o card etário.");
expect(radarPage.includes("Amostra protegida"), "UI deve comunicar supressão de grupos pequenos.");
expect(radarPage.includes("Cobertura etária"), "UI deve mostrar cobertura estatística.");
expect(radarPage.includes("Classificação detalhada"), "UI deve separar cobertura detalhada de legado.");
expect(radarPage.includes("Diversidade geracional"), "UI deve preparar índice de diversidade.");
expect(!radarPage.includes("faixa etária por bairro"), "UI não deve apresentar cruzamento idade x bairro.");

console.log("Age intelligence contract OK: faixas detalhadas, legado preservado, ADMIN-only e agregação protegida.");
