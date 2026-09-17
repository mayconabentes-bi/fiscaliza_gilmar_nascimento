import fs from 'node:fs';

const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(home.includes('Registre o problema. Guarde o protocolo. Acompanhe o caso.'), 'Hero deve comunicar a jornada principal sem promessa de solução.');
expect(home.includes('O que acontece depois do envio'), 'Home deve explicar o fluxo pós-registro.');
expect(home.includes('não representa garantia automática de solução'), 'Home deve preservar limite explícito de resultado.');
expect(home.includes('Sem perfil político') && home.includes('não usa seus dados para criar perfil político'), 'Home deve preservar independência da participação e privacidade política.');
expect(home.includes('Não há contagem regressiva, pontuação ou penalidade'), 'CTA final deve evitar pressão comportamental artificial.');
expect(home.includes("trackPulsoEvent('cta_registrar', attribution)"), 'CTA principal deve preservar a telemetria agregada existente.');
expect(home.includes('min-h-14'), 'CTAs principais devem preservar área de toque confortável.');

console.log('Home refinement contract OK: clareza, acompanhamento, privacidade e engajamento não manipulativo preservados.');
