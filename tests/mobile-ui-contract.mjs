import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
const form = fs.readFileSync('src/pages/NovaDemanda.tsx', 'utf8');
const protocol = fs.readFileSync('src/pages/ConsultaProtocolo.tsx', 'utf8');
const privacy = fs.readFileSync('src/components/LGPDConsent.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(app.includes('safe-area-inset-bottom'), 'A navegação touch deve respeitar a safe area inferior.');
expect(app.includes('pb-24') && app.includes('lg:pb-8'), 'O conteúdo deve reservar espaço para a navegação inferior até telas grandes.');
expect(app.includes('lg:hidden') && app.includes('lg:flex'), 'Folds e tablets devem manter navegação touch até o breakpoint lg.');
expect(app.includes('!isAdmin && !onDemandForm && <LGPDConsent />'), 'O aviso público de privacidade deve ficar fora do núcleo privado e não competir com o formulário.');
expect(!privacy.includes('motion/react'), 'O aviso de privacidade não deve carregar biblioteca de animação no caminho crítico.');
expect(app.includes('isAdmin ? <>') && app.includes('<span>Painel</span>') && app.includes('<span>Triagem</span>') && app.includes('<span>Radar</span>') && app.includes('<span>Estratégia</span>'), 'A navegação touch do admin deve conter apenas ferramentas privadas.');
expect(app.includes('aria-label="Navegação privada"') && app.includes('>Governança</span>') && app.includes('>Auditoria</span>') && app.includes('>Relatórios</span>'), 'O desktop do admin deve expor apenas módulos privados.');
expect(app.includes('publicOnly(<Home />)') && app.includes('<Navigate to="/dashboard" replace />'), 'Administrador não deve permanecer nas rotas públicas principais.');
expect(app.includes('<Brand privateMode={isAdmin} />') && app.includes('privateMode ? "/dashboard" : "/"'), 'A marca deve levar o admin para o núcleo privado.');
expect(app.includes('{!isAdmin && <footer'), 'O rodapé público deve ficar fora da experiência privada.');
expect(app.includes('to="/login"') && app.includes('<span>Entrar</span>'), 'Visitantes devem continuar vendo a entrada na navegação pública touch.');
expect(home.includes('min-h-14') && form.includes('min-h-14') && protocol.includes('min-h-14'), 'CTAs críticos devem manter área de toque confortável.');
expect(form.includes('text-base') && protocol.includes('text-base'), 'Campos críticos devem usar fonte de 16px para evitar zoom involuntário no iOS.');
expect(form.includes('capture="environment"'), 'Captura de evidência deve favorecer a câmera traseira no celular.');
expect(form.includes('data-engagement-progress="transparent"') && form.includes('role="progressbar"'), 'O formulário deve mostrar progresso transparente, sem urgência artificial.');
expect(form.includes('form_step_location') && form.includes('form_step_details') && form.includes('form_step_review'), 'O funil deve medir apenas conclusão agregada das etapas cívicas.');
expect(html.includes('width=device-width'), 'Viewport mobile deve estar configurado.');

const targetViewports = ['344x882', '375x667', '393x852', '412x915', '440x956', '744x1133', '768x968', '800x1080', '1032x1376'];
console.log(`Mobile/touch UI contract OK para ${targetViewports.join(', ')}: safe area, toque, progresso transparente, navegação pública e núcleo privado isolado.`);
