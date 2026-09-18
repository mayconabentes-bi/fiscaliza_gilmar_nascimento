import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function expectIncludes(text, snippets, label) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      throw new Error(`${label}: trecho obrigatório ausente: ${snippet}`);
    }
  }
}

const minors = read('docs/juridico/P0E_MENORES_ECA_DIGITAL.md');
const sensitive = read('docs/juridico/P0E_DADOS_SENSIVEIS_INCIDENTAIS.md');
const inventory = read('docs/juridico/INVENTARIO_TRATAMENTO_DADOS.md');
const ageDesign = read('docs/juridico/P0E_DESENHO_TECNICO_FAIXA_ETARIA.md');
const privacy = read('src/pages/Privacidade.tsx');
const terms = read('src/pages/Termos.tsx');
const register = read('src/pages/RegisterCidadao.tsx');
const intake = read('src/pages/NovaDemanda.tsx');

expectIncludes(minors, [
  'A participação ativa autônoma no FISCALIZE será permitida a partir dos **16 anos**.',
  '**menores de 16 anos:**',
  'Proteções reforçadas para usuários de 16 e 17 anos',
  'não utilizar dados cívicos de menores para perfilamento, segmentação política, propaganda eleitoral ou inferência de preferência',
  'Impacto em produção: **nenhum até merge e go-live aprovados**',
], 'P0-E menores');

expectIncludes(sensitive, [
  'não publicar automaticamente',
  'não utilizar o dado para segmentação política',
  'Fotos permanecem privadas por padrão',
  'Dados sensíveis exigem análise compatível com as hipóteses específicas previstas na LGPD',
], 'P0-E sensíveis');

expectIncludes(inventory, [
  'Matriz finalidade × dados × base jurídica × retenção',
  'Teste de legítimo interesse',
  'Crianças e adolescentes',
  'Dados sensíveis e dados de terceiros',
  'Dados proibidos para segmentação política',
], 'Inventário P0-E');

expectIncludes(ageDesign, [
  'menos de 16 anos',
  '16 a 17 anos',
  '18 anos ou mais',
  'UNDER_16',
  'AGE_16_17',
  'AGE_18_PLUS',
  'não deve coletar data completa de nascimento, CPF, RG, biometria ou imagem de documento como padrão',
  'backend permanece a fonte de verdade',
], 'Desenho técnico etário');

expectIncludes(privacy, [
  'A participação autônoma para criar conta e registrar demandas começa aos 16 anos',
  'Participantes de 16 e 17 anos recebem proteção reforçada',
  'Dados de adolescentes não podem ser usados para perfilamento político',
  'Seu relato não vira perfil político',
  'Participar não significa apoiar',
], 'Privacidade pública P0-E');

expectIncludes(terms, [
  'Termos de uso · versão 2026-09-P0E',
  'A participação autônoma para criar conta e registrar demandas está disponível a partir de 16 anos',
  'Pessoas com menos de 16 anos podem acessar o conteúdo público',
  'Dados de adolescentes têm proteção reforçada',
  'O FISCALIZE não é serviço de emergência',
], 'Termos públicos P0-E');

for (const [text, label] of [[register, 'Cadastro'], [intake, 'Demanda']]) {
  expectIncludes(text, [
    'value="UNDER_16"',
    'value="AGE_16_17"',
    'value="AGE_18_24"',
    'value="AGE_25_34"',
    'value="AGE_35_44"',
    'value="AGE_45_59"',
    'value="AGE_60_PLUS"',
    'faixa_etaria',
  ], `${label} — faixas etárias`);
  if (text.includes('option value="AGE_18_PLUS"')) {
    throw new Error(`${label}: faixa legada AGE_18_PLUS não deve ser oferecida em novos formulários.`);
  }
}

expectIncludes(register, [
  'A criação autônoma de conta no FISCALIZE está disponível a partir de 16 anos.',
  'disabled={formData.faixa_etaria === "UNDER_16"}',
  'Proteção reforçada:',
], 'Cadastro — proteção etária');

expectIncludes(intake, [
  'O envio autônomo de demandas no FISCALIZE está disponível a partir de 16 anos.',
  'disabled={loading || photoBusy || form.faixa_etaria === "UNDER_16"}',
  'Proteção reforçada:',
], 'Demanda — proteção etária');

console.log('P0-E legal readiness contract: OK');
