import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/errors.mjs';
import { allPermanentFdiCodes, cleanFdiCode, cleanTimestamp } from '../src/validation.mjs';

test('permanent tooth profile contains 32 unique FDI positions', () => {
  const codes = allPermanentFdiCodes();
  assert.equal(codes.length, 32);
  assert.equal(new Set(codes).size, 32);
  assert.ok(codes.includes('11'));
  assert.ok(codes.includes('48'));
});

test('invalid FDI position is rejected', () => {
  assert.throws(() => cleanFdiCode('99'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'invalid_tooth');
    return true;
  });
});

test('timestamps are normalized to UTC', () => {
  assert.equal(cleanTimestamp('2026-08-16T10:00:00+08:00'), '2026-08-16T02:00:00.000Z');
});
