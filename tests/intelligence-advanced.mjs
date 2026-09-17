import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const mod = await import("../dist-server/src/intelligence/advancedIntelligence.js");
const fiscalMod = await import("../dist-server/src/intelligence/fiscalEngine.js");

process.env.MANAUS_INSTITUTIONS_JSON = JSON.stringify([
  { key: "fundo_teste", nome: "Fundo Municipal Teste", sigla: "FMT", cnpj: "12.345.678/0001-90", tipo: "fundo", ativo: true },
  { key: "invalido", nome: "Inválido", cnpj: "123", tipo: "outro", ativo: true },
]);

const institutions = mod.manausInstitutions();
assert.equal(institutions.some((item) => item.cnpj === "04365326000173"), true, "Município de Manaus deve permanecer no cadastro padrão");
assert.equal(institutions.some((item) => item.cnpj === "12345678000190"), true, "Cadastro institucional configurável deve aceitar CNPJ válido");
assert.equal(institutions.some((item) => item.cnpj === "123"), false, "Cadastro institucional deve rejeitar CNPJ inválido");

const fiscal = fiscalMod.buildFiscalEngine([
  { conta: "TOTAL DA RECEITA", coluna: "PREVISÃO ATUALIZADA", valor: 1000 },
  { conta: "TOTAL DA RECEITA", coluna: "RECEITAS REALIZADAS", valor: 900 },
  { conta: "TOTAL DA DESPESA", coluna: "DESPESAS EMPENHADAS", valor: 800 },
  { conta: "TOTAL DA DESPESA", coluna: "DESPESAS LIQUIDADAS", valor: 700 },
  { conta: "TOTAL DA DESPESA", coluna: "DESPESAS PAGAS", valor: 650 },
  { conta: "SUBCONTA", coluna: "DESPESAS EMPENHADAS", valor: 100 },
]);
assert.equal(fiscal.stages.previsto?.value, 1000);
assert.equal(fiscal.stages.realizado?.value, 900);
assert.equal(fiscal.stages.empenhado?.value, 800);
assert.equal(fiscal.stages.liquidado?.value, 700);
assert.equal(fiscal.stages.pago?.value, 650);
assert.equal(fiscal.candidateCounts.empenhado, 2);

const quality = mod.territorialQuality({
  raw: { works: [{}, {}, {}], health: [{}, {}], schools: [{}, {}] },
  territories: [
    { bairro: "A", demandas: 0, prioritarias: 0, concluidas: 0, taxaConclusao: 0, temas: 0, obras: 1, unidadesSaude: 1, escolas: 1, semClassificacao: 0 },
    { bairro: "B", demandas: 0, prioritarias: 0, concluidas: 0, taxaConclusao: 0, temas: 0, obras: 1, unidadesSaude: 0, escolas: 1, semClassificacao: 0 },
  ],
});
const worksQuality = quality.dimensions.find((item) => item.key === "works");
const healthQuality = quality.dimensions.find((item) => item.key === "health");
assert.equal(worksQuality?.received, 3);
assert.equal(worksQuality?.classified, 2);
assert.equal(worksQuality?.unclassified, 1);
assert.equal(Number(worksQuality?.coverage.toFixed(4)), Number((2 / 3).toFixed(4)));
assert.equal(healthQuality?.received, 2);
assert.equal(healthQuality?.classified, 1);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pulso-inep-"));
const csvPath = path.join(tempDir, "censo.csv");
fs.writeFileSync(csvPath, [
  "CO_MUNICIPIO;NO_MUNICIPIO;CO_ENTIDADE;NO_ENTIDADE",
  "1302603;Manaus;1;Escola Manaus A",
  "1302603;Manaus;2;Escola Manaus B",
  "1302504;Manacapuru;3;Escola Fora",
].join("\n"), "utf8");
process.env.INEP_CENSO_ESCOLAR_FILE = csvPath;
const inep = mod.loadInepMicrodataFile();
assert.equal(inep.availability, "available");
assert.equal(inep.data.length, 2);
assert.equal(inep.quality.classified, 2);
fs.rmSync(tempDir, { recursive: true, force: true });

for (const key of ["TCE_AM_API_TOKEN", "TCE_AM_CLIENT_ID", "TCE_AM_USERNAME", "TCE_AM_PASSWORD"]) delete process.env[key];
const tce = await mod.loadTceFinancialPortfolio(2026);
assert.equal(tce.availability, "not_configured", "TCE avançado deve ser explícito quando não houver credenciais");

const appSource = fs.readFileSync(new URL("../src/server/app.ts", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("../src/intelligence/advancedRoutes.ts", import.meta.url), "utf8");
const refreshSource = fs.readFileSync(new URL("../src/intelligence/refresh.ts", import.meta.url), "utf8");
const productionSource = fs.readFileSync(new URL("../src/server/productionIntelligenceRoutes.ts", import.meta.url), "utf8");
const adminGuard = 'app.use("/api/intelligence", requireAdmin)';
assert.ok(appSource.includes(adminGuard), "Intelligence deve permanecer atrás do middleware ADMIN");
assert.ok(appSource.indexOf(adminGuard) < appSource.indexOf("setupProductionIntelligenceRoutes(app)"), "Rotas Intelligence de produção devem ser registradas depois do middleware ADMIN");
assert.ok(appSource.includes("setupProductionIntelligenceRoutes(app)"), "Produção deve registrar implementação Intelligence compatível com Postgres");
assert.ok(appSource.indexOf("setupProductionIntelligenceRoutes(app)") < appSource.lastIndexOf('app.use(["/api/intelligence", "/api/admin/strategy"]'), "Fallback fail-closed deve vir depois das rotas Intelligence suportadas em produção");
assert.ok(appSource.includes("Operação interna ainda não migrada para a persistência de produção."), "Operações Intelligence não migradas devem continuar fail-closed em produção");
for (const route of ["/api/intelligence/works", "/api/intelligence/sources/health", "/api/intelligence/institutions", "/api/intelligence/fiscal/overview", "/api/intelligence/quality/territorial", "/api/intelligence/context", "/api/intelligence/insights", "/api/intelligence/refresh/status", "/api/intelligence/refresh"]) {
  assert.ok(productionSource.includes(route), `Rota Intelligence de produção ausente: ${route}`);
}
for (const route of ["/api/intelligence/institutions", "/api/intelligence/contracts/institutional", "/api/intelligence/fiscal/overview", "/api/intelligence/health/cnes", "/api/intelligence/education/inep", "/api/intelligence/tce/portfolio", "/api/intelligence/financial-crosswalk", "/api/intelligence/quality/territorial", "/api/intelligence/series"]) {
  assert.ok(routeSource.includes(route), `Rota avançada local ausente: ${route}`);
}
assert.ok(refreshSource.includes("`fiscal_${stage}`"), "Refresh deve criar snapshots fiscais por estágio");
assert.ok(refreshSource.includes('from "./fiscalEngine.js"'), "Refresh deve usar o motor fiscal canônico");
assert.ok(routeSource.includes('from "./fiscalEngine.js"'), "Endpoint fiscal deve usar o motor fiscal canônico");
assert.ok(routeSource.includes('from "./financialCrosswalk.js"'), "Cruzamento financeiro deve usar o motor fiscal canônico");
assert.ok(refreshSource.includes("saveFiscalSnapshots"), "Refresh deve persistir séries fiscais");

console.log("Advanced Intelligence OK: P9-P17 contracts, fiscal engine, INEP, quality, TCE guard, produção Postgres e rotas protegidas validadas.");
