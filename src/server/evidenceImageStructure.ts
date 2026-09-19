import { EVIDENCE_VALIDATION_ERRORS } from "./evidenceValidation.js";

export type EvidenceDimensions = {
  width: number;
  height: number;
};

const MAX_EVIDENCE_SIDE_PX = 8_000;
const MAX_EVIDENCE_PIXELS = 40_000_000;
const MAX_JPEG_MARKERS_BEFORE_SOF = 512;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_PNG_BIT_DEPTHS: Record<number, Set<number>> = {
  0: new Set([1, 2, 4, 8, 16]),
  2: new Set([8, 16]),
  3: new Set([1, 2, 4, 8]),
  4: new Set([8, 16]),
  6: new Set([8, 16]),
};

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function validateDimensions(width: number, height: number): EvidenceDimensions {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }
  if (width > MAX_EVIDENCE_SIDE_PX || height > MAX_EVIDENCE_SIDE_PX) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.DIMENSIONS);
  }
  if (width * height > MAX_EVIDENCE_PIXELS) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.DIMENSIONS);
  }
  return { width, height };
}

function parsePngDimensions(buffer: Buffer): EvidenceDimensions {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }
  const ihdrLength = buffer.readUInt32BE(8);
  const ihdrType = buffer.subarray(12, 16).toString("ascii");
  if (ihdrLength !== 13 || ihdrType !== "IHDR") {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const compression = buffer[26];
  const filter = buffer[27];
  const interlace = buffer[28];

  if (!VALID_PNG_BIT_DEPTHS[colorType]?.has(bitDepth) || compression !== 0 || filter !== 0 || (interlace !== 0 && interlace !== 1)) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }

  return validateDimensions(width, height);
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

function parseJpegDimensions(buffer: Buffer): EvidenceDimensions {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }

  let offset = 2;
  let markerCount = 0;
  while (offset < buffer.length) {
    markerCount += 1;
    if (markerCount > MAX_JPEG_MARKERS_BEFORE_SOF) {
      throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    }
    if (buffer[offset] !== 0xff) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0x00) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    if (marker === 0xd9 || marker === 0xda) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);

    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > buffer.length) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 11) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
      const payloadStart = offset + 2;
      const height = buffer.readUInt16BE(payloadStart + 1);
      const width = buffer.readUInt16BE(payloadStart + 3);
      const components = buffer[payloadStart + 5];
      if (components < 1 || segmentLength !== 8 + 3 * components) {
        throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
      }
      return validateDimensions(width, height);
    }

    offset += segmentLength;
  }

  throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
}

function validateRiffEnvelope(buffer: Buffer) {
  if (
    buffer.length < 20 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }
  const riffSize = buffer.readUInt32LE(4);
  const declaredTotal = riffSize + 8;
  if (declaredTotal > buffer.length || declaredTotal < 20) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }
  const chunkSize = buffer.readUInt32LE(16);
  const chunkEnd = 20 + chunkSize;
  if (chunkEnd > declaredTotal || chunkEnd > buffer.length) {
    throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
  }
  return chunkSize;
}

function parseWebpDimensions(buffer: Buffer): EvidenceDimensions {
  const chunkSize = validateRiffEnvelope(buffer);
  const chunk = buffer.subarray(12, 16).toString("ascii");

  if (chunk === "VP8 ") {
    if (chunkSize < 10 || buffer.length < 30) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    const frameStart = 20;
    if (
      (buffer[frameStart] & 0x01) !== 0 ||
      buffer[frameStart + 3] !== 0x9d ||
      buffer[frameStart + 4] !== 0x01 ||
      buffer[frameStart + 5] !== 0x2a
    ) {
      throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    }
    const width = buffer.readUInt16LE(frameStart + 6) & 0x3fff;
    const height = buffer.readUInt16LE(frameStart + 8) & 0x3fff;
    return validateDimensions(width, height);
  }

  if (chunk === "VP8L") {
    if (chunkSize < 5 || buffer.length < 25) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    const payload = 20;
    if (buffer[payload] !== 0x2f) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    const b1 = buffer[payload + 1];
    const b2 = buffer[payload + 2];
    const b3 = buffer[payload + 3];
    const b4 = buffer[payload + 4];
    const version = b4 >> 5;
    if (version !== 0) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    const width = 1 + b1 + ((b2 & 0x3f) << 8);
    const height = 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10);
    return validateDimensions(width, height);
  }

  if (chunk === "VP8X") {
    if (chunkSize !== 10 || buffer.length < 30) throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    if (buffer[21] !== 0 || buffer[22] !== 0 || buffer[23] !== 0) {
      throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
    }
    const width = 1 + readUInt24LE(buffer, 24);
    const height = 1 + readUInt24LE(buffer, 27);
    return validateDimensions(width, height);
  }

  throw new Error(EVIDENCE_VALIDATION_ERRORS.STRUCTURE);
}

export function validateEvidenceImageStructure(buffer: Buffer, mime: string): EvidenceDimensions {
  if (mime === "image/jpeg") return parseJpegDimensions(buffer);
  if (mime === "image/png") return parsePngDimensions(buffer);
  if (mime === "image/webp") return parseWebpDimensions(buffer);
  throw new Error(EVIDENCE_VALIDATION_ERRORS.TYPE);
}

export const EVIDENCE_IMAGE_LIMITS = {
  maxSidePx: MAX_EVIDENCE_SIDE_PX,
  maxPixels: MAX_EVIDENCE_PIXELS,
  maxJpegMarkersBeforeSof: MAX_JPEG_MARKERS_BEFORE_SOF,
} as const;
