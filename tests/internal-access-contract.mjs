import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const serverApp = fs.readFileSync('src/server/app.ts', 'utf8');
const routes = fs.readFileSync('src/server/routes.ts', 'utf8');
const access = fs.readFileSync('src/server/internalAccess.ts', 'utf8');
const auth = fs.readFileSync('src/server/privateAdminAuth.ts', 'utf8');
const db = fs.readFileSync('src/server/db.ts', 'utf8');
const login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const register = fs.readFileSync('src/pages/RegisterCidadao.tsx', 'utf8');
const strategyPage = fs.readFileSync('src/pages/Estrategia2028.tsx', 'utf8');
const strategyRoutes = fs.readFileSync('src/server/strategyRoutes.ts', 'utf8');
const mobile = fs.readFileSync('src/server/mobileConversion.ts', 'utf8');
const goLive = fs.readFileSync('src/server/goLiveSecurity.ts', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

expect(app.includes('const adminOnly ='), 'Rotas privadas devem usar guarda ADMIN no frontend.');
for (const route of ['/dashboard', '/admin', '/admin/demandas', '/admin/audit', '/radar-manaus', '/estrategia-2028', '/relatorios']) {
  expect(app.includes(`path="${route}" element={adminOnly(`), `${route} deve exigir ADMIN no frontend.`);
}

expect(access.includes('user.type !== "admin"'), 'Middleware deve aceitar somente token type=admin.');
expect(access.includes('value === "ADMIN" || value === "SUPER_ADMIN"'), 'Middleware deve aceitar somente perfis ADMIN e SUPER_ADMIN.');
expect(access.includes('if (!token) return res.status(401)'), 'Visitante sem token deve receber 401.');
expect(access.includes('getPostgres()') && access.includes('from private.admins'), 'Em produção, middleware deve revalidar o administrador no Postgres privado.');
expect(access.includes('process.env.NODE_ENV === "production"'), 'Revalidação Postgres deve ser restrita ao ambiente de produção.');
expect(access.includes('const db = getDb()'), 'Ambiente local deve preservar revalidação SQLite.');
expect(access.includes('perfil_acesso: persistedProfile'), 'Perfil persistido deve prevalecer sobre o papel carregado apenas no JWT.');

// P0-D moveu a montagem das rotas do servidor raiz para createApp().
for (const prefix of ['/api/admin', '/api/demandas/metricas', '/api/relatorios', '/api/radar/manaus']) {
  expect(serverApp.includes(`app.use("${prefix}", requireAdmin)`) || serverApp.includes(`\"${prefix}\"`), `${prefix} deve permanecer dentro do perímetro ADMIN/fail-closed.`);
}
expect(server.includes('createApp()'), 'Servidor deve delegar a montagem HTTP para createApp().');
expect(serverApp.includes('setupPrivateAdminAuth(app)'), 'Aplicação deve montar autenticação privada.');
expect(serverApp.includes('Rotas internas ainda dependentes do legado SQLite permanecem fail-closed'), 'Módulos internos não migrados devem permanecer fail-closed em produção.');

expect(auth.includes('/api/auth/admin/login'), 'Admin deve usar endpoint privado dedicado.');
expect(auth.includes('type: "admin"') && auth.includes('perfil_acesso: perfil') && auth.includes('admin.perfil_acesso || "ADMIN"'), 'JWT privado deve carregar perfil administrativo com fallback ADMIN.');
expect(auth.includes('sameSite: "strict"'), 'Cookie do ADMIN deve usar SameSite=Strict.');
expect(!auth.includes('sameSite: "none"'), 'Cookie do ADMIN não pode aceitar contexto cross-site.');

expect(routes.includes('/api/auth/register/cidadao') && routes.includes('/api/demandas/protocolo/:protocolo'), 'Backend local deve preservar cadastro cidadão e protocolo.');
expect(routes.includes('sameSite: "lax"'), 'Cookie cidadão deve usar SameSite=Lax.');
expect(!routes.includes('sameSite: "none"'), 'Cookie cidadão não pode aceitar contexto cross-site.');

expect(login.includes('/api/auth/admin/login'), 'Tela de login deve usar endpoint privado de admin.');
expect(!mobile.includes('INTERNAL_PILOT_MODE') && !mobile.includes('internalMode'), 'Coleta pública não pode possuir bypass de piloto interno legado.');

for (const field of ['cpf', 'rg', 'organizacao_civil']) {
  const inputPattern = new RegExp(`name=["']${field}["']`, 'i');
  expect(!inputPattern.test(register), `Cadastro público não pode coletar ${field}.`);
}
expect(!goLive.includes('CPF_PEPPER') && !/req\.body\?\.cpf|req\.body\.cpf/i.test(goLive), 'Segurança de cadastro não deve depender de CPF.');
expect(!db.includes('cpf_hash') && !db.match(/\brg\s+TEXT\b/i) && !db.includes('organizacao_civil'), 'Schema novo deve aplicar minimização de dados pessoais.');

for (const removed of [
  'src/pages/RegisterOrgao.tsx',
  'src/pages/DashboardInstitucional.tsx',
  'src/pages/PainelGabinete.tsx',
  'src/pages/PublicarResposta.tsx',
  'src/pages/PlanosAcesso.tsx',
  'src/components/PremiumLock.tsx',
  'src/server/internalRealActivity.ts',
  'src/scripts/create_admin_orgao.ts',
  'src/domain/aggregates/MunicipalIndicatorService.ts',
  'src/domain/aggregates/TransparencyIndexService.ts',
  'USO_INTERNO_PILOTO.md',
]) {
  expect(!fs.existsSync(removed), `${removed} deve permanecer removido.`);
}

const forbiddenArchitecture = [
  /orgaos_publicos/i,
  /respostas_institucionais/i,
  /entidades_institucionais/i,
  /agentes_institucionais/i,
  /encaminhamentos_institucionais/i,
  /register[-/]orgao/i,
  /admin_orgao_/i,
  /internal_pilot_mode/i,
  /getInstitutionalDashboard/i,
  /DashboardInstitucional/i,
  /RegisterOrgao/i,
  /PainelGabinete/i,
  /PublicarResposta/i,
  /TransparencyIndexService/i,
  /MunicipalIndicatorService/i,
  /\bGESTOR\b/,
  /\bOPERADOR\b/,
  /\bgabinete\b/i,
  /\borg[aã]o(s)?\b/i,
  /\binstitucional(is)?\b/i,
  /\binstituiç(?:ão|ões)\b/i,
];

for (const file of sourceFiles('src')) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenArchitecture) {
    expect(!pattern.test(content), `Resíduo de arquitetura institucional detectado em ${file}: ${pattern}`);
  }
}

expect(strategyPage.includes('/api/admin/strategy/2028'), 'Estratégia deve ser carregada por API ADMIN protegida.');
expect(!strategyPage.includes('Operação eleitoral') && !strategyPage.includes('Sala de situação'), 'Conteúdo estratégico não pode permanecer no bundle frontend.');
expect(strategyRoutes.includes('Cache-Control') && strategyRoutes.includes('no-store'), 'Resposta estratégica não deve ser cacheada publicamente.');

console.log('Private-admin attack contract OK: ADMIN/SUPER_ADMIN, revalidação Postgres em produção, cadastro minimizado, cookies endurecidos e ausência global de arquitetura institucional.');
