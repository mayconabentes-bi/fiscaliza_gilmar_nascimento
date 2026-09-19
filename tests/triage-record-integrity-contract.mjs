import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const routes = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const fastRoutes = fs.readFileSync("src/server/productionFastAdminRoutes.ts", "utf8");
const ui = fs.readFileSync("src/pages/AdminDemandas.tsx", "utf8");
const integrity = fs.readFileSync("src/server/adminDemandListIntegrity.ts", "utf8");

expect(routes.includes('app.get("/api/admin/demandas"'), "T2 deve preservar endpoint administrativo de listagem.");
expect(routes.includes("normalizeAdminDemandListFilters"), "Listagem deve validar filtros por helper central.");
expect(routes.includes("ADMIN_DEMAND_LIST_LIMIT"), "Listagem deve usar limite central explícito.");
expect(routes.includes("order by created_at desc, id desc"), "Ordenação deve ter desempate determinístico por id.");
expect(routes.includes("select count(*)::int as total"), "Listagem deve retornar total real dos filtros.");
expect(routes.includes("truncated: total > rows.length"), "Listagem deve sinalizar truncamento.");
expect(routes.includes("items: rows"), "Resposta deve usar envelope items/total.");

const listStart = routes.indexOf('app.get("/api/admin/demandas"');
const listEnd = routes.indexOf('app.get("/api/admin/demandas/:id/evidencia"', listStart);
const listBlock = routes.slice(listStart, listEnd);
for (const sensitive of ["nome_solicitante", "contato", "observacao_interna", "usuario_id"]) {
  expect(!listBlock.includes(sensitive), `Fallback T2 não deve expor ${sensitive}.`);
  const fastStart = fastRoutes.indexOf('app.get("/api/admin/demandas"');
  const fastEnd = fastRoutes.indexOf('/** Diagnóstico autenticado', fastStart);
  const fastBlock = fastRoutes.slice(fastStart, fastEnd);
  expect(!fastBlock.includes(sensitive), `Fast path T2 não deve expor ${sensitive}.`);
}

expect(integrity.includes("isValidDemandCategory"), "Categoria deve usar taxonomia compartilhada.");
expect(integrity.includes("isValidDemandClassification"), "Tipo de problema deve ser validado dentro da categoria.");
expect(integrity.includes("ADMIN_DEMAND_LIST_LIMIT = 500"), "Limite atual deve estar explícito e centralizado.");
expect(fastRoutes.includes("normalizeAdminDemandListFilters"), "Fast path deve usar o mesmo normalizador T2.");
expect(fastRoutes.includes("items: rows") && fastRoutes.includes("truncated: total > rows.length"), "Fast path deve usar o mesmo envelope íntegro.");
expect(fastRoutes.includes("evidencia_upload_solicitadas") && fastRoutes.includes("evidencia_upload_falhas"), "Fast path deve preservar contadores P1.2 usados pela UI.");

expect(ui.includes("totalDemandas"), "UI deve exibir total real.");
expect(ui.includes("listaTruncada"), "UI deve tratar truncamento.");
expect(ui.includes("Há mais registros do que o limite atual de 500"), "Operador deve ser avisado quando a lista não couber inteira.");
expect(ui.includes("Array.isArray(data?.items)"), "UI deve consumir o envelope T2.");

console.log("T2 triage record integrity contract: ok");
