import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const retention = read('src/server/retentionPolicy.ts');
const demandPg = read('src/server/citizenDemandPostgres.ts');
const admin = read('src/server/privateAdminRoutes.ts');
const aggregate = read('src/server/civicAggregate.ts');
const strategy = read('src/server/strategyRoutes.ts');
const env = read('.env.example');

assert(retention.includes('closedDemandContactDays') && retention.includes('closedDemandEvidenceDays'), 'Política de retenção técnica ausente.');
assert(retention.includes('UPDATE demandas SET contato = NULL'), 'Descarte de contato encerrado ausente no modo SQLite/local.');
assert(retention.includes('fs.unlinkSync'), 'Descarte físico de evidências expiradas ausente no modo SQLite/local.');
assert(demandPg.includes('evidencia_moderacao_status') && demandPg.includes('PENDENTE'), 'Evidência Postgres deve iniciar pendente de moderação.');
assert(admin.includes('/api/admin/evidencias/pendentes') && admin.includes('/api/admin/evidencias/:id/decisao'), 'Fluxo administrativo de moderação de evidência ausente.');
assert(admin.includes('/api/admin/compliance/retention-preview') && admin.includes('/api/admin/compliance/retention-run'), 'Rotas de retenção administrativa ausentes.');
assert(aggregate.includes('HAVING COUNT(*) >= ?'), 'Agregação cívica deve aplicar tamanho mínimo de grupo.');
assert(aggregate.includes("permittedFields: ['bairro', 'categoria', 'total']"), 'Interface agregada deve limitar campos permitidos.');

const aggregateSql = aggregate.match(/db\.prepare\(`([\s\S]*?)`\)/)?.[1] || '';
const aggregateMapper = aggregate.match(/return rows\.map\([\s\S]*?\);/)?.[0] || '';
for (const forbidden of ['nome_solicitante', 'contato', 'protocolo', 'usuario_id', 'descricao', 'evidencia_foto_path']) {
  assert(!aggregateSql.includes(forbidden), `SQL agregado não pode selecionar campo individual: ${forbidden}`);
  assert(!aggregateMapper.includes(forbidden), `Resposta agregada não pode mapear campo individual: ${forbidden}`);
}

assert(strategy.includes('getCivicTerritorialAggregate') && strategy.includes('/api/admin/strategy/civic-aggregate'), 'Estratégia deve usar somente a interface agregada autorizada.');
assert(env.includes('RETENTION_CLOSED_DEMAND_CONTACT_DAYS') && env.includes('CIVIC_AGGREGATE_MIN_GROUP_SIZE'), 'Configuração P0-C ausente do ambiente de referência.');

console.log('legal-p0c-boundary: ok');
