import test from 'node:test';
import assert from 'node:assert/strict';

import { enforceRateLimits, rateLimitRules } from '../src/rate-limit.mjs';

function fakeDb() {
  const counters = new Map();
  return {
    prepare(sql) {
      return {
        bind(...values) {
          const [scope, keyHash, windowStart] = values;
          const key = `${scope}:${keyHash}:${windowStart}`;
          return {
            async run() {
              counters.set(key, (counters.get(key) || 0) + 1);
            },
            async first() {
              return { request_count: counters.get(key) || 0 };
            }
          };
        }
      };
    }
  };
}

test('uploads, messages and hospital imports receive stricter rules', () => {
  const uploadRules = rateLimitRules(new Request('https://api.example.test/v1/events/abc/photos', { method: 'POST' }));
  assert.ok(uploadRules.some((rule) => rule.scope === 'photo:daily' && rule.limit === 200));
  const messageRules = rateLimitRules(new Request('https://api.example.test/v1/profiles/abc/messages', { method: 'POST' }));
  assert.ok(messageRules.some((rule) => rule.scope === 'message:account'));
  const importRules = rateLimitRules(new Request('https://api.example.test/v1/organizations/abc/imports', { method: 'POST' }));
  assert.ok(importRules.some((rule) => rule.scope === 'hospital_import:account'));
});

test('thirteenth photo in one minute is rejected with retry-after', async () => {
  const env = { DB: fakeDb() };
  const request = new Request('https://api.example.test/v1/events/abc/photos', {
    method: 'POST',
    headers: { 'cf-connecting-ip': '203.0.113.10' }
  });
  const user = { id: 'user-1' };
  const timestamp = Date.parse('2026-08-21T08:00:10Z');
  for (let i = 0; i < 12; i += 1) await enforceRateLimits(request, env, user, timestamp);
  await assert.rejects(() => enforceRateLimits(request, env, user, timestamp), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, 'rate_limit_exceeded');
    assert.equal(error.retryAfter, 50);
    return true;
  });
});
