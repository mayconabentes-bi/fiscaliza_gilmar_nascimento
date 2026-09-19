import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const workflow = fs.readFileSync("src/shared/demandStatusWorkflow.ts", "utf8");
const routes = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const fast = fs.readFileSync("src/server/productionFastAdminRoutes.ts", "utf8");
const ui = fs.readFileSync("src/pages/AdminDemandas.tsx", "utf8");

expect(workflow.includes('CONCLUIDA: []'), "CONCLUIDA deve ser terminal.");
expect(workflow.includes('INDEFERIDA: []'), "INDEFERIDA deve ser terminal.");
expect(workflow.includes('if (from === to) return true'), "Mudança apenas de prioridade deve manter o mesmo status permitido.");
expect(workflow.includes('RECEBIDA: ["EM_TRIAGEM", "ENCAMINHADA", "EM_ANALISE", "EM_EXECUCAO", "CONCLUIDA", "INDEFERIDA"]'), "Fluxos já observados em produção devem permanecer compatíveis.");
expect(workflow.includes('EM_EXECUCAO: ["EM_ANALISE", "CONCLUIDA", "INDEFERIDA"]'), "Execução não deve voltar arbitrariamente a estados iniciais.");

const start = routes.indexOf('app.patch("/api/admin/demandas/:id/status"');
const end = routes.indexOf('app.get("/api/admin/evidencias/pendentes"', start);
const block = routes.slice(start, end);

expect(block.includes("expected_updated_at"), "PATCH T4 deve exigir versão do registro.");
expect(block.includes("updated_at::text as updated_at"), "Backend deve comparar versão textual exata do Postgres.");
expect(block.includes("for update"), "Atualização deve continuar serializada no banco.");
expect(block.includes("STALE_DEMAND_VERSION"), "Conflito otimista deve possuir código explícito.");
expect(block.includes("INVALID_STATUS_TRANSITION"), "Transição inválida deve possuir código explícito.");
expect(block.includes("canTransitionDemandStatus"), "Backend deve usar política compartilhada.");
expect(block.includes("res.status(409)"), "Conflitos de estado/versão devem responder 409.");
expect(block.indexOf("STALE_DEMAND_VERSION") < block.indexOf("update public.demandas"), "Conflito deve ser detectado antes da escrita.");

expect(routes.includes("updated_at::text as updated_at"), "Fallback deve fornecer versão exata à UI.");
expect(fast.includes("updated_at::text as updated_at"), "Fast path deve fornecer a mesma versão exata.");
expect(ui.includes("expected_updated_at: demandaSelecionada.updated_at"), "UI deve enviar a versão que abriu.");
expect(ui.includes("canTransitionDemandStatus(demandaSelecionada.status, option.value)"), "UI deve oferecer apenas transições server-compatible.");
expect(ui.includes('data?.code === "STALE_DEMAND_VERSION"'), "UI deve tratar edição obsoleta explicitamente.");
expect(ui.includes("setDemandaSelecionada(null)"), "UI deve fechar modal obsoleto após conflito.");

console.log("T4 demand status integrity contract: ok");
