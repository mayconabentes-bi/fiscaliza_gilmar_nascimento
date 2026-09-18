import fs from 'node:fs';

const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(home.includes('Registre o problema. Guarde o protocolo. Acompanhe o caso.'), 'Hero deve comunicar a jornada principal sem promessa de solução.');
expect(home.includes('O que acontece depois do envio') && home.includes('data-home-mobile-flow'), 'Home deve explicar o fluxo pós-registro no desktop e usar jornada compacta no mobile.');
expect(home.includes('não representa garantia automática de solução'), 'Home deve preservar limite explícito de resultado.');
expect(home.includes('Sem perfilamento político') && home.includes('não usa seus dados para criar perfil político'), 'Home deve preservar independência da participação e privacidade política.');
expect(home.includes('Não há contagem regressiva, pontuação ou penalidade'), 'CTA final deve evitar pressão comportamental artificial.');
expect(home.includes("trackPulsoEvent('cta_registrar', attribution)"), 'CTA principal deve preservar a telemetria agregada existente.');
expect(home.includes('min-h-14'), 'CTAs principais devem preservar área de toque confortável.');
expect(home.includes('sm:min-h-[66vh]') && !home.includes('className="grid min-h-[66vh]'), 'Hero não deve forçar altura mínima excessiva em telefones.');
expect(home.includes('data-home-trust') && home.includes('Confiança e privacidade'), 'Home mobile deve consolidar transparência e privacidade sem perder os dois destinos.');
expect(home.includes('hidden rounded-[1.75rem]') && home.includes('sm:block'), 'CTA final expansivo deve ficar fora do caminho mobile, que já possui navegação persistente.');

console.log('Home refinement contract OK: clareza, acompanhamento, privacidade e engajamento não manipulativo preservados.');
