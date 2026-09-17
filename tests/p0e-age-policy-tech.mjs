import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const expectIncludes = (text, snippets, label) => {
  for (const snippet of snippets) if (!text.includes(snippet)) throw new Error(`${label}: trecho ausente: ${snippet}`);
};

const agePolicy = read('src/server/agePolicy.ts');
const auth = read('src/server/citizenAuthPostgres.ts');
const demand = read('src/server/citizenDemandPostgres.ts');
const migration = read('supabase/migrations/20260915160000_p0e_age_protection.sql');

expectIncludes(agePolicy, [
  'UNDER_16', 'AGE_16_17', 'AGE_18_PLUS',
  'AGE_UNDER_16_NOT_ALLOWED',
  'requiresEnhancedProtection',
], 'agePolicy');

expectIncludes(auth, [
  'ageBandForActiveParticipation(req.body?.faixa_etaria)',
  'faixa_etaria, protecao_reforcada',
  'protecao_reforcada: Boolean(user.protecao_reforcada)',
], 'cadastro cidadão');

expectIncludes(demand, [
  'select id, status, faixa_etaria, protecao_reforcada',
  'ageBandForActiveParticipation(req.body?.faixa_etaria)',
  'revisao_reforcada, revisao_reforcada_motivo',
  'Participante adolescente de 16 a 17 anos',
], 'intake de demandas');

expectIncludes(migration, [
  'add column if not exists faixa_etaria text',
  'add column if not exists protecao_reforcada boolean',
  'add column if not exists revisao_reforcada boolean',
  "faixa_etaria in ('AGE_16_17', 'AGE_18_PLUS')",
  'Nenhuma data de nascimento, documento ou biometria',
], 'migration P0-E');

console.log('P0-E age policy technical contract: OK');
