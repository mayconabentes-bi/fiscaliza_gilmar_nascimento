import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const server = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");
const client = fs.readFileSync("src/pages/NovaDemanda.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260919191500_demand_idempotency.sql", "utf8");

expect(migration.includes("idempotency_key uuid"), "Migração deve criar idempotency_key como UUID.");
expect(migration.includes("request_fingerprint varchar(64)"), "Migração deve persistir fingerprint SHA-256.");
expect(migration.includes("create unique index if not exists idx_demandas_idempotency_key"), "Banco deve impor unicidade da chave.");
expect(migration.includes("where idempotency_key is not null"), "Índice deve preservar compatibilidade com linhas históricas.");

expect(server.includes('req.get("Idempotency-Key")'), "Backend deve ler Idempotency-Key.");
expect(server.includes('normalizeIdempotencyKey(req.get("Idempotency-Key")) || uuidv4()'), "Clientes antigos devem continuar funcionando.");
expect(server.includes("demandRequestFingerprint"), "Backend deve gerar fingerprint semântico.");
expect(server.includes("fotoEvidenciasBase64.map(hashDemandEvidence)"), "Fingerprint deve cobrir evidências.");
expect(server.includes("where idempotency_key = ${idempotencyKey}"), "Backend deve consultar replay pela chave.");
expect(server.includes('res.setHeader("Idempotent-Replay", "true")'), "Replay deve ser explicitamente sinalizado.");
expect(server.includes('code: "IDEMPOTENCY_KEY_REUSED"'), "Reuso com payload diferente deve ser rejeitado.");
expect(server.includes("idempotency_key, request_fingerprint"), "Insert deve persistir chave e fingerprint.");

const precheck = server.indexOf("const [existingDemand] = await sql`");
const upload = server.indexOf("uploadDemandEvidence(id, photo)");
expect(precheck >= 0 && upload >= 0 && precheck < upload, "Replay normal deve ser detectado antes de novo upload.");

const race = server.indexOf('if (error?.code === "23505")');
const cleanup = server.indexOf("removeDemandEvidence(item.path)", race);
const replayReturn = server.indexOf("idempotent_replay: true", race);
expect(race >= 0 && cleanup > race && replayReturn > cleanup, "Corrida concorrente deve limpar uploads perdedores antes de retornar replay.");

expect(client.includes("sessionStorage.getItem(DEMAND_IDEMPOTENCY_STORAGE_KEY)"), "Cliente deve preservar a chave entre retries.");
expect(client.includes('"Idempotency-Key": idempotencyKey'), "Cliente deve enviar a chave no header.");
expect(client.includes("clearDemandIdempotencyKey();"), "Cliente deve limpar a chave após conclusão.");

console.log("registration idempotency contract: ok");
