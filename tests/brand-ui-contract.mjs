import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

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

console.log('Brand UI contract OK: paleta, marca, shell, login e ausência de cargo em texto de interface.');
