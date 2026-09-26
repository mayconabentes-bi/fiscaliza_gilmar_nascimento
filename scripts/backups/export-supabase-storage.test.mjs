import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { exportStorage, safeSegment } from "./export-supabase-storage.mjs";

test("nega nomes que escapariam do diretório de backup", () => {
  for (const name of ["", ".", "..", "../secret", "a/b", "a\\b", "x\0y", "C:secret", "NUL.jpg", "file?.png", "foto."]) {
    assert.throws(() => safeSegment(name));
  }
  assert.equal(safeSegment("foto-única.jpg"), "foto-única.jpg");
});

function mockStorage({ publicBucket = false, objectSize = 4 } = {}) {
  const called = [];
  const fetchImpl = async (target, opts) => {
    const u = String(target);
    called.push({ u, method: opts?.method });
    if (u.includes("/storage/v1/bucket/")) {
      return Response.json({ public: publicBucket, file_size_limit: 10000, allowed_mime_types: ["image/jpeg"] });
    }
    if (u.includes("/storage/v1/object/list/")) {
      const req = JSON.parse(opts.body);
      if (!req.prefix) return Response.json([{ name: "pasta", id: null }]);
      if (req.prefix === "pasta" && req.offset === 0) {
        return Response.json([{ name: "foto.jpg", id: "mock-id", metadata: { size: objectSize, mimetype: "image/jpeg" } }]);
      }
      return Response.json([]);
    }
    if (u.includes("/storage/v1/object/authenticated/")) return new Response("foto", { status: 200, headers: { "content-type": "image/jpeg" } });
    throw new Error("Rota não esperada na simulação");
  };
  return { fetchImpl, called };
}

test("exporta bucket privado, pastas e checksum sem qualquer dependência externa", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "offsite-test-"));
  try {
    const { fetchImpl } = mockStorage();
    const out = await exportStorage({
      endpoint: "https://example.supabase.co",
      serviceRoleKey: "test-only-not-a-real-key",
      bucket: "evidencias",
      dest: dir,
      fetchImpl,
    });
    assert.deepEqual(out, { objectCount: 1, totalBytes: 4 });
    const actual = await readFile(path.join(dir, "files", "pasta", "foto.jpg"));
    assert.equal(actual.toString(), "foto");
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.objectCount, 1);
    assert.equal(manifest.bucket.public, false);
    assert.equal(manifest.files[0].sha256, createHash("sha256").update("foto").digest("hex"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("falha se bucket não for privado", async () => {
  const { fetchImpl } = mockStorage({ publicBucket: true });
  await assert.rejects(exportStorage({
    endpoint: "https://example.supabase.co",
    serviceRoleKey: "test",
    bucket: "evidencias",
    dest: "/not-written",
    fetchImpl,
  }), /Bucket não está privado/);
});

test("falha em exportação incompleta, sem gerar manifesto válido", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "offsite-mismatch-"));
  try {
    const { fetchImpl } = mockStorage({ objectSize: 999 });
    await assert.rejects(exportStorage({
      endpoint: "https://example.supabase.co",
      serviceRoleKey: "test",
      bucket: "evidencias",
      dest: dir,
      fetchImpl,
    }), /Tamanho de objeto não confere/);
    await assert.rejects(readFile(path.join(dir, "manifest.json")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
