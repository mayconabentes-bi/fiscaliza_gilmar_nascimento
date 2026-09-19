import crypto from "node:crypto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const STORAGE_REQUEST_TIMEOUT_MS = 4000;
const STORAGE_UPLOAD_ATTEMPTS = 2;

export class EvidenceStorageUnavailableError extends Error {
  readonly code = "EVIDENCE_STORAGE_UNAVAILABLE";

  constructor() {
    super("Armazenamento de evidências temporariamente indisponível");
    this.name = "EvidenceStorageUnavailableError";
  }
}

function storageRequestSignal() {
  return AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS);
}

function isTransientStorageStatus(status: number) {
  return status === 429 || status >= 500;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateStorageServiceKey(serviceRoleKey: string) {
  if (serviceRoleKey.startsWith("sb_secret_")) return;

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("Supabase Storage não configurado");
  }

  const parts = serviceRoleKey.split(".");
  if (parts.length !== 3) {
    throw new Error("Supabase Storage não configurado");
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    if (payload.role !== "service_role") throw new Error("invalid_role");
  } catch {
    throw new Error("Supabase Storage não configurado");
  }
}

function storageConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_EVIDENCE_BUCKET?.trim() || "evidencias-demandas";
  if (!url || !serviceRoleKey || !bucket) throw new Error("Supabase Storage não configurado");
  validateStorageServiceKey(serviceRoleKey);
  return { url: url.replace(/\/+$/, ""), serviceRoleKey, bucket };
}

function storageAuthHeaders(serviceRoleKey: string) {
  const headers: Record<string, string> = { apikey: serviceRoleKey };
  if (!serviceRoleKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

export async function checkEvidenceBucketPrivate() {
  const { url, serviceRoleKey, bucket } = storageConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      method: "GET",
      headers: storageAuthHeaders(serviceRoleKey),
      signal: storageRequestSignal(),
    });
  } catch {
    throw new EvidenceStorageUnavailableError();
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Falha ao validar bucket de evidências:", response.status, detail.slice(0, 300));
    if (isTransientStorageStatus(response.status)) throw new EvidenceStorageUnavailableError();
    throw new Error("Bucket de evidências indisponível ou não autorizado");
  }

  const data = await response.json() as { id?: string; name?: string; public?: boolean };
  if (data.public !== false) {
    throw new Error("Bucket de evidências deve ser privado");
  }
  if (data.id !== bucket && data.name !== bucket) {
    throw new Error("Bucket de evidências retornado não corresponde à configuração");
  }

  return true;
}

function parseEvidenceDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error("Formato de evidência inválido");
  const mime = match[1];
  if (!ALLOWED_MIME_TYPES.has(mime)) throw new Error("Tipo de evidência não permitido");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_EVIDENCE_BYTES) throw new Error("Tamanho de evidência inválido");
  return { buffer, mime };
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function objectUrl(baseUrl: string, bucket: string, objectPath: string) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
}

export async function uploadDemandEvidence(demandaId: string, dataUrl: string) {
  const { url, serviceRoleKey, bucket } = storageConfig();
  const { buffer, mime } = parseEvidenceDataUrl(dataUrl);
  const path = `${demandaId}/${crypto.randomUUID()}.${extensionForMime(mime)}`;

  for (let attempt = 1; attempt <= STORAGE_UPLOAD_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(objectUrl(url, bucket, path), {
        method: "POST",
        headers: { ...storageAuthHeaders(serviceRoleKey), "Content-Type": mime, "x-upsert": "false" },
        body: buffer,
        signal: storageRequestSignal(),
      });
    } catch {
      if (attempt < STORAGE_UPLOAD_ATTEMPTS) {
        await delay(150);
        continue;
      }
      throw new EvidenceStorageUnavailableError();
    }

    if (response.ok) return { path, mime };

    const detail = await response.text().catch(() => "");
    console.error("Falha no upload da evidência:", response.status, detail.slice(0, 300));
    if (isTransientStorageStatus(response.status)) {
      if (attempt < STORAGE_UPLOAD_ATTEMPTS) {
        await delay(150);
        continue;
      }
      throw new EvidenceStorageUnavailableError();
    }
    throw new Error("Não foi possível armazenar a evidência");
  }

  throw new EvidenceStorageUnavailableError();
}

export async function removeDemandEvidence(objectPath: string) {
  const { url, serviceRoleKey, bucket } = storageConfig();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: { ...storageAuthHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [objectPath] }),
    signal: storageRequestSignal(),
  });
  if (!response.ok) console.error("Falha ao remover evidência órfã:", response.status);
}

export async function createDemandEvidenceSignedUrl(objectPath: string, expiresIn = 300) {
  const { url, serviceRoleKey, bucket } = storageConfig();
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: { ...storageAuthHeaders(serviceRoleKey), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
    signal: storageRequestSignal(),
  });
  if (!response.ok) throw new Error("Não foi possível gerar acesso temporário à evidência");
  const data = await response.json() as { signedURL?: string; signedUrl?: string };
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) throw new Error("Resposta inválida ao gerar acesso temporário à evidência");
  if (signedPath.startsWith("http")) return signedPath;
  if (signedPath.startsWith("/storage/v1/")) return `${url}${signedPath}`;
  const normalizedPath = signedPath.startsWith("/") ? signedPath : `/${signedPath}`;
  return `${url}/storage/v1${normalizedPath}`;
}
