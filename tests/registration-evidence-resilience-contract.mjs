import fs from "node:fs";
import path from "node:path";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const server = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");
const storage = fs.readFileSync("src/server/evidenceStorage.ts", "utf8");
const security = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");
const client = fs.readFileSync("src/pages/NovaDemanda.tsx", "utf8");
const adminServer = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const adminClient = fs.readFileSync("src/pages/AdminDemandas.tsx", "utf8");
const migrationsDir = "supabase/migrations";
const migrationName = fs.readdirSync(migrationsDir).find((name) => name.endsWith("_demand_evidence_resilience.sql"));
expect(Boolean(migrationName), "Migração P1.2 de resiliência deve existir.");
const migration = fs.readFileSync(path.join(migrationsDir, migrationName), "utf8");

expect(migration.includes("evidencia_upload_status"), "Migração deve persistir o estado de upload.");
expect(migration.includes("evidencia_upload_solicitadas"), "Migração deve registrar quantas fotos foram solicitadas.");
expect(migration.includes("evidencia_upload_anexadas"), "Migração deve registrar quantas fotos foram anexadas.");
expect(migration.includes("evidencia_upload_falhas"), "Migração deve registrar falhas sem armazenar Base64.");
expect(migration.includes("'NAO_SOLICITADO','COMPLETO','PARCIAL','FALHA'"), "Status de upload deve ser restrito.");
expect(!migration.toLowerCase().includes("base64"), "Migração não deve persistir conteúdo Base64.");

expect(storage.includes("EvidenceStorageUnavailableError"), "Storage deve distinguir indisponibilidade transitória.");
expect(storage.includes("AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS)"), "Chamadas ao Storage devem possuir timeout.");
expect(storage.includes("STORAGE_UPLOAD_ATTEMPTS = 2"), "Upload deve tentar novamente uma vez antes de degradar.");
expect(storage.includes("status === 429 || status >= 500"), "Retry deve se limitar a falhas transitórias.");

expect(security.includes("error instanceof EvidenceStorageUnavailableError"), "Readiness deve degradar apenas indisponibilidade transitória.");
expect(security.includes("validateStorageServiceKey"), "Readiness deve manter validação forte da credencial.");
expect(security.includes("evidenceStorage = \"degraded\""), "Readiness deve sinalizar Storage degradado sem derrubar o serviço.");

expect(server.includes("isEvidenceValidationFailure(result.reason)"), "Foto inválida deve continuar sendo erro de validação.");
expect(server.includes("throw validationFailure.reason"), "Foto inválida não pode ser silenciosamente descartada.");
expect(server.includes("result.status === \"fulfilled\" ? [{ ...result.value, ordem: index + 1 }]"), "Ordem original das fotos válidas deve ser preservada.");
expect(server.includes("evidenceSummary = summarizeEvidenceUpload"), "Backend deve resumir upload parcial/total.");
expect(server.includes("evidencia_upload_status, evidencia_upload_solicitadas, evidencia_upload_anexadas, evidencia_upload_falhas"), "Insert deve persistir telemetria de resiliência.");
expect(server.includes("return res.status(201).json({ id, protocolo, status: \"RECEBIDA\", ...evidenceResponse(evidenceSummary) })"), "Falha de Storage não deve impedir protocolo 201.");
expect(!server.includes("const failed = uploads.find"), "Backend não deve abortar o registro por qualquer falha de upload.");

expect(client.includes("setEvidenceWarning(String(data.warning || \"\"))"), "Frontend deve mostrar aviso de evidência sem esconder o protocolo.");
expect(client.includes('role="status"') && client.includes("evidenceWarning"), "Aviso deve ser acessível após o protocolo.");
expect(adminServer.includes("evidencia_upload_falhas"), "API administrativa deve expor falha técnica.");
expect(adminClient.includes("Falha técnica no envio de evidências"), "Triagem deve visualizar falhas de upload.");

console.log("registration P1.2 evidence resilience contract: ok");
