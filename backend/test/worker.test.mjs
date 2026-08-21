import test from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../src/worker.mjs';

const env = {
  DB: {},
  PHOTOS: {},
  ALLOWED_ORIGINS: 'https://relaxcrazy528-prog.github.io,https://csgeekr.com'
};

test('health endpoint is public but does not expose configuration', async () => {
  const response = await handleRequest(new Request('https://api.example.test/health'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { status: 'ok', service: 'teethsee-backend', version: '0.2.0' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('private endpoint requires authenticated platform identity', async () => {
  const response = await handleRequest(new Request('https://api.example.test/v1/me'), env);
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, 'authentication_required');
});

test('untrusted browser origin is rejected before authenticated data access', async () => {
  const response = await handleRequest(new Request('https://api.example.test/v1/me', {
    headers: { origin: 'https://evil.example' }
  }), env);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error.code, 'origin_not_allowed');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('allowed origin receives a narrow preflight response', async () => {
  const response = await handleRequest(new Request('https://api.example.test/v1/me', {
    method: 'OPTIONS',
    headers: { origin: 'https://relaxcrazy528-prog.github.io' }
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://relaxcrazy528-prog.github.io');
  assert.doesNotMatch(response.headers.get('access-control-allow-headers'), /oai-authenticated-user-id/i);
});
