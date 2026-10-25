import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/server/goLiveSecurity.ts", "utf8");
const readiness = source.slice(source.indexOf('app.get("/ready"'));
assert.ok(readiness.startsWith('app.get("/ready"'), "Readiness route must exist");
assert.match(readiness, /code: "READINESS_CHECK_FAILED"/, "Readiness error must use a generic public code");
assert.doesNotMatch(readiness, /error:\s*error\s+instanceof\s+Error\s*\?\s*error\.message/, "Never expose internal exception messages from /ready");
console.log("Readiness error redaction contract: OK");
