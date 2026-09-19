import { validateStorageServiceKey } from "../src/server/evidenceStorage.js";

function expectThrows(fn: () => void, label: string) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`${label}: deveria rejeitar`);
}

validateStorageServiceKey("sb_secret_example_backend_key");
expectThrows(() => validateStorageServiceKey("sb_publishable_example_client_key"), "publishable key");
expectThrows(() => validateStorageServiceKey("not-a-key"), "malformed key");

const legacyPayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
validateStorageServiceKey(`eyJhbGciOiJIUzI1NiJ9.${legacyPayload}.signature`);

const anonPayload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
expectThrows(
  () => validateStorageServiceKey(`eyJhbGciOiJIUzI1NiJ9.${anonPayload}.signature`),
  "legacy anon key",
);

console.log("registration P0 hardening runtime: ok");
