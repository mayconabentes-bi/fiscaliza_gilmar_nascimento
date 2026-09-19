import {
  EVIDENCE_IMAGE_LIMITS,
  validateEvidenceImageStructure,
} from "../src/server/evidenceImageStructure.js";
import { EVIDENCE_VALIDATION_ERRORS } from "../src/server/evidenceValidation.js";
import { uploadDemandEvidence } from "../src/server/evidenceStorage.js";
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

function png(width: number, height: number, bitDepth = 8, colorType = 6) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = bitDepth;
  buffer[25] = colorType;
  buffer[26] = 0;
  buffer[27] = 0;
  buffer[28] = 0;
  return buffer;
}

function jpeg(width: number, height: number, marker = 0xc0) {
  const components = 3;
  const segmentLength = 8 + 3 * components;
  const buffer = Buffer.alloc(2 + 2 + segmentLength);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = marker;
  buffer.writeUInt16BE(segmentLength, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  buffer[11] = components;
  for (let i = 0; i < components; i += 1) {
    const offset = 12 + i * 3;
    buffer[offset] = i + 1;
    buffer[offset + 1] = 0x11;
    buffer[offset + 2] = 0;
  }
  return buffer;
}

function riff(chunk: string, payload: Buffer) {
  const padded = payload.length % 2 === 0 ? payload : Buffer.concat([payload, Buffer.from([0])]);
  const fileSize = 12 + 8 + padded.length;
  const buffer = Buffer.alloc(fileSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write(chunk, 12, "ascii");
  buffer.writeUInt32LE(payload.length, 16);
  payload.copy(buffer, 20);
  return buffer;
}

function webpVp8(width: number, height: number) {
  const payload = Buffer.alloc(10);
  payload[3] = 0x9d;
  payload[4] = 0x01;
  payload[5] = 0x2a;
  payload.writeUInt16LE(width & 0x3fff, 6);
  payload.writeUInt16LE(height & 0x3fff, 8);
  return riff("VP8 ", payload);
}

function webpVp8l(width: number, height: number) {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  const bits = BigInt(widthMinusOne)
    | (BigInt(heightMinusOne) << 14n);
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  const packed = Number(bits);
  payload[1] = packed & 0xff;
  payload[2] = (packed >>> 8) & 0xff;
  payload[3] = (packed >>> 16) & 0xff;
  payload[4] = (packed >>> 24) & 0x1f;
  return riff("VP8L", payload);
}

function webpVp8x(width: number, height: number) {
  const payload = Buffer.alloc(10);
  const w = width - 1;
  const h = height - 1;
  payload[4] = w & 0xff;
  payload[5] = (w >>> 8) & 0xff;
  payload[6] = (w >>> 16) & 0xff;
  payload[7] = h & 0xff;
  payload[8] = (h >>> 8) & 0xff;
  payload[9] = (h >>> 16) & 0xff;
  return riff("VP8X", payload);
}

expect(EVIDENCE_IMAGE_LIMITS.maxSidePx === 8000, "Limite por lado deve ser 8000 px.");
expect(EVIDENCE_IMAGE_LIMITS.maxPixels === 40_000_000, "Limite total deve ser 40 MP.");
expect(EVIDENCE_IMAGE_LIMITS.maxJpegMarkersBeforeSof === 512, "Teto de marcadores JPEG deve ser 512.");

expect(validateEvidenceImageStructure(jpeg(1400, 900), "image/jpeg").width === 1400, "JPEG comum deve ser aceito.");
expect(validateEvidenceImageStructure(jpeg(1400, 900, 0xc2), "image/jpeg").height === 900, "JPEG progressivo deve ser aceito.");
expect(validateEvidenceImageStructure(png(1400, 900), "image/png").width === 1400, "PNG comum deve ser aceito.");
expect(validateEvidenceImageStructure(webpVp8(1400, 900), "image/webp").height === 900, "WebP VP8 deve ser aceito.");
expect(validateEvidenceImageStructure(webpVp8l(1400, 900), "image/webp").width === 1400, "WebP VP8L deve ser aceito.");
expect(validateEvidenceImageStructure(webpVp8x(1400, 900), "image/webp").height === 900, "WebP VP8X deve ser aceito.");

expect(validateEvidenceImageStructure(png(8000, 5000), "image/png").width === 8000, "40 MP exatos devem ser aceitos.");
expectThrows(() => validateEvidenceImageStructure(png(8000, 5001), "image/png"), EVIDENCE_VALIDATION_ERRORS.DIMENSIONS, "PNG acima de 40 MP");
expectThrows(() => validateEvidenceImageStructure(jpeg(8001, 100), "image/jpeg"), EVIDENCE_VALIDATION_ERRORS.DIMENSIONS, "JPEG acima de 8000 px");
expectThrows(() => validateEvidenceImageStructure(webpVp8x(8000, 8000), "image/webp"), EVIDENCE_VALIDATION_ERRORS.DIMENSIONS, "WebP pixel bomb");

const badPng = png(100, 100);
badPng.write("NOPE", 12, "ascii");
expectThrows(() => validateEvidenceImageStructure(badPng, "image/png"), EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "PNG sem IHDR");

const badJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]);
expectThrows(() => validateEvidenceImageStructure(badJpeg, "image/jpeg"), EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "JPEG sem SOF");

const excessiveMarkers = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  ...Array.from({ length: 513 }, () => Buffer.from([0xff, 0xd0])),
  jpeg(100, 100).subarray(2),
]);
expectThrows(() => validateEvidenceImageStructure(excessiveMarkers, "image/jpeg"), EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "JPEG com custo abusivo");

const badWebp = webpVp8x(100, 100);
badWebp[21] = 1;
expectThrows(() => validateEvidenceImageStructure(badWebp, "image/webp"), EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "WebP reservado inválido");

const interFrameVp8 = webpVp8(100, 100);
interFrameVp8[20] = 1;
expectThrows(() => validateEvidenceImageStructure(interFrameVp8, "image/webp"), EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "WebP VP8 sem keyframe");

expect(isEvidenceValidationFailure(new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE)), "Estrutura inválida deve ser erro do cliente.");
expect(isEvidenceValidationFailure(new Error(EVIDENCE_VALIDATION_ERRORS.DIMENSIONS)), "Dimensões inválidas devem ser erro do cliente.");

const structurallyInvalidJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]);
const invalidDataUrl = `data:image/jpeg;base64,${structurallyInvalidJpeg.toString("base64")}`;
let asyncError: unknown;
try {
  await uploadDemandEvidence("test-demand", invalidDataUrl);
} catch (caught) {
  asyncError = caught;
}
expect(asyncError instanceof Error, "Imagem estruturalmente inválida deve rejeitar.");
expect((asyncError as Error).message === EVIDENCE_VALIDATION_ERRORS.STRUCTURE, "Estrutura inválida deve falhar antes do Storage.");

console.log("registration P1.4A image structure runtime: ok");
