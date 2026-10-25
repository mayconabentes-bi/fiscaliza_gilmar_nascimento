import fs from "node:fs";
import assert from "node:assert/strict";

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const auth = fs.readFileSync("src/server/privateAdminAuth.ts", "utf8");
const login = fs.readFileSync("src/pages/Login.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const audit = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const goLive = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");

const globalHeaders = Array.isArray(vercel.headers)
  ? vercel.headers.find((entry) => entry?.source === "/(.*)")
  : null;
assert.ok(globalHeaders, "Vercel must define global defensive response headers.");
const headerMap = new Map((globalHeaders.headers || []).map((item) => [item.key, item.value]));
assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
assert.equal(headerMap.get("X-Frame-Options"), "DENY");
assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");

assert.match(goLive, /process\.env\.VERCEL_ENV\s*!==\s*"preview"/, "Vercel Preview isolation gate must exist.");
assert.match(goLive, /jnlfmiwczpglojqytrbw/, "Preview guard must recognize the production Supabase project.");
assert.match(goLive, /zqxouixpokuprqqscnwf/, "Preview guard must require the homologation Supabase project.");
assert.match(goLive, /process\.env\.VERCEL_URL/, "Current Vercel deployment URL must be accepted as a trusted origin.");
assert.doesNotMatch(goLive, /RAILWAY_PUBLIC_DOMAIN/, "Railway must not remain in the runtime origin policy.");

assert.doesNotMatch(auth, /email:\s*admin\.email/, "Admin login response must not expose or persist the admin email unnecessarily.");
assert.match(login, /type === "admin"\) localStorage\.removeItem\("user"\)/, "Admin login must not persist identity data in localStorage.");
assert.match(app, /parsedUser\?\.type === "admin"/, "Legacy admin localStorage data must be discarded during hydration.");
assert.match(app, /data\.user\?\.type === "admin"\) localStorage\.removeItem\("user"\)/, "Revalidated admin sessions must not be written to localStorage.");

const auditControl = audit.slice(audit.indexOf('check: "Rate limiting e headers HTTP"'));
assert.match(auditControl, /status:\s*"WARNING"/, "Runtime-unverified infrastructure controls must not be reported as PASS.");
assert.match(auditControl, /runtime serverless da Vercel/, "Audit details must explain the runtime verification gap.");

console.log("Security hardening contract: OK");
