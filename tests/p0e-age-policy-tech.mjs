import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const expectIncludes = (text, snippets, label) => {
  for (const snippet of snippets) if (!text.includes(snippet)) throw new Error(`${label}: trecho ausente: ${snippet}`);
};

const agePolicy = read('src/server/agePolicy.ts');
const auth = read('src/server/citizenAuthPostgres.ts');
const demand = read('src/server/citizenDemandPostgres.ts');
const foundationMigration = read('supabase/migrations/20260915160000_p0e_age_protection.sql');
const effectiveMigration = read('supabase/migrations/20260918145150_age_intelligence_bands_only.sql');

expectIncludes(agePolicy, [
  'UNDER_16', 'AGE_16_17', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_59', 'AGE_60_PLUS',
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

expectIncludes(foundationMigration, [
  'add column if not exists faixa_etaria text',
  'add column if not exists protecao_reforcada boolean',
  'add column if not exists revisao_reforcada boolean',
  'Nenhuma data de nascimento, documento ou biometria',
], 'migration P0-E foundation');

expectIncludes(effectiveMigration, [
  "'AGE_16_17'",
  "'AGE_18_24'",
  "'AGE_25_34'",
  "'AGE_35_44'",
  "'AGE_45_59'",
  "'AGE_60_PLUS'",
], 'migration P0-E effective bands');

if (effectiveMigration.includes('AGE_18_PLUS')) {
  throw new Error('migration P0-E efetiva não deve aceitar AGE_18_PLUS.');
}

console.log('P0-E age policy technical contract: OK');
