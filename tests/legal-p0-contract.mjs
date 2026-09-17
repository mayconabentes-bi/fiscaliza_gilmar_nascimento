import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('src/server/app.ts');
const routes = read('src/server/routes.ts');
const postgresDemand = read('src/server/citizenDemandPostgres.ts');
const mobile = read('src/server/mobileConversion.ts');
const security = read('src/server/goLiveSecurity.ts');
const privacy = read('src/pages/Privacidade.tsx');
const terms = read('src/pages/Termos.tsx');
const db = read('src/server/db.ts');
const migration = read('supabase/migrations/20260915040000_p0d_production_persistence.sql');

assert(app.includes('app.use("/api/demandas/metricas", requireAdmin)'), 'Métricas de demandas devem permanecer protegidas.');
assert(app.includes('app.use("/api/relatorios", requireAdmin)'), 'Relatórios devem permanecer protegidos.');
assert(mobile.includes("preferencia_politica") && mobile.includes("religiao") && mobile.includes("biometria"), 'Filtro de campos sensíveis ausente.');
assert(security.includes("DPO_CONTACT_EMAIL") && security.includes("LGPD_CONSENT_VERSION"), 'Configuração jurídica obrigatória em produção ausente.');
assert(routes.includes('/api/compliance/exportar'), 'Endpoint legado de exportação de dados ausente.');
assert(routes.includes('/api/compliance/excluir'), 'Endpoint legado de exclusão/pseudonimização ausente.');
assert(postgresDemand.includes('aviso_privacidade_versao') && postgresDemand.includes('aviso_privacidade_data'), 'Trilha de versão do aviso na persistência Postgres ausente.');
assert(migration.includes('aviso_privacidade_versao') && migration.includes('aviso_privacidade_data'), 'Schema Postgres da trilha de privacidade ausente.');
assert(db.includes('aviso_privacidade_versao TEXT') && db.includes('aviso_privacidade_aceito_em DATETIME'), 'Schema SQLite local da trilha de privacidade ausente.');
assert(privacy.includes('não é usada automaticamente') || privacy.includes('não vira perfil político'), 'Política deve vedar perfilamento político automático.');
assert(terms.includes('não é um canal oficial') || terms.includes('não substitui'), 'Termos devem deixar claro o caráter não oficial.');

console.log('legal-p0-contract: ok');
