import assert from "node:assert/strict";
import { detectMobileImageFormat, MobileImageError } from "../src/lib/mobileImage.ts";

function mockFile(bytes: number[], name: string, type = "") {
  const blob = new Blob([Uint8Array.from(bytes)], { type });
  return { name, type, slice: blob.slice.bind(blob) };
}

const jpeg = mockFile([0xff, 0xd8, 0xff, 0xe0], "sem-extensao", "application/octet-stream");
assert.equal(await detectMobileImageFormat(jpeg), "jpeg");

const png = mockFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "foto.bin");
assert.equal(await detectMobileImageFormat(png), "png");

const webp = mockFile([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")], "foto.bin");
assert.equal(await detectMobileImageFormat(webp), "webp");

const heic = mockFile([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0, ...Buffer.from("mif1")], "IMG_0001", "application/octet-stream");
assert.equal(await detectMobileImageFormat(heic), "heic");

const avif = mockFile([0, 0, 0, 24, ...Buffer.from("ftypavif"), 0, 0, 0, 0, ...Buffer.from("avif")], "imagem", "application/octet-stream");
assert.equal(await detectMobileImageFormat(avif), "avif");

const metadataFallback = mockFile([1, 2, 3, 4], "foto.HEIF", "application/octet-stream");
assert.equal(await detectMobileImageFormat(metadataFallback), "heic");

const unreadable = { name: "nuvem.jpg", type: "image/jpeg", slice: () => ({ arrayBuffer: async () => { throw new Error("offline"); } }) } as any;
await assert.rejects(() => detectMobileImageFormat(unreadable), (error: unknown) => error instanceof MobileImageError && error.code === "unreadable");

console.log("mobile image format runtime: ok");
