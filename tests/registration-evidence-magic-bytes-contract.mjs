import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };

const storage = fs.readFileSync("src/server/evidenceStorage.ts", "utf8");
const resilience = fs.readFileSync("src/server/demandEvidenceResilience.ts", "utf8");
const demand = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");

expect(storage.includes("detectEvidenceMimeBySignature"), "P1.3 deve detectar MIME pelos bytes reais.");
expect(storage.includes("validateEvidenceBinarySignature"), "P1.3 deve validar assinatura binária.");
expect(storage.includes("0xff && buffer[1] === 0xd8 && buffer[2] === 0xff"), "JPEG deve exigir assinatura FF D8 FF.");
expect(storage.includes("0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a"), "PNG deve exigir assinatura completa de 8 bytes.");
expect(storage.includes('ascii(buffer, 0, 4) === "RIFF"') && storage.includes('ascii(buffer, 8, 4) === "WEBP"'), "WebP deve exigir RIFF/WEBP.");
expect(storage.includes('chunk === "VP8 "') && storage.includes('chunk === "VP8L"') && storage.includes('chunk === "VP8X"'), "WebP deve exigir chunk de imagem conhecido.");
expect(storage.includes("detectedMime !== declaredMime"), "MIME declarado deve coincidir exatamente com a assinatura.");
expect(storage.includes("canonicalDecoded !== canonicalInput"), "Base64 malformado deve falhar fechado.");

const uploadStart = storage.indexOf("export async function uploadDemandEvidence");
const parseCall = storage.indexOf("parseEvidenceDataUrl(dataUrl)", uploadStart);
const configCall = storage.indexOf("storageConfig()", uploadStart);
expect(uploadStart >= 0 && parseCall > uploadStart && configCall > parseCall, "Conteúdo deve ser validado antes de acessar configuração/Storage.");

expect(resilience.includes("Object.values(EVIDENCE_VALIDATION_ERRORS)"), "P1.2 deve reconhecer centralmente todos os erros P1.3.");
expect(demand.includes("if (isEvidenceValidationFailure(error))"), "Endpoint deve retornar 400 para assinatura inválida.");
expect(!demand.includes('["Formato de evidência inválido", "Tipo de evidência não permitido", "Tamanho de evidência inválido"]'), "Endpoint não deve manter lista duplicada de erros.");

console.log("registration P1.3 magic bytes contract: ok");
