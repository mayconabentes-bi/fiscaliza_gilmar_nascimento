import {
  citizenPasswordFingerprint,
  isCitizenSessionCurrent,
} from "../src/server/citizenSessionSecurity.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const originalHash = "$2b$12$original-password-hash-value";
const changedHash = "$2b$12$changed-password-hash-value";
const fingerprint = citizenPasswordFingerprint(originalHash);

expect(fingerprint.length > 20, "Fingerprint deve ser não trivial.");
expect(isCitizenSessionCurrent(fingerprint, originalHash), "Sessão emitida para o hash atual deve permanecer válida.");
expect(!isCitizenSessionCurrent(fingerprint, changedHash), "Troca de senha deve revogar a sessão anterior.");
expect(!isCitizenSessionCurrent("", originalHash), "Fingerprint ausente deve falhar fechado.");
expect(!isCitizenSessionCurrent(fingerprint, ""), "Hash persistido ausente deve falhar fechado.");

console.log("Citizen session security runtime: OK");
