import crypto from "node:crypto";

const UUID_V4_OR_COMPATIBLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeIdempotencyKey(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) throw new Error("invalid_idempotency_key");
  const key = String(value).trim().toLowerCase();
  if (!UUID_V4_OR_COMPATIBLE.test(key)) throw new Error("invalid_idempotency_key");
  return key;
}

export function hashDemandEvidence(dataUrl: string) {
  return crypto.createHash("sha256").update(dataUrl).digest("hex");
}

export function demandRequestFingerprint(payload: Record<string, unknown>) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function isIdempotentReplay(storedFingerprint: unknown, incomingFingerprint: string) {
  return typeof storedFingerprint === "string" && storedFingerprint === incomingFingerprint;
}
