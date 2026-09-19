import {
  detectEvidenceMimeBySignature,
  EVIDENCE_VALIDATION_ERRORS,
  uploadDemandEvidence,
  validateEvidenceBinarySignature,
} from "../src/server/evidenceStorage.js";
import { isEvidenceValidationFailure } from "../src/server/demandEvidenceResilience.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function expectThrows(fn: () => unknown, expectedMessage: string, label: string) {
  let error: unknown;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  expect(error instanceof Error, `${label}: deveria rejeitar`);
  expect((error as Error).message === expectedMessage, `${label}: mensagem inesperada`);
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webpLossy = Buffer.from("RIFF0000WEBPVP8 ", "ascii");
const webpLossless = Buffer.from("RIFF0000WEBPVP8L", "ascii");
const webpExtended = Buffer.from("RIFF0000WEBPVP8X", "ascii");

expect(detectEvidenceMimeBySignature(jpeg) === "image/jpeg", "JPEG deve ser identificado pelos bytes.");
expect(detectEvidenceMimeBySignature(png) === "image/png", "PNG deve ser identificado pelos bytes.");
expect(detectEvidenceMimeBySignature(webpLossy) === "image/webp", "WebP VP8 deve ser identificado.");
expect(detectEvidenceMimeBySignature(webpLossless) === "image/webp", "WebP VP8L deve ser identificado.");
expect(detectEvidenceMimeBySignature(webpExtended) === "image/webp", "WebP VP8X deve ser identificado.");
expect(detectEvidenceMimeBySignature(Buffer.from("RIFF0000WEBPNOPE", "ascii")) === null, "WebP com chunk desconhecido deve ser rejeitado.");
expect(detectEvidenceMimeBySignature(Buffer.from("not-an-image")) === null, "Conteúdo arbitrário não deve ser imagem.");

validateEvidenceBinarySignature(jpeg, "image/jpeg");
validateEvidenceBinarySignature(png, "image/png");
validateEvidenceBinarySignature(webpLossy, "image/webp");

expectThrows(
  () => validateEvidenceBinarySignature(png, "image/jpeg"),
  EVIDENCE_VALIDATION_ERRORS.SIGNATURE,
  "PNG declarado como JPEG",
);
expectThrows(
  () => validateEvidenceBinarySignature(jpeg, "image/png"),
  EVIDENCE_VALIDATION_ERRORS.SIGNATURE,
  "JPEG declarado como PNG",
);
expectThrows(
  () => validateEvidenceBinarySignature(Buffer.from("RIFF0000WEBPNOPE", "ascii"), "image/webp"),
  EVIDENCE_VALIDATION_ERRORS.SIGNATURE,
  "WebP estruturalmente inválido",
);

expect(
  isEvidenceValidationFailure(new Error(EVIDENCE_VALIDATION_ERRORS.SIGNATURE)),
  "Assinatura inválida deve ser classificada como erro do cliente.",
);

const spoofedDataUrl = `data:image/jpeg;base64,${png.toString("base64")}`;
let asyncError: unknown;
try {
  await uploadDemandEvidence("test-demand", spoofedDataUrl);
} catch (caught) {
  asyncError = caught;
}
expect(asyncError instanceof Error, "Upload spoofado deve rejeitar.");
expect(
  (asyncError as Error).message === EVIDENCE_VALIDATION_ERRORS.SIGNATURE,
  "Spoofing deve falhar antes de qualquer dependência de Storage.",
);

console.log("registration P1.3 magic bytes runtime: ok");
