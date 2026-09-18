import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
const register = fs.readFileSync('src/pages/NovaDemanda.tsx', 'utf8');
const tracking = fs.readFileSync('src/pages/ConsultaProtocolo.tsx', 'utf8');
const methodology = fs.readFileSync('src/pages/Metodologia.tsx', 'utf8');
const about = fs.readFileSync('src/pages/Transparencia.tsx', 'utf8');
const privateDashboard = fs.readFileSync('src/pages/DashboardPrivado.tsx', 'utf8');
const triage = fs.readFileSync('src/pages/AdminDemandas.tsx', 'utf8');
const governance = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
const radar = fs.readFileSync('src/pages/RadarTerritorial.tsx', 'utf8');
const strategy = fs.readFileSync('src/pages/Estrategia2028.tsx', 'utf8');
const audit = fs.readFileSync('src/pages/SecurityAudit.tsx', 'utf8');
const reports = fs.readFileSync('src/pages/Relatorios.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const manifest = fs.readFileSync('public/site.webmanifest', 'utf8');
const favicon = fs.readFileSync('public/favicon.svg', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(css.includes('--brand-blue: #1f2e6e') && css.includes('--brand-orange: #f36a10'), 'Paleta institucional base deve permanecer definida.');
expect(css.includes('.brand-signature-mark') && app.includes('/brand/gilmar-nascimento-oficial.png') && login.includes('/brand/gilmar-nascimento-oficial.png'), 'Tratamento web da marca deve existir no CSS e nas superfícies visuais.');
expect(app.includes('brand-accent-bar') && app.includes('brand-signature-mark'), 'Shell público deve aplicar identidade institucional.');
expect(app.includes('text-[#1f2e6e]') && app.includes('primary-button'), 'Navegação e CTA devem usar a nova hierarquia visual.');
expect(login.includes('brand-signature-mark--login') && login.includes('bg-[#f36a10]'), 'Login deve carregar marca e destaque laranja.');
expect(html.includes('name="theme-color" content="#1f2e6e"'), 'Theme color do navegador deve acompanhar a identidade.');
expect(!app.includes('Deputado Estadual') && !login.includes('Deputado Estadual'), 'A interface não deve inserir cargo político como texto de UI.');

expect(home.includes('Você cuidando da cidade') && home.includes('Registrar ocorrência'), 'Home deve preservar a personalização pública e o CTA principal.');
expect(register.includes('FISCALIZE · Registrar') && register.includes('/api/demandas'), 'Registrar deve preservar identidade pública e endpoint de envio.');
expect(tracking.includes('FISCALIZE · Acompanhar') && tracking.includes('/api/demandas/protocolo/'), 'Acompanhar deve preservar identidade pública e consulta por protocolo.');
expect(methodology.includes('FISCALIZE · Como funciona') && methodology.includes('não substitui protocolo'), 'Como funciona deve preservar identidade e limite do protocolo interno.');
expect(about.includes('Sobre o FISCALIZE') && about.includes('Participar não significa apoiar'), 'Sobre deve preservar identidade e independência da participação.');

expect(app.includes('private-shell') && app.includes('private-area') && app.includes('private-context-bar') && app.includes('Acesso autenticado'), 'Shell privado deve preservar contexto visual e indicação de acesso autenticado.');
expect(css.includes('.private-area') && css.includes('data-private-route="/admin/demandas"') && css.includes('data-private-route="/radar-manaus"'), 'Estilos privados devem permanecer escopados por área e rota.');
expect(privateDashboard.includes('FISCALIZE · Núcleo privado') && privateDashboard.includes('/api/demandas/metricas'), 'Painel privado deve preservar identidade e fonte de métricas.');
expect(governance.includes('FISCALIZE · Governança') && governance.includes('/api/admin/moderacao/pendentes') && governance.includes('/api/admin/auditoria/logs'), 'Governança deve preservar identidade e endpoints administrativos.');
expect(audit.includes('FISCALIZE · Auditoria') && audit.includes('/api/admin/audit') && audit.includes('bg-emerald-500'), 'Auditoria deve preservar identidade, endpoint e cores semânticas de sucesso.');
expect(triage.includes('/api/admin/demandas') && triage.includes('/api/admin/evidencias/'), 'Triagem deve preservar listagem, atualização e moderação de evidências.');
expect(radar.includes('/api/radar/manaus/resumo') && radar.includes('/api/radar/manaus/territorios'), 'Radar deve preservar fontes privadas territoriais.');
expect(strategy.includes('/api/admin/strategy/2028') && strategy.includes('/api/intelligence/works'), 'Estratégia deve preservar acesso autenticado e fontes de inteligência.');

expect(html.includes('href="/favicon.svg"') && html.includes('href="/apple-touch-icon.png"') && html.includes('href="/site.webmanifest"'), 'HTML deve registrar favicon, touch icon e web manifest.');
expect(favicon.includes('#1f2e6e') && favicon.includes('#f36a10'), 'Favicon vetorial deve usar azul e laranja institucionais.');
expect(manifest.includes('"short_name":"FISCALIZE"') && (manifest.includes('"purpose":"any maskable"') || manifest.includes('"purpose":"maskable"')) && manifest.includes('"theme_color":"#1f2e6e"'), 'Web manifest deve preservar nome, cor e suporte maskable.');
expect(fs.existsSync('public/app-icon-192.png') && fs.existsSync('public/app-icon-512.png') && fs.existsSync('public/apple-touch-icon.png'), 'Ícones PNG para instalação e Apple touch devem existir.');

expect(reports.includes('FISCALIZE · Relatórios') && reports.includes('/api/relatorios/gerar'), 'Relatórios devem preservar identidade e endpoint administrativo de geração.');
expect(reports.includes('BRAND_BLUE') && reports.includes('BRAND_ORANGE') && reports.includes('Relatório privado de demandas · uso administrativo'), 'PDF deve carregar identidade institucional e contexto administrativo.');
expect(reports.includes('Página ${page} de ${pageCount}') && reports.includes('Documento privado'), 'PDF deve preservar paginação e aviso de uso privado.');
expect(reports.includes('data-report-layout="responsive"') && reports.includes('sm:grid-cols-2') && reports.includes('overflow-x-auto'), 'Relatórios devem manter adaptação explícita para mobile e desktop.');
expect(reports.includes('fiscalize_relatorio_demandas_') && reports.includes('reportData.length > 100'), 'Exportações devem usar nome padronizado e a prévia deve explicitar o limite visual de 100 registros.');

console.log('Brand UI contract OK: rollout visual completo, relatórios/PDFs, responsividade e salvaguardas funcionais de interface.');
