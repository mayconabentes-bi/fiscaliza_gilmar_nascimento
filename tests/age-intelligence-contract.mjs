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
const migration = read("supabase/migrations/20260918145150_age_intelligence_bands_only.sql");

for (const code of ["AGE_16_17", "AGE_18_24", "AGE_25_34", "AGE_35_44", "AGE_45_59", "AGE_60_PLUS"]) {
  expect(agePolicy.includes(code), `agePolicy deve aceitar ${code}.`);
  expect(migration.includes(code), `migration deve aceitar ${code}.`);
}

for (const code of ["AGE_18_24", "AGE_25_34", "AGE_35_44", "AGE_45_59", "AGE_60_PLUS"]) {
  expect(register.includes(`option value="${code}"`), `Cadastro deve oferecer ${code}.`);
  expect(demandForm.includes(`option value="${code}"`), `Demanda deve oferecer ${code}.`);
}

expect(!register.includes('option value="AGE_18_PLUS"'), "Cadastro novo não deve oferecer a faixa legada AGE_18_PLUS.");
expect(!demandForm.includes('option value="AGE_18_PLUS"'), "Demanda nova não deve oferecer a faixa legada AGE_18_PLUS.");
expect(!migration.includes("AGE_18_PLUS"), "Migration efetiva não deve aceitar AGE_18_PLUS.");

expect(stats.includes("exatamente um grupo") && stats.includes("subtração do total"), "Estatística deve aplicar supressão complementar somente quando houver um único grupo pequeno.");
expect(stats.includes("Math.log(6)"), "Diversidade deve usar normalização fixa das seis faixas detalhadas.");
expect(stats.includes("CIVIC_AGGREGATE") === false, "Módulo estatístico puro não deve depender diretamente do ambiente.");

expect(radarRoutes.includes("buildAgeIntelligenceAggregate"), "Resumo do Radar deve usar o módulo estatístico testado.");
expect(radarRoutes.includes("demografiaEtaria"), "Resumo do Radar deve retornar somente o agregado demográfico.");
expect(!radarRoutes.includes("faixa_etaria, bairro"), "Radar não deve cruzar faixa etária com bairro.");
expect(app.includes('app.use("/api/radar/manaus", requireAdmin)'), "Radar etário deve permanecer no perímetro ADMIN.");

expect(radarPage.includes("Perfil etário dos registros"), "Radar deve exibir o card etário.");
expect(radarPage.includes("Outras faixas protegidas"), "UI deve consolidar grupos pequenos sem expor faixas individuais.");
expect(radarPage.includes("Faixas com leitura segura"), "UI deve indicar quantas faixas podem ser exibidas com segurança.");
expect(radarPage.includes("Faltam"), "UI deve mostrar progresso objetivo para liberar o índice de diversidade.");
expect(radarPage.includes("Cobertura etária"), "UI deve mostrar cobertura estatística.");
expect(radarPage.includes("Classificação detalhada"), "UI deve separar cobertura detalhada de legado.");
expect(radarPage.includes("Diversidade geracional"), "UI deve preparar índice de diversidade.");
expect(!radarPage.includes("faixa etária por bairro"), "UI não deve apresentar cruzamento idade x bairro.");

expect(!agePolicy.includes("AGE_18_PLUS"), "Backend não deve aceitar a faixa legada AGE_18_PLUS.");
console.log("Age intelligence contract OK: apenas faixas detalhadas, ADMIN-only e agregação protegida.");
