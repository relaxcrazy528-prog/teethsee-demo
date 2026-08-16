import { ApiError } from './errors.mjs';

const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
});

export function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean));
}

export function assertAllowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  if (!allowedOrigins(env).has(origin)) {
    throw new ApiError(403, 'origin_not_allowed', '请求来源不受信任');
  }
  return origin;
}

function responseHeaders(request, env, extras = {}) {
  const headers = new Headers({ ...SECURITY_HEADERS, ...extras });
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins(env).has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
}

export function json(request, env, body, status = 200, extras = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, env, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extras
    })
  });
}

export function empty(request, env, status = 204) {
  return new Response(null, { status, headers: responseHeaders(request, env, { 'cache-control': 'no-store' }) });
}

export function binary(request, env, body, mediaType, etag) {
  return new Response(body, {
    headers: responseHeaders(request, env, {
      'content-type': mediaType,
      'cache-control': 'private, no-store',
      'content-disposition': 'inline',
      ...(etag ? { etag } : {})
    })
  });
}

export function preflight(request, env) {
  assertAllowedOrigin(request, env);
  return new Response(null, {
    status: 204,
    headers: responseHeaders(request, env, {
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization, x-captured-at, x-tooth-code',
      'access-control-max-age': '600'
    })
  });
}

export function errorResponse(request, env, error, requestId) {
  const known = error instanceof ApiError;
  const status = known ? error.status : 500;
  const code = known ? error.code : 'internal_error';
  const message = known ? error.message : '服务暂时不可用';
  return json(request, env, { error: { code, message, request_id: requestId } }, status);
}
