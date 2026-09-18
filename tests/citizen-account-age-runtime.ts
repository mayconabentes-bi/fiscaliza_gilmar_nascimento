import assert from "node:assert/strict";
import { ageBandForActiveParticipation } from "../src/server/agePolicy.ts";

for (const ageBand of ["AGE_16_17","AGE_18_24","AGE_25_34","AGE_35_44","AGE_45_59","AGE_60_PLUS"] as const) {
  const result = ageBandForActiveParticipation(ageBand);
  assert.equal(result.ageBand, ageBand);
}
assert.throws(() => ageBandForActiveParticipation("AGE_18_PLUS"));
console.log("Citizen account age runtime OK: only detailed active bands are accepted.");
