import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('src/server/app.ts');
const lookup = read('src/server/cepLookup.ts');
const intake = read('src/pages/NovaDemanda.tsx');
const register = read('src/pages/RegisterCidadao.tsx');
const demand = read('src/server/citizenDemandPostgres.ts');
const migration = read('supabase/migrations/20260917123000_demand_location_cep.sql');

expect(app.includes('setupCepLookup(app)') && app.includes('/api/localizacao/cep'), 'Rota de CEP deve estar registrada e possuir rate limit dedicado.');
expect(lookup.includes('https://viacep.com.br/ws') && lookup.includes('AbortController'), 'Consulta CEP deve usar ViaCEP pelo backend com timeout.');
expect(lookup.includes('CEP não encontrado') && lookup.includes('temporariamente indisponível'), 'Consulta CEP deve distinguir inexistência de indisponibilidade externa.');
expect(intake.includes('CEP do local do problema') && intake.includes('não seu endereço residencial'), 'Formulário deve explicar que o CEP pertence ao local da ocorrência.');
expect(intake.includes('logradouro') && intake.includes('numero') && intake.includes('complemento') && intake.includes('codigo_ibge'), 'Formulário deve enviar localização estruturada.');
expect(register.includes('data-cep-preview="full-address"') && register.includes('cepPreview.logradouro') && register.includes('cepPreview.bairro') && register.includes('cepPreview.municipio'), 'Cadastro deve mostrar logradouro, bairro e município devolvidos pelo CEP.');
expect(register.includes('cadastro postal é genérico ou incompleto'), 'Cadastro deve avisar quando o CEP não possui endereço completo.');
expect(demand.includes('cep, logradouro, numero, complemento, uf, codigo_ibge'), 'Persistência Postgres deve gravar localização estruturada.');
expect(migration.includes('add column if not exists cep') && migration.includes('add column if not exists codigo_ibge'), 'Migration deve adicionar CEP e código IBGE.');
expect(!demand.match(/select protocolo, municipio, bairro, cep, logradouro/), 'Consulta pública por protocolo não deve expor endereço detalhado.');

console.log('CEP/location contract: OK');
