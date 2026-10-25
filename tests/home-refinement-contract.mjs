import fs from 'node:fs';

const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(home.includes('Viu um problema na cidade? Registre e acompanhe.'), 'Hero deve comunicar a jornada principal em linguagem direta, sem promessa de solução.');
expect(home.includes('O que acontece depois do envio') && home.includes('data-home-mobile-flow'), 'Home deve explicar o fluxo pós-registro no desktop e usar jornada compacta no mobile.');
expect(home.includes('não representa garantia automática de solução'), 'Home deve preservar limite explícito de resultado.');
expect(home.includes('Seus dados protegidos') && home.includes('não usa seus dados para criar perfil político'), 'Home deve comunicar confiança em linguagem simples e preservar independência da participação.');
expect(home.includes('Não há contagem regressiva, pontuação ou penalidade'), 'CTA final deve evitar pressão comportamental artificial.');
expect(home.includes("trackPulsoEvent('cta_registrar', attribution)"), 'CTA principal deve preservar a telemetria agregada existente.');
expect(home.includes('min-h-14'), 'CTAs principais devem preservar área de toque confortável.');
expect(home.includes('sm:min-h-[66vh]') && !home.includes('className="grid min-h-[66vh]'), 'Hero não deve forçar altura mínima excessiva em telefones.');
expect(home.includes('data-home-trust') && home.includes('Seus dados são protegidos') && home.includes('to="/privacidade"') && home.includes('to="/transparencia"'), 'Home mobile deve consolidar confiança e privacidade sem perder os destinos públicos essenciais.');
expect(home.includes('hidden rounded-[1.75rem]') && home.includes('sm:block'), 'CTA final expansivo deve ficar fora do caminho mobile, que já possui navegação persistente.');

console.log('Home refinement contract OK: clareza, acompanhamento, privacidade e engajamento não manipulativo preservados.');
