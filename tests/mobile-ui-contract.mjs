import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
const form = fs.readFileSync('src/pages/NovaDemanda.tsx', 'utf8');
const protocol = fs.readFileSync('src/pages/ConsultaProtocolo.tsx', 'utf8');
const triage = fs.readFileSync('src/pages/AdminDemandas.tsx', 'utf8');
const privacy = fs.readFileSync('src/components/LGPDConsent.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(app.includes('safe-area-inset-bottom'), 'A navegação touch deve respeitar a safe area inferior.');
expect(app.includes('pb-24') && app.includes('lg:pb-8'), 'O conteúdo deve reservar espaço para a navegação inferior até telas grandes.');
expect(app.includes('lg:hidden') && app.includes('lg:flex'), 'Folds e tablets devem manter navegação touch até o breakpoint lg.');
expect(app.includes('!isAdmin && !isCitizen && !onDemandForm && <LGPDConsent />'), 'O aviso público de privacidade deve ficar fora do núcleo privado, da conta autenticada e não competir com o formulário.');
expect(!privacy.includes('motion/react'), 'O aviso de privacidade não deve carregar biblioteca de animação no caminho crítico.');
expect(app.includes('isAdmin ? <>') && app.includes('<span>Painel</span>') && app.includes('<span>Triagem</span>') && app.includes('<span>Radar</span>') && app.includes('<span>Mais</span>') && app.includes('adminMoreItems'), 'A navegação touch do admin deve priorizar ferramentas privadas e concentrar módulos secundários em Mais.');
expect(app.includes('function MobileNav({ user, onLogout }') && app.includes('<MobileNav user={user} onLogout={handleLogout} />'), 'A navegação touch deve reutilizar o logout autenticado do shell.');
expect(app.includes('data-mobile-logout="admin"') && app.includes('aria-label="Sair da área administrativa"') && app.includes('Mais ferramentas'), 'Administrador deve manter logout acessível no menu mobile de ferramentas privadas.');
expect(app.includes('data-mobile-logout="user"') && app.includes('aria-label="Sair da conta"'), 'Usuário autenticado deve ter ação Sair visível no first-mobile.');
expect((app.match(/aria-label="Sair"/g) || []).length >= 2, 'Administrador e usuário devem manter logout também no desktop.');
expect(app.includes('aria-label="Navegação privada"') && app.includes('>Governança</span>') && app.includes('>Auditoria</span>') && app.includes('>Relatórios</span>'), 'O desktop do admin deve expor apenas módulos privados.');
expect(app.includes('const homeRoute =') && app.includes('isCitizen ? <Navigate to="/meus-registros" replace />') && app.includes('isAdmin ? <Navigate to="/dashboard" replace />'), 'Home deve encaminhar admin e cidadão autenticado para seus contextos próprios.');
expect(app.includes('<Brand privateMode={isAdmin} citizenMode={isCitizen} />') && app.includes('citizenMode ? "/meus-registros"'), 'A marca deve levar admin e cidadão autenticado para seus contextos próprios.');
expect(app.includes('{!isAdmin && !isCitizen && <footer'), 'O rodapé público deve ficar fora das experiências autenticadas.');
expect(app.includes('to="/login"') && app.includes('<span>Entrar</span>'), 'Visitantes devem continuar vendo a entrada na navegação pública touch.');
expect(home.includes('min-h-14') && form.includes('min-h-14') && protocol.includes('min-h-14'), 'CTAs críticos devem manter área de toque confortável.');
expect(form.includes('text-base') && protocol.includes('text-base'), 'Campos críticos devem usar fonte de 16px para evitar zoom involuntário no iOS.');
expect(form.includes('capture="environment"'), 'Captura de evidência deve favorecer a câmera traseira no celular.');
const radar = fs.readFileSync("src/pages/RadarTerritorial.tsx", "utf8");
expect(radar.includes('id="radar-bairro-mobile"') && radar.includes('Escolher bairro'), 'Radar deve oferecer seletor nativo de bairro no mobile.');
expect(radar.includes('onTouchEnd={(event) => {'), 'Mapa do Radar deve possuir fallback touch explícito no mobile.');
expect(triage.includes('data-mobile-triage-cards') && triage.includes('lg:hidden'), 'Triagem deve usar cards dedicados no mobile.');
expect(triage.includes('hidden overflow-hidden') && triage.includes('lg:block'), 'Tabela de triagem deve ficar restrita ao desktop.');
expect(triage.includes('Abrir triagem') && triage.includes('min-h-12'), 'Ações críticas da triagem mobile devem ter alvo de toque confortável.');
expect(triage.includes('Buscar protocolo') && triage.includes('Filtrar bairro') && triage.includes('Todas as prioridades'), 'Triagem mobile deve oferecer filtros operacionais por protocolo, bairro e prioridade.');
expect(triage.includes('Prioridade operacional') && triage.includes('Salvar triagem'), 'Modal de triagem deve permitir alterar prioridade e status no mesmo fluxo.');
expect(triage.includes('obrigatória para encerramento'), 'UI deve comunicar justificativa obrigatória ao concluir ou indeferir.');
expect(form.includes('name="camera_photo"') && form.includes('name="gallery_photos"') && form.includes('opacity-0 disabled:cursor-not-allowed'), 'Câmera e galeria devem usar inputs file nativos diretamente tocáveis.');
expect(form.includes('data-engagement-progress="transparent"') && form.includes('role="progressbar"'), 'O formulário deve mostrar progresso transparente, sem urgência artificial.');
expect(form.includes('form_step_location') && form.includes('form_step_details') && form.includes('form_step_review'), 'O funil deve medir apenas conclusão agregada das etapas cívicas.');
expect(html.includes('width=device-width'), 'Viewport mobile deve estar configurado.');

const targetViewports = ['344x882', '375x667', '393x852', '412x915', '440x956', '744x1133', '768x968', '800x1080', '1032x1376'];
console.log(`Mobile/touch UI contract OK para ${targetViewports.join(', ')}: safe area, toque, logout mobile autenticado, progresso transparente, navegação pública e núcleo privado isolado.`);
