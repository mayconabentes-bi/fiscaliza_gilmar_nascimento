const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 300 * 1024;
const MAX_SIDE = 1400;
const DECODE_TIMEOUT_MS = 15_000;

export type MobileImageFormat = "jpeg" | "png" | "webp" | "avif" | "heic" | "other-image" | "unknown";
export type MobileImageErrorCode = "empty" | "too_large" | "unreadable" | "unsupported" | "heic_conversion" | "decode_timeout" | "encode";

export class MobileImageError extends Error {
  readonly code: MobileImageErrorCode;

  constructor(code: MobileImageErrorCode, message: string) {
    super(message);
    this.name = "MobileImageError";
    this.code = code;
  }
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function formatFromMetadata(file: Pick<File, "name" | "type">): MobileImageFormat {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (/heic|heif/.test(type) || /\.(?:heic|heif)$/.test(name)) return "heic";
  if (type === "image/jpeg" || /\.(?:jpe?g|jfif)$/.test(name)) return "jpeg";
  if (type === "image/png" || /\.png$/.test(name)) return "png";
  if (type === "image/webp" || /\.webp$/.test(name)) return "webp";
  if (type === "image/avif" || /\.avif$/.test(name)) return "avif";
  if (type.startsWith("image/")) return "other-image";
  return "unknown";
}

export async function detectMobileImageFormat(file: Pick<File, "name" | "type" | "slice">): Promise<MobileImageFormat> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 40).arrayBuffer());
  } catch {
    throw new MobileImageError("unreadable", "Não foi possível ler esta foto. Confirme se ela foi baixada completamente do armazenamento em nuvem.");
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brands = [];
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) brands.push(ascii(bytes, offset, 4).toLowerCase());
    if (brands.some((brand) => ["avif", "avis"].includes(brand))) return "avif";
    if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand))) return "heic";
  }

  return formatFromMetadata(file as Pick<File, "name" | "type">);
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

function loadImageElement(file: File) {
  return new Promise<DecodedImage>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      action();
    };
    const timer = window.setTimeout(() => finish(() => reject(new MobileImageError("decode_timeout", "A abertura da foto demorou demais. Confirme se ela está disponível no dispositivo e tente novamente."))), DECODE_TIMEOUT_MS);
    image.onload = () => finish(() => resolve({ source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, cleanup: () => undefined }));
    image.onerror = () => finish(() => reject(new MobileImageError("unsupported", "O navegador não conseguiu abrir esta foto.")));
    image.src = objectUrl;
  });
}

async function loadNativeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch {
      // Alguns WebViews não implementam todos os formatos; o elemento Image é o fallback.
    }
  }
  return loadImageElement(file);
}

async function loadHeicImage(file: File): Promise<DecodedImage> {
  try {
    const [{ decode }, buffer] = await Promise.all([import("@discourse/heic"), file.arrayBuffer()]);
    const imageData = await decode(buffer);
    if (!imageData?.width || !imageData?.height) throw new Error("empty_heic");
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.putImageData(imageData, 0, 0);
    return { source: canvas, width: canvas.width, height: canvas.height, cleanup: () => undefined };
  } catch {
    throw new MobileImageError("heic_conversion", "Esta foto está em HEIC/HEIF e não pôde ser convertida. Tente novamente ou escolha uma cópia em JPEG/PNG.");
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new MobileImageError("encode", "Falha ao compactar a foto.")),
      "image/jpeg",
      quality,
    );
  });
}

function scaledCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MobileImageError("encode", "Não foi possível preparar a foto.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encodeWithinLimit(initialCanvas: HTMLCanvasElement) {
  let canvas = initialCanvas;
  const qualities = [0.78, 0.68, 0.58, 0.5, 0.42];

  for (let resizeRound = 0; resizeRound < 4; resizeRound += 1) {
    for (const quality of qualities) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_OUTPUT_BYTES) return blob;
    }
    if (canvas.width <= 640 && canvas.height <= 640) break;
    canvas = scaledCanvas(canvas, canvas.width, canvas.height, 0.82);
  }

  throw new MobileImageError("encode", "A foto continua grande demais após otimização. Tente outra imagem.");
}

export async function prepareMobileEvidence(file: File) {
  if (!file.size) throw new MobileImageError("empty", "A foto está vazia ou ainda não foi baixada completamente do armazenamento em nuvem.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new MobileImageError("too_large", "A foto original é muito grande. Use uma imagem de até 30 MB.");

  const format = await detectMobileImageFormat(file);
  if (format === "unknown") throw new MobileImageError("unsupported", "Selecione uma imagem JPEG, PNG, WebP, AVIF, HEIC ou HEIF.");

  let decoded: DecodedImage;
  try {
    decoded = await loadNativeImage(file);
  } catch (nativeError) {
    if (format === "heic") decoded = await loadHeicImage(file);
    else if (nativeError instanceof MobileImageError) throw nativeError;
    else throw new MobileImageError("unsupported", "O formato desta foto não é compatível ou o arquivo está corrompido.");
  }

  try {
    if (!decoded.width || !decoded.height) throw new MobileImageError("unsupported", "Não foi possível identificar as dimensões da foto.");
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height));
    const canvas = scaledCanvas(decoded.source, decoded.width, decoded.height, scale);
    const blob = await encodeWithinLimit(canvas);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new MobileImageError("unreadable", "Não foi possível ler a foto preparada."));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, bytes: blob.size, sourceFormat: format };
  } finally {
    decoded.cleanup();
  }
}
