import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const storage = fs.readFileSync("src/server/evidenceStorage.ts", "utf8");
const routes = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const fast = fs.readFileSync("src/server/productionFastAdminRoutes.ts", "utf8");
const retention = fs.readFileSync("src/server/retentionPostgres.ts", "utf8");
const reconciliation = fs.readFileSync("src/server/evidenceReconciliationPostgres.ts", "utf8");
const ui = fs.readFileSync("src/pages/AdminDemandas.tsx", "utf8");

expect(storage.includes("export function validateEvidenceObjectPath"), "T3 deve validar caminhos antes de assinar/remover.");
expect(storage.includes("Math.min(300"), "URLs assinadas devem ter TTL máximo de 300s.");
expect(storage.includes("throw new EvidenceStorageUnavailableError()"), "Falha de Storage deve propagar como erro operacional.");
expect(!storage.includes('if (!response.ok) console.error("Falha ao remover evidência órfã:"'), "DELETE não pode falhar silenciosamente.");

const itemStart = routes.indexOf('app.post("/api/admin/evidencias/item/:id/decisao"');
const itemEnd = routes.indexOf('app.post("/api/admin/evidencias/:id/decisao"', itemStart);
const itemBlock = routes.slice(itemStart, itemEnd);
expect(itemBlock.includes("for update"), "Moderação individual deve serializar a evidência.");
expect(itemBlock.includes("REJECTED_EVIDENCE_IS_TERMINAL"), "Rejeição deve ser estado terminal.");
expect(itemBlock.includes("ANONYMIZATION_REQUIRED_BEFORE_APPROVAL"), "Anonimização deve bloquear aprovação direta.");
expect(itemBlock.indexOf("set moderacao_status") < itemBlock.indexOf("await removeDemandEvidence"), "Banco deve bloquear acesso antes do DELETE físico.");
expect(itemBlock.indexOf("await removeDemandEvidence") < itemBlock.lastIndexOf("set storage_path = null"), "storage_path só pode ser limpo após DELETE confirmado.");
expect(itemBlock.includes("EVIDENCE_DELETE_PENDING"), "Falha de DELETE deve ser retentável e explícita.");

expect(routes.includes("EVIDENCIA_ACESSIVEIS"), "Acesso assinado deve possuir allowlist de estados.");
expect(routes.includes("moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA')"), "Evidência rejeitada/expirada não deve gerar URL.");
expect(routes.includes('/api/admin/evidencias/orfaos-preview'), "T3 deve ter preview de órfãos.");
expect(routes.includes('/api/admin/evidencias/orfaos-run'), "T3 deve ter reconciliação explícita.");
expect(routes.includes("req.body?.confirm !== true"), "Reconciliação destrutiva deve exigir confirmação.");

expect(reconciliation.includes("EVIDENCE_ORPHAN_GRACE_HOURS = 24"), "Órfãos devem respeitar carência de 24h.");
expect(reconciliation.includes("d.path is null"), "Reconciliação só pode remover objetos sem referência no banco.");
expect(retention.includes("evidenceObjectsFailed"), "Retenção deve reportar falhas físicas.");
expect(retention.includes("for (const path of removedPaths)"), "Retenção só deve limpar referências de objetos removidos.");
expect(retention.includes("public.demanda_evidencias"), "Retenção deve cobrir multi-evidência.");

for (const source of [routes, fast]) {
  expect(source.includes("moderacao_status in ('PENDENTE','REQUER_ANONIMIZACAO','APROVADA_PRIVADA')"), "Fast path e fallback devem ocultar evidências bloqueadas.");
}

expect(ui.includes('evidenciaStatusAtual === "REQUER_ANONIMIZACAO"'), "UI deve reconhecer anonimização pendente.");
expect(ui.includes("até existir uma versão realmente anonimizada"), "UI deve explicar que status não anonimiza a imagem.");

console.log("T3 evidence integrity contract: ok");
