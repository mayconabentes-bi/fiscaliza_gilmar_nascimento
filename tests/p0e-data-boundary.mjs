import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const demand = read('src/server/citizenDemandPostgres.ts');
const clientAnalytics = read('src/lib/mobileAnalytics.ts');
const serverAnalytics = read('src/server/mobileConversion.ts');

const publicLookupMatch = demand.match(/app\.get\("\/api\/demandas\/protocolo\/:protocolo"[\s\S]*?return res\.json\(\{ demanda, historico \}\);/);
if (!publicLookupMatch) throw new Error('Não foi possível localizar o contrato da consulta pública por protocolo.');
const publicLookup = publicLookupMatch[0];
for (const forbidden of ['faixa_etaria', 'revisao_reforcada', 'revisao_reforcada_motivo', 'protecao_reforcada', 'nome_solicitante', 'contato']) {
  if (publicLookup.includes(forbidden)) throw new Error(`Consulta pública expõe campo proibido: ${forbidden}`);
}

for (const [text, label] of [[clientAnalytics, 'analytics cliente'], [serverAnalytics, 'analytics servidor']]) {
  for (const forbidden of ['faixa_etaria', 'AGE_16_17', 'AGE_18_PLUS', 'UNDER_16', 'protecao_reforcada']) {
    if (text.includes(forbidden)) throw new Error(`${label} inclui dimensão etária proibida: ${forbidden}`);
  }
}

if (!clientAnalytics.includes('JSON.stringify({ event, ...attribution })')) {
  throw new Error('Analytics cliente não está limitado ao evento e atribuição agregada esperados.');
}
if (!serverAnalytics.includes('insert into public.mobile_funil_agregado (dia, evento, src, acao, total)')) {
  throw new Error('Analytics servidor não preserva o esquema agregado esperado.');
}

console.log('P0-E data boundary: OK');
