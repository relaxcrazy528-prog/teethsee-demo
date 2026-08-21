import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';

import { oidcIdentity, requireCurrentUser, sitesIdentity } from '../src/auth.mjs';

const issuer = 'https://identity.example.test';
const audience = 'teethsee-api';

async function signer() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return {
    privateKey,
    jwks: createLocalJWKSet({ keys: [publicJwk] })
  };
}

async function token(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: 'zoe@example.test',
    email_verified: true,
    name: 'Zoe',
    ...overrides.payload
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
    .setSubject(overrides.subject || 'user-123')
    .setIssuer(overrides.issuer || issuer)
    .setAudience(overrides.audience || audience)
    .setIssuedAt(overrides.iat ?? now)
    .setExpirationTime(overrides.exp ?? now + 300)
    .sign(privateKey);
}

const env = {
  OIDC_ISSUER: issuer,
  OIDC_JWKS_URL: `${issuer}/.well-known/jwks.json`,
  OIDC_AUDIENCE: audience
};

test('valid OIDC token is verified with issuer, audience, signature and expiry', async () => {
  const { privateKey, jwks } = await signer();
  const jwt = await token(privateKey);
  const request = new Request('https://api.example.test/v1/me', {
    headers: { authorization: `Bearer ${jwt}` }
  });
  const identity = await oidcIdentity(request, env, { jwks });
  assert.equal(identity.provider, `oidc:${issuer}`);
  assert.equal(identity.subject, 'user-123');
  assert.equal(identity.email, 'zoe@example.test');
  assert.equal(identity.displayName, 'Zoe');
});

test('wrong audience and expired token are rejected', async () => {
  const { privateKey, jwks } = await signer();
  const wrongAudience = await token(privateKey, { audience: 'another-api' });
  await assert.rejects(
    () => oidcIdentity(new Request('https://api.example.test/v1/me', { headers: { authorization: `Bearer ${wrongAudience}` } }), env, { jwks }),
    (error) => error.status === 401 && error.code === 'invalid_token'
  );

  const now = Math.floor(Date.now() / 1000);
  const expired = await token(privateKey, { iat: now - 600, exp: now - 300 });
  await assert.rejects(
    () => oidcIdentity(new Request('https://api.example.test/v1/me', { headers: { authorization: `Bearer ${expired}` } }), env, { jwks }),
    (error) => error.status === 401 && error.code === 'invalid_token'
  );
});

test('unverified OIDC email is not trusted', async () => {
  const { privateKey, jwks } = await signer();
  const jwt = await token(privateKey, { payload: { email_verified: false } });
  const identity = await oidcIdentity(
    new Request('https://api.example.test/v1/me', { headers: { authorization: `Bearer ${jwt}` } }),
    env,
    { jwks }
  );
  assert.equal(identity.email, null);
});

test('Sites full name is decoded only with the expected encoding marker', () => {
  const identity = sitesIdentity(new Request('https://api.example.test/v1/me', {
    headers: {
      'oai-authenticated-user-id': 'sites-user-1',
      'oai-authenticated-user-email': 'zoe@example.test',
      'oai-authenticated-user-full-name': 'Zoe%20Chen',
      'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8'
    }
  }));
  assert.equal(identity.displayName, 'Zoe Chen');
});

test('OIDC mode never accepts spoofed Sites identity headers as a fallback', async () => {
  const request = new Request('https://api.example.test/v1/me', {
    headers: { 'oai-authenticated-user-id': 'spoofed-sites-user' }
  });
  await assert.rejects(
    () => requireCurrentUser(request, { ...env, AUTH_MODE: 'oidc', DB: {} }),
    (error) => error.status === 401 && error.code === 'authentication_required'
  );
});
