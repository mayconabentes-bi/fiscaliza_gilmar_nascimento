import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('src/server/app.ts');
const ready = read('src/server/goLiveSecurity.ts');
const postgres = read('src/server/postgres.ts');
const demand = read('src/server/citizenDemandPostgres.ts');
const compliance = read('src/server/citizenCompliancePostgres.ts');
const admin = read('src/server/privateAdminPostgresRoutes.ts');
const fastAdmin = read('src/server/productionFastAdminRoutes.ts');
const adminDemandIntegrity = read('src/server/adminDemandListIntegrity.ts');
const evidence = read('src/server/evidenceStorage.ts');
const mobile = read('src/server/mobileConversion.ts');
const backup = read('src/modules/infraestrutura-operacional/infrastructure/backup/BackupService.ts');
const migration = read('supabase/migrations/20260915040000_p0d_production_persistence.sql');
const vercelApi = read('api/[...path].ts');
const vercelConfig = JSON.parse(read('vercel.json'));

assert(app.includes('setupCitizenAuthPostgres') && app.includes('setupCitizenDemandPostgres'), 'Produção deve registrar fluxos cidadãos Postgres.');
assert(app.includes('setupCitizenCompliancePostgres') && app.includes('setupPrivateAdminPostgresRoutes'), 'Produção deve registrar compliance e triagem Postgres.');
assert(app.includes('Rotas internas ainda dependentes do legado SQLite permanecem fail-closed'), 'Módulos SQLite não migrados devem permanecer fail-closed em produção.');
assert(ready.includes('DATABASE_URL') && ready.includes('SUPABASE_EVIDENCE_BUCKET'), 'Readiness deve validar Postgres e Storage.');
assert(ready.includes('checkEvidenceBucketPrivate') && ready.includes('supabase-private'), 'Readiness deve falhar quando o bucket de evidências não for privado.');
assert(!ready.includes('CIVIC_DB_PATH') && !ready.includes('BACKUP_EXTERNAL_DIR'), 'Produção não deve depender de caminhos SQLite locais.');
assert(postgres.includes('select 1 as ok') && postgres.includes('ssl: "require"'), 'Cliente Postgres deve possuir health check e TLS.');
assert(demand.includes('aviso_privacidade_versao') && demand.includes('aviso_privacidade_data'), 'Demanda Postgres deve registrar trilha do aviso de privacidade.');
assert(demand.includes('uploadDemandEvidence') && demand.includes('evidencia_moderacao_status') && demand.includes('PENDENTE'), 'Evidência de produção deve ir ao Storage e iniciar pendente.');
assert(compliance.includes('/api/compliance/exportar') && compliance.includes('/api/compliance/excluir'), 'Direitos do titular devem possuir implementação Postgres.');
assert(admin.includes('/api/admin/evidencias/pendentes') && admin.includes('/api/admin/compliance/retention-run'), 'Moderação e retenção admin devem possuir implementação Postgres.');
assert(admin.includes('FINAL_JUSTIFICATION_REQUIRED') && admin.includes('Informe uma justificativa para concluir ou indeferir'), 'Encerramento de demanda deve exigir justificativa no backend.');
for (const filter of ['prioridade', 'protocolo', 'bairro']) {
  assert(adminDemandIntegrity.includes(filter), `Normalizador T2 deve suportar filtro por ${filter}.`);
}
assert(
  fastAdmin.includes('normalizeAdminDemandListFilters') && admin.includes('normalizeAdminDemandListFilters'),
  'Triagem de produção deve aplicar o mesmo normalizador no fast path e fallback.'
);
assert(evidence.includes('/storage/v1/object/') && evidence.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Evidência deve usar Supabase Storage pelo backend.');
assert(evidence.includes('/storage/v1/bucket/') && evidence.includes('data.public !== false'), 'Bucket configurado deve ser verificado como privado.');
assert(mobile.includes('process.env.NODE_ENV !== "production"') && mobile.includes('persistEvidenceLocal'), 'Filesystem de evidência deve estar explicitamente restrito ao modo local.');
assert(backup.includes("process.env.NODE_ENV === 'production'") && backup.includes('Backup SQLite é exclusivo'), 'Backup SQLite deve recusar execução em produção.');
assert(migration.includes('private.admins') && migration.includes('public.logs_auditoria'), 'Migration deve cobrir administração e auditoria.');
assert(migration.includes('enable row level security') && migration.includes('revoke all'), 'Migration deve bloquear acesso direto anônimo/autenticado.');
assert(vercelApi.includes('createApp') && vercelApi.includes('assertProductionReadiness'), 'Vercel deve reutilizar o mesmo Express e o mesmo gate de readiness da produção.');
assert(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.length > 0, 'Vercel deve mapear rotas SPA explícitas para index.html.');
assert(vercelConfig.rewrites.every((rule) => rule.destination === '/index.html'), 'Rewrites SPA devem apontar somente para index.html.');
assert(vercelConfig.rewrites.every((rule) => !String(rule.source || '').startsWith('/api')), 'Rewrites SPA não podem interceptar /api/*.');
for (const route of ['/protocolo', '/demandas/nova', '/login', '/admin/demandas']) {
  assert(vercelConfig.rewrites.some((rule) => rule.source === route), `Vercel deve suportar acesso direto à rota SPA ${route}.`);
}
assert(!fs.existsSync('api/index.ts'), 'A ponte Vercel deve permanecer mínima, sem criar uma segunda implementação genérica da API.');
assert(ready.includes('VERCEL_URL'), 'Vercel Preview deve reconhecer o hostname do deployment atual como origem confiável.');
assert(ready.includes('VERCEL_ENV') && ready.includes('zqxouixpokuprqqscnwf') && ready.includes('jnlfmiwczpglojqytrbw'), 'Preview do Vercel deve possuir barreira explícita entre homologação e Supabase principal.');
assert(!ready.includes('RAILWAY_PUBLIC_DOMAIN'), 'Runtime oficial não deve depender de Railway.');

console.log('p0d-production-persistence: ok');
