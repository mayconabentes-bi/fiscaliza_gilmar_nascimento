import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("src/server/citizenAuthPostgres.ts", "utf8");
const app = fs.readFileSync("src/server/app.ts", "utf8");
const login = fs.readFileSync("src/pages/Login.tsx", "utf8");
const recover = fs.readFileSync("src/pages/RecoverAccess.tsx", "utf8");
const readiness = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");

assert.match(auth, /\/api\/auth\/recovery\/request/, "missing recovery request endpoint");
assert.match(auth, /\/api\/auth\/recovery\/reset/, "missing recovery reset endpoint");
assert.match(auth, /Se houver uma conta com esse e-mail/, "request response must avoid account enumeration");
assert.match(auth, /passwordFingerprint/, "reset token must be bound to current password hash");
assert.match(auth, /expiresIn: "20m"/, "reset token must have a short expiration");
assert.match(auth, /PASSWORD_RECOVERY_EMAIL_NOT_CONFIGURED/, "email delivery must fail closed when not configured");
assert.match(auth, /res\.clearCookie\("token"/, "password reset must invalidate browser session");
assert.match(app, /\/api\/auth\/recovery\/request", limiter\(/, "recovery request must be rate limited");
assert.match(app, /\/api\/auth\/recovery\/reset", limiter\(/, "recovery reset must be rate limited");
assert.match(login, /\/recuperar-acesso/, "login must expose account recovery");
assert.match(recover, /Não lembro o e-mail/, "forgotten-email recovery path must be visible");
assert.match(recover, /não revela automaticamente um e-mail/, "email recovery must avoid unsafe account lookup");
assert.match(readiness, /passwordRecovery/, "readiness must expose recovery feature state");
console.log("Account recovery security contract: OK");
