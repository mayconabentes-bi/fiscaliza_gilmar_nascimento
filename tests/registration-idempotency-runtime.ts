import { demandRequestFingerprint, hashDemandEvidence, isIdempotentReplay, normalizeIdempotencyKey } from "../src/server/demandIdempotency.js";

const key = "2f1f1234-6b77-4c82-8b2d-d2db21a94111";
if (normalizeIdempotencyKey(key.toUpperCase()) !== key) throw new Error("UUID deve ser normalizado para lowercase.");
if (normalizeIdempotencyKey("") !== null) throw new Error("Chave ausente deve permitir compatibilidade.");

for (const invalid of ["abc", "sb_publishable_test", "00000000-0000-0000-0000-000000000000"]) {
  let rejected = false;
  try { normalizeIdempotencyKey(invalid); } catch { rejected = true; }
  if (!rejected) throw new Error("Chave inválida aceita: " + invalid);
}

const photoA = "data:image/jpeg;base64,AAA";
const photoB = "data:image/jpeg;base64,AAB";
if (hashDemandEvidence(photoA) === hashDemandEvidence(photoB)) throw new Error("Evidências diferentes devem produzir hashes diferentes.");

const payload = { actor: null, nome: "Teste", municipio: "Manaus", categoria: "INFRAESTRUTURA_URBANA", descricao: "Buraco na via", evidencias: [hashDemandEvidence(photoA)] };
const first = demandRequestFingerprint(payload);
const replay = demandRequestFingerprint({ ...payload });
const changed = demandRequestFingerprint({ ...payload, descricao: "Outro relato" });

if (first !== replay) throw new Error("Mesmo payload deve produzir o mesmo fingerprint.");
if (!isIdempotentReplay(first, replay)) throw new Error("Mesmo fingerprint deve ser reconhecido como replay.");
if (isIdempotentReplay(first, changed)) throw new Error("Payload diferente não pode ser tratado como replay.");
if (!/^[0-9a-f]{64}$/.test(first)) throw new Error("Fingerprint deve ser SHA-256 hexadecimal.");

console.log("registration idempotency runtime: ok");
