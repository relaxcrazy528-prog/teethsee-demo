import { ApiError } from './errors.mjs';
import { cleanString } from './validation.mjs';

async function hashSubject(provider, subject) {
  const bytes = new TextEncoder().encode(`${provider}:${subject}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * These headers are trusted only when this Worker is mounted behind the Sites
 * authenticated runtime. Never expose this Worker directly with client-settable
 * identity headers.
 */
export async function requireCurrentUser(request, db) {
  const subject = request.headers.get('oai-authenticated-user-id');
  if (!subject) {
    throw new ApiError(401, 'authentication_required', '请先登录');
  }

  const provider = 'openai-sites';
  const subjectHash = await hashSubject(provider, subject);
  const now = new Date().toISOString();
  const emailValue = request.headers.get('oai-authenticated-user-email');
  const nameValue = request.headers.get('oai-authenticated-user-name');
  const email = emailValue ? cleanString(emailValue, '邮箱', { max: 254 }) : null;
  const displayName = nameValue ? cleanString(nameValue, '名称', { max: 80 }) : '';

  let user = await db.prepare(
    `SELECT id, email, display_name, locale, created_at
       FROM users
      WHERE identity_provider = ?1 AND identity_subject_hash = ?2`
  ).bind(provider, subjectHash).first();

  if (!user) {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users
        (id, identity_provider, identity_subject_hash, email, display_name, locale, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'zh-CN', ?6, ?6)`
    ).bind(id, provider, subjectHash, email, displayName, now).run();
    user = { id, email, display_name: displayName, locale: 'zh-CN', created_at: now };
  }

  return user;
}
