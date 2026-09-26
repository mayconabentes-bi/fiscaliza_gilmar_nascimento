import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { fieldTicketHash, fieldRegistrationEnabled } from "../src/server/fieldRegistration.js";

const raw = randomBytes(32).toString("hex");
const expected = createHash("sha256").update(raw, "ascii").digest("hex");
assert.equal(fieldTicketHash(raw), expected);
for (const invalid of ["", "0".repeat(63), "0".repeat(65), "z".repeat(64), "A".repeat(64), null, {}, 1]) {
  assert.equal(fieldTicketHash(invalid), null, "must reject malformed tickets");
}
const prevNode = process.env.NODE_ENV;
const prevFlag = process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION;
try {
  process.env.NODE_ENV = "test";
  process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION = "true";
  assert.equal(fieldRegistrationEnabled(), false, "never enable in test/preview mode");
  process.env.NODE_ENV = "production";
  delete process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION;
  assert.equal(fieldRegistrationEnabled(), false, "production default must be closed");
  process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION = "true";
  assert.equal(fieldRegistrationEnabled(), true, "explicit production flag required");
} finally {
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevFlag === undefined) delete process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION;
  else process.env.ENABLE_SUPERVISED_FIELD_REGISTRATION = prevFlag;
}
console.log("FIELD_SUPERVISED_RUNTIME=PASS: 256-bit token parsing and default-off configuration.");
