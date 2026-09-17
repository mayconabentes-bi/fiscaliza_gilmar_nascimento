import fs from 'node:fs';

const config = fs.readFileSync('playwright.visual.config.ts', 'utf8');
const spec = fs.readFileSync('tests/visual/public-journey.visual.spec.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/visual-qa.yml', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

for (const viewport of ['375, height: 667', '768, height: 968', '1536, height: 864']) {
  expect(config.includes(viewport), `Viewport representativo ausente: ${viewport}`);
}

expect(config.includes("timezoneId: 'America/Manaus'"), 'QA visual deve fixar timezone de Manaus.');
expect(config.includes("reducedMotion: 'reduce'"), 'QA visual deve reduzir movimento para capturas determinísticas.');
expect(config.includes("serviceWorkers: 'block'"), 'QA visual deve evitar interferência de service worker/cache.');
expect(config.includes("workers: 1"), 'Capturas devem rodar serialmente para reduzir flutuação.');
expect(config.includes('APP_ORIGIN: baseURL'), 'QA visual deve autorizar somente a própria origem local no CORS.');
expect(spec.includes("page.route('**/api/mobile-events'"), 'Telemetria deve ser interceptada em QA visual.');
expect(spec.includes("page.route('**/api/public-config'"), 'Config pública deve ser determinística em QA visual.');
expect(spec.includes("page.route('**/api/demandas/protocolo/**'"), 'Consulta de protocolo deve usar fixture determinística.');
expect(spec.includes("capture(page, 'home-publica'"), 'Home deve ter captura dedicada.');
expect(spec.includes("capture(page, 'registro-publico'"), 'Registro deve ter captura dedicada.');
expect(spec.includes("capture(page, 'acompanhamento-publico'"), 'Acompanhamento deve ter captura dedicada.');
expect(spec.includes("test-results/visual"), 'Capturas devem ser gravadas em diretório de artefatos.');
expect(!spec.includes('vercel.app'), 'O QA visual deve rodar localmente e não consumir deploy Vercel.');
expect(workflow.includes('npx playwright install --with-deps chromium'), 'Workflow deve instalar somente Chromium para reduzir custo de CI.');
expect(workflow.includes('actions/upload-artifact@v4'), 'Workflow deve publicar screenshots como artefato revisável.');
expect(workflow.includes('test-results/visual/*.png'), 'Workflow deve enviar apenas PNGs de QA visual.');

console.log('Visual QA contract OK: 3 viewports, origem CORS local restrita, APIs mockadas, screenshots como artefato e zero dependência de Vercel.');
