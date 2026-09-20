import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const app = fs.readFileSync("src/server/app.ts", "utf8");
const ui = fs.readFileSync("src/pages/AdminDemandas.tsx", "utf8");

expect(app.includes("const evidenceImageOrigin"), "Produção deve derivar a origem permitida do SUPABASE_URL.");
expect(app.includes('new URL(configured).origin'), "CSP deve usar somente a origem normalizada do Supabase.");
expect(app.includes('"img-src": ["\'self\'", "data:", "blob:", ...(evidenceImageOrigin ? [evidenceImageOrigin] : [])]'), "img-src deve permitir a origem privada configurada sem wildcard.");
expect(!app.includes("https://*.supabase.co"), "CSP não deve liberar todos os projetos Supabase.");
expect(ui.includes('onError={() => setEvidenciaError("A imagem não pôde ser exibida.'), "Triagem deve informar falha real de renderização da evidência.");

console.log("Triage evidence display CSP contract: ok");
