/**
 * Exporta somente o bucket privado de evidências do Supabase usando API autenticada.
 * Sem dependências npm; os arquivos ficam temporariamente no runner e serão
 * criptografados pelo restic antes do envio ao armazenamento externo.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";

const LIMIT = 100;
const transient = new Set([429, 500, 502, 503, 504]);

export function safeSegment(name) {
  if (typeof name !== "string" || !name || name === "." || name === ".." ||
      name.includes("/") || name.includes("\\") || name.includes("\0") ||
      /[<>:"|?*]/u.test(name) || /[. ]$/u.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) {
    throw new Error("Nome de objeto inválido no Storage.");
  }
  return name;
}

async function request(fetchImpl, url, opts) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, { ...opts, signal: AbortSignal.timeout(180000) });
    if (response.ok) return response;
    if (!transient.has(response.status) || attempt === 2) {
      throw new Error(`Supabase Storage HTTP ${response.status}: exportação interrompida.`);
    }
    await response.body?.cancel();
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("Falha de consulta ao Storage.");
}

export async function exportStorage({ endpoint, serviceRoleKey, bucket, dest, fetchImpl = fetch }) {
  if (!endpoint || !serviceRoleKey || !bucket || !dest) {
    throw new Error("Configuração de exportação incompleta.");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL precisa usar HTTPS.");
  safeSegment(bucket);
  const root = path.resolve(dest);
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const bucketPath = `${url.origin}/storage/v1/bucket/${encodeURIComponent(bucket)}`;
  const bucketRes = await request(fetchImpl, bucketPath, { headers });
  const bucketInfo = await bucketRes.json();
  if (bucketInfo.public !== false) throw new Error("Bucket não está privado: backup interrompido.");

  const files = [];
  const seen = new Set();
  let totalBytes = 0;

  async function walk(prefix = "", depth = 0) {
    if (depth > 50) throw new Error("Profundidade inesperada nas pastas do Storage.");
    let offset = 0;
    let page;
    do {
      const res = await request(fetchImpl, `${url.origin}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: LIMIT, offset, sortBy: { column: "name", order: "asc" } }),
      });
      page = await res.json();
      if (!Array.isArray(page)) throw new Error("Listagem do Storage em formato inesperado.");
      for (const entry of page) {
        safeSegment(entry.name);
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id == null) {
          await walk(relative, depth + 1);
          continue;
        }
        if (seen.has(relative)) throw new Error("Objeto duplicado na listagem do Storage.");
        seen.add(relative);
        const output = path.resolve(root, "files", ...relative.split("/"));
        if (!output.startsWith(path.resolve(root, "files") + path.sep)) {
          throw new Error("Caminho de Storage fora do diretório permitido.");
        }
        await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
        const encoded = relative.split("/").map(encodeURIComponent).join("/");
        const response = await request(fetchImpl,
          `${url.origin}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`,
          { headers });
        if (!response.body) throw new Error("Objeto sem conteúdo: exportação interrompida.");
        const digest = createHash("sha256");
        let bytes = 0;
        const count = new Transform({
          transform(chunk, encoding, callback) {
            digest.update(chunk);
            bytes += chunk.length;
            callback(null, chunk);
          },
        });
        try {
          await pipeline(Readable.fromWeb(response.body), count,
            createWriteStream(output, { flags: "wx", mode: 0o600 }));
        } catch (error) {
          await rm(output, { force: true });
          throw error;
        }
        const expected = entry.metadata?.size;
        if (expected != null && Number.isFinite(Number(expected)) && Number(expected) !== bytes) {
          throw new Error("Tamanho de objeto não confere: exportação interrompida.");
        }
        totalBytes += bytes;
        files.push({
          path: relative,
          size: bytes,
          sha256: digest.digest("hex"),
          contentType: entry.metadata?.mimetype || response.headers.get("content-type") || null,
        });
      }
      offset += page.length;
    } while (page.length === LIMIT);
  }

  await mkdir(root, { recursive: true, mode: 0o700 });
  await walk();
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    bucket: {
      id: bucket,
      public: false,
      file_size_limit: bucketInfo.file_size_limit ?? null,
      allowed_mime_types: bucketInfo.allowed_mime_types ?? null,
    },
    objectCount: files.length,
    totalBytes,
    files,
  }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Exportação do Storage concluída: ${files.length} arquivos; ${totalBytes} bytes.`);
  return { objectCount: files.length, totalBytes };
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  try {
    await exportStorage({
      endpoint: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: process.env.SUPABASE_EVIDENCE_BUCKET,
      dest: process.argv[2],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha no backup do Storage.");
    process.exitCode = 1;
  }
}
