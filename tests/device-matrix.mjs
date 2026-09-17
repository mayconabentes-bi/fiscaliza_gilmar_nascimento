import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const devices = [
  ['iPhone SE', 375, 667],
  ['iPhone 16', 393, 852],
  ['iPhone 16 Pro Max', 440, 956],
  ['Pixel 9', 412, 915],
  ['Pixel 9 Pro', 412, 915],
  ['Pixel 10', 412, 915],
  ['Samsung Galaxy A55', 412, 915],
  ['Pixel 9 Pro Fold cover', 344, 882],
  ['Pixel 9 Pro Fold open', 800, 1080],
  ['Galaxy Z Fold 6 cover', 374, 968],
  ['Galaxy Z Fold 6 open', 768, 968],
  ['iPad Mini', 744, 1133],
  ['iPad Pro 13', 1032, 1376],
  ['Surface Pro 10', 1440, 960],
  ['Nest Hub Max', 1280, 800],
  ['Desktop', 1536, 864],
];

expect(html.includes('width=device-width'), 'Viewport deve usar a largura real do dispositivo.');
expect(css.includes('min-width: 320px'), 'Layout deve suportar telas compactas a partir de 320px.');
expect(css.includes('overflow-x: hidden'), 'Layout deve impedir overflow horizontal global.');
expect(css.includes('@media (pointer: coarse)'), 'Dispositivos touch devem receber alvos de toque adequados.');
expect(css.includes('max-width: 359px'), 'Telefones compactos devem ter tratamento dedicado.');
expect(css.includes('orientation: landscape'), 'Tablets, dobráveis e telas touch em paisagem devem ser contemplados.');
expect(app.includes('lg:hidden'), 'Navegação touch deve permanecer ativa em phones, folds e tablets compactos.');
expect(app.includes('hidden items-center gap-1 lg:flex'), 'Navegação desktop deve iniciar apenas no breakpoint lg.');

for (const [name, width, height] of devices) {
  if (width < 320 || height < 600) throw new Error(`Viewport inválido na matriz: ${name}`);
}

console.log(`Device matrix OK: ${devices.map(([name]) => name).join(', ')}`);
