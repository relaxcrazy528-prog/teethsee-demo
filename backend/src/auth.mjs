import { createRemoteJWKSet, jwtVerify } from 'jose';

import { ApiError, assert } from './errors.mjs';
import { cleanString } from './validation.mjs';

const remoteJwks = new Map();
const ALLOWED_JWT_ALGORITHMS = ['RS256', 'PS256', 'ES256'];
const MAX_BEARER_BYTES = 16 * 1024;

async function hashSubject(provider, subject) {
  const bytes = new TextEncoder().encode(`${provider}:${subject}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requiredHttpsUrl(value, field) {
  assert(typeof value === 'string' && value.length <= 2048, 503, 'authentication_not_configured', `${field} 尚未配置`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(503, 'authentication_not_configured', `${field} 配置不正确`);
  }
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.hash, 503, 'authentication_not_configured', `${field} 必须是 HTTPS 地址`);
  return url;
}

function getRemoteJwks(url) {
  const key = url.toString();
  if (!remoteJwks.has(key)) {
    remoteJwks.set(key, createRemoteJWKSet(url, {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000
    }));
  }
  return remoteJwks.get(key);
}

function bearerToken(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  assert(authorization.length <= MAX_BEARER_BYTES, 401, 'invalid_token', '登录凭证不正确');
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  assert(match, 401, 'invalid_token', '登录凭证不正确');
  return match[1];
}

function decodeSitesFullName(request) {
  const encoded = request.headers.get('oai-authenticated-user-full-name');
  const encoding = request.headers.get('oai-authenticated-user-full-name-encoding');
  if (!encoded || encoding !== 'percent-encoded-utf-8') return '';
  try {
    return decodeURIComponent(encoded).trim().slice(0, 80);
  } catch {
    return '';
  }
}

export function sitesIdentity(request) {
  const subject = request.headers.get('oai-authenticated-user-id');
  if (!subject) return null;
  assert(subject.length <= 512, 401, 'invalid_identity', '登录身份不正确');
  const emailValue = request.headers.get('oai-authenticated-user-email');
  return {
    provider: 'openai-sites',
    subject,
    email: emailValue ? cleanString(emailValue, '邮箱', { max: 254 }) : null,
    displayName: decodeSitesFullName(request)
  };
}

export async function oidcIdentity(request, env, options = {}) {
  const token = bearerToken(request);
  if (!token) return null;
  const issuer = cleanString(env.OIDC_ISSUER || '', 'OIDC 发行方', { min: 1, max: 2048 });
  const issuerUrl = requiredHttpsUrl(env.OIDC_ISSUER, 'OIDC 发行方');
  assert(!issuerUrl.search, 503, 'authentication_not_configured', 'OIDC 发行方不能包含查询参数');
  const jwksUrl = requiredHttpsUrl(env.OIDC_JWKS_URL, 'OIDC 公钥地址');
  const audience = cleanString(env.OIDC_AUDIENCE || '', 'OIDC 受众', { min: 1, max: 255 });
  const keySet = options.jwks || getRemoteJwks(jwksUrl);

  try {
    const { payload, protectedHeader } = await jwtVerify(token, keySet, {
      issuer,
      audience,
      algorithms: ALLOWED_JWT_ALGORITHMS,
      requiredClaims: ['sub', 'iat', 'exp'],
      maxTokenAge: '1h',
      clockTolerance: 5
    });
    assert(ALLOWED_JWT_ALGORITHMS.includes(protectedHeader.alg), 401, 'invalid_token', '登录凭证不正确');
    if (protectedHeader.typ !== undefined) {
      assert(['jwt', 'at+jwt'].includes(String(protectedHeader.typ).toLowerCase()), 401, 'invalid_token', '登录凭证类型不正确');
    }
    const subject = cleanString(payload.sub, '用户标识', { min: 1, max: 512 });
    const email = payload.email_verified === true && typeof payload.email === 'string'
      ? cleanString(payload.email, '邮箱', { max: 254 })
      : null;
    const nameClaim = typeof payload.name === 'string' ? payload.name : payload.preferred_username;
    const displayName = typeof nameClaim === 'string'
      ? cleanString(nameClaim, '名称', { max: 80 })
      : '';
    return {
      provider: `oidc:${issuer}`,
      subject,
      email,
      displayName
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'invalid_token', '登录已失效，请重新登录');
  }
}

async function resolveIdentity(request, env, options) {
  const mode = String(env.AUTH_MODE || 'sites').toLowerCase();
  assert(['sites', 'oidc', 'hybrid'].includes(mode), 503, 'authentication_not_configured', '登录模式配置不正确');
  if (mode === 'oidc') return oidcIdentity(request, env, options);
  if (mode === 'sites') return sitesIdentity(request);
  return (await oidcIdentity(request, env, options)) || sitesIdentity(request);
}

async function ensureUser(db, identity) {
  const subjectHash = await hashSubject(identity.provider, identity.subject);
  const now = new Date().toISOString();
  let user = await db.prepare(
    `SELECT id, email, display_name, locale, created_at
       FROM users
      WHERE identity_provider = ?1 AND identity_subject_hash = ?2`
  ).bind(identity.provider, subjectHash).first();

  if (!user) {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users
        (id, identity_provider, identity_subject_hash, email, display_name, locale, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'zh-CN', ?6, ?6)`
    ).bind(id, identity.provider, subjectHash, identity.email, identity.displayName, now).run();
    user = { id, email: identity.email, display_name: identity.displayName, locale: 'zh-CN', created_at: now };
  }
  return user;
}

export async function requireCurrentUser(request, env, options = {}) {
  const identity = await resolveIdentity(request, env, options);
  if (!identity) throw new ApiError(401, 'authentication_required', '请先登录');
  return ensureUser(env.DB, identity);
}
