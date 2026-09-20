import crypto from "node:crypto";

export function citizenPasswordFingerprint(passwordHash: string) {
  return crypto.createHash("sha256").update(passwordHash).digest("base64url");
}

export function isCitizenSessionCurrent(claimedFingerprint: unknown, passwordHash: unknown) {
  if (typeof claimedFingerprint !== "string" || !claimedFingerprint) return false;
  if (typeof passwordHash !== "string" || !passwordHash) return false;

  const currentFingerprint = citizenPasswordFingerprint(passwordHash);
  const claimedBuffer = Buffer.from(claimedFingerprint);
  const currentBuffer = Buffer.from(currentFingerprint);
  return claimedBuffer.length === currentBuffer.length
    && crypto.timingSafeEqual(claimedBuffer, currentBuffer);
}
