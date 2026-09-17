import assert from 'node:assert/strict';
import { AgePolicyError, ageBandForActiveParticipation, parseAgeBand, requiresEnhancedProtection } from '../src/server/agePolicy.js';

assert.equal(parseAgeBand('UNDER_16'), 'UNDER_16');
assert.equal(parseAgeBand('AGE_16_17'), 'AGE_16_17');
assert.equal(parseAgeBand('AGE_18_PLUS'), 'AGE_18_PLUS');

assert.throws(
  () => ageBandForActiveParticipation('UNDER_16'),
  (error: unknown) => {
    assert.ok(error instanceof AgePolicyError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'AGE_UNDER_16_NOT_ALLOWED');
    return true;
  },
);

const teen = ageBandForActiveParticipation('AGE_16_17');
assert.equal(teen.ageBand, 'AGE_16_17');
assert.equal(teen.enhancedProtection, true);
assert.equal(requiresEnhancedProtection('AGE_16_17'), true);

const adult = ageBandForActiveParticipation('AGE_18_PLUS');
assert.equal(adult.ageBand, 'AGE_18_PLUS');
assert.equal(adult.enhancedProtection, false);
assert.equal(requiresEnhancedProtection('AGE_18_PLUS'), false);

assert.throws(
  () => parseAgeBand(''),
  (error: unknown) => error instanceof AgePolicyError && error.code === 'AGE_BAND_INVALID',
);

console.log('P0-E age flow runtime tests: OK — <16 bloqueado, 16–17 protegido, 18+ permitido');
