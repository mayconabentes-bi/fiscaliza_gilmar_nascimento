import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const structure = fs.readFileSync("src/server/evidenceImageStructure.ts", "utf8");
const storage = fs.readFileSync("src/server/evidenceStorage.ts", "utf8");
const resilience = fs.readFileSync("src/server/demandEvidenceResilience.ts", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

expect(structure.includes("MAX_EVIDENCE_SIDE_PX = 8_000"), "P1.4A deve limitar cada lado a 8000 px.");
expect(structure.includes("MAX_EVIDENCE_PIXELS = 40_000_000"), "P1.4A deve limitar a 40 MP.");
expect(structure.includes("parseJpegDimensions"), "JPEG deve ter parser estrutural leve.");
expect(structure.includes("parsePngDimensions"), "PNG deve ter parser estrutural leve.");
expect(structure.includes("parseWebpDimensions"), "WebP deve ter parser estrutural leve.");
expect(structure.includes('ihdrLength !== 13 || ihdrType !== "IHDR"'), "PNG deve exigir IHDR válido como primeiro chunk.");
expect(structure.includes("JPEG_SOF_MARKERS"), "JPEG deve extrair dimensões de marcador SOF.");
expect(structure.includes('chunk === "VP8 "') && structure.includes('chunk === "VP8L"') && structure.includes('chunk === "VP8X"'), "WebP deve cobrir os três cabeçalhos suportados.");
expect(structure.includes("width > MAX_EVIDENCE_SIDE_PX || height > MAX_EVIDENCE_SIDE_PX"), "Limite por lado deve ocorrer antes do produto de pixels.");
expect(structure.includes("width * height > MAX_EVIDENCE_PIXELS"), "Área total deve ser limitada.");
expect(!packageJson.includes('"sharp"') && !packageJson.includes('"canvas"') && !packageJson.includes('"jimp"'), "P1.4A não deve adicionar decoder pesado.");
expect(storage.includes("validateEvidenceImageStructure(buffer, mime)"), "Estrutura deve ser validada antes do upload.");
const uploadStart = storage.indexOf("export async function uploadDemandEvidence");
const parseCall = storage.indexOf("parseEvidenceDataUrl(dataUrl)", uploadStart);
const configCall = storage.indexOf("storageConfig()", uploadStart);
expect(uploadStart >= 0 && parseCall > uploadStart && configCall > parseCall, "Validação estrutural deve terminar antes de consultar Storage.");
expect(resilience.includes('from "./evidenceValidation.js"'), "Erros P1.4A devem usar o catálogo central.");
expect(resilience.includes("Object.values(EVIDENCE_VALIDATION_ERRORS)"), "Estrutura/dimensões inválidas devem continuar sendo erro 400, não degradação P1.2.");

console.log("registration P1.4A image structure contract: ok");
