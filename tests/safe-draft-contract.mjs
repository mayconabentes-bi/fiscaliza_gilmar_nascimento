import fs from 'node:fs';

const helper = fs.readFileSync('src/lib/safeDemandDraft.ts', 'utf8');
const form = fs.readFileSync('src/pages/NovaDemanda.tsx', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(helper.includes('SAFE_DEMAND_DRAFT_TTL_MS = 6 * 60 * 60 * 1000'), 'Rascunho deve expirar em até 6 horas.');
expect(helper.includes('localStorage') && helper.includes('removeItem'), 'Rascunho deve ficar somente no dispositivo e permitir remoção.');
expect(helper.includes('bairro: string') && helper.includes('categoria: string') && helper.includes('tipo_problema: string'), 'Rascunho deve limitar-se a bairro/localidade, área e tipo estruturados.');

for (const field of ['cep:', 'logradouro:', 'numero:', 'complemento:', 'nome_solicitante:', 'contato:', 'descricao:', 'faixa_etaria:', 'aviso_privacidade_aceito:', 'photoData:', 'foto_evidencia_base64:']) {
  expect(!helper.includes(field), `Helper não pode persistir campo proibido: ${field}`);
}

expect(form.includes('data-safe-draft="explicit"'), 'UI deve identificar o rascunho como ação explícita.');
expect(form.includes('salve somente bairro/localidade, área e tipo de problema por até 6 horas'), 'UI deve explicar limite e validade do rascunho.');
expect(form.includes('CEP, rua, número, complemento, nome, contato, descrição, foto, faixa etária e aceite de privacidade não são salvos.'), 'UI deve declarar os campos que não são persistidos.');
expect(form.includes('clearSafeDemandDraft(); setDraftAvailable(false);'), 'Rascunho deve ser apagado após envio bem-sucedido.');
expect(!form.includes('trackPulsoEvent("draft_'), 'Rascunho não deve criar telemetria comportamental adicional.');

console.log('Safe draft contract OK: opt-in explícito, TTL curto, somente bairro/área/tipo estruturado e sem PII/texto livre/foto/telemetria nova.');
