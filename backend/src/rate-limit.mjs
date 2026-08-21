import { ApiError } from './errors.mjs';

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function rateLimitRules(request) {
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname;
  if (method === 'GET') return [{ scope: 'read:account', limit: 600, seconds: 300 }];
  const rules = [
    { scope: 'write:account', limit: 120, seconds: 60 },
    { scope: 'write:ip', limit: 300, seconds: 60 }
  ];
  if (/\/events\/[^/]+\/photos$/.test(path) && method === 'POST') {
    rules.push(
      { scope: 'photo:account', limit: 12, seconds: 60 },
      { scope: 'photo:daily', limit: 200, seconds: 86_400 }
    );
  } else if (/\/messages$/.test(path) && method === 'POST') {
    rules.push({ scope: 'message:account', limit: 30, seconds: 60 });
  } else if (/\/organizations\/[^/]+\/imports$/.test(path) && method === 'POST') {
    rules.push({ scope: 'hospital_import:account', limit: 60, seconds: 60 });
  }
  return rules;
}

async function consume(db, scope, rawKey, limit, seconds, timestamp) {
  const windowStart = Math.floor(timestamp / (seconds * 1000)) * seconds * 1000;
  const keyHash = await sha256(`${scope}:${rawKey}`);
  const now = new Date(timestamp).toISOString();
  await db.prepare(
    `INSERT INTO rate_limit_counters (scope, key_hash, window_start, request_count, updated_at)
     VALUES (?1, ?2, ?3, 1, ?4)
     ON CONFLICT(scope, key_hash, window_start) DO UPDATE SET
       request_count = request_count + 1, updated_at = excluded.updated_at`
  ).bind(scope, keyHash, windowStart, now).run();
  const row = await db.prepare(
    `SELECT request_count FROM rate_limit_counters
      WHERE scope = ?1 AND key_hash = ?2 AND window_start = ?3`
  ).bind(scope, keyHash, windowStart).first();
  if ((row?.request_count || 0) > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + seconds * 1000 - timestamp) / 1000));
    throw new ApiError(429, 'rate_limit_exceeded', '操作过于频繁，请稍后再试', { retryAfter });
  }
}

export async function enforceRateLimits(request, env, user, timestamp = Date.now()) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  for (const rule of rateLimitRules(request)) {
    const key = rule.scope.endsWith(':ip') ? ip : user.id;
    await consume(env.DB, rule.scope, key, rule.limit, rule.seconds, timestamp);
  }
}
