const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 300 * 1024;
const MAX_SIDE = 1400;

function imageFileLooksValid(file: File) {
  if (file.type) return file.type.startsWith("image/");
  return /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Não foi possível abrir esta foto no navegador.")); };
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Falha ao compactar a foto.")),
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
  if (!ctx) throw new Error("Não foi possível preparar a foto.");
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

  throw new Error("A foto continua grande demais após otimização. Tente outra imagem.");
}

export async function prepareMobileEvidence(file: File) {
  if (!imageFileLooksValid(file)) throw new Error("Selecione uma imagem válida.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("A foto original é muito grande. Use uma imagem de até 30 MB.");

  const image = await loadImageElement(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error("Não foi possível identificar as dimensões da foto.");

  const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const canvas = scaledCanvas(image, sourceWidth, sourceHeight, scale);
  const blob = await encodeWithinLimit(canvas);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
    reader.readAsDataURL(blob);
  });

  return { dataUrl, bytes: blob.size };
}
