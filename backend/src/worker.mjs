import { requireCurrentUser } from './auth.mjs';
import { audit, rows } from './db.mjs';
import { ApiError, assert } from './errors.mjs';
import { binary, empty, errorResponse, json, preflight, assertAllowedOrigin } from './http.mjs';
import { imageStorageKey, readSafePng, sha256Hex } from './image.mjs';
import {
  getProfileAccess,
  requireEventAccess,
  requireOrganizationProfilePermission,
  requireOrganizationRole,
  requirePhotoAccess,
  requireProfileAccess
} from './policy.mjs';
import {
  EVENT_SOURCES,
  EVENT_TYPES,
  allPermanentFdiCodes,
  cleanFdiCode,
  cleanInteger,
  cleanString,
  cleanTimestamp,
  readJson
} from './validation.mjs';

const API_VERSION = '0.1.0';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nowIso() {
  return new Date().toISOString();
}

function routeId(value, label = '资源') {
  assert(UUID_PATTERN.test(value || ''), 404, 'not_found', `未找到该${label}`);
  return value;
}

function pathParts(url) {
  return new URL(url).pathname.split('/').filter(Boolean);
}

function auditStatement(db, actorUserId, action, resourceType, resourceId, organizationId = null, metadata = {}) {
  return db.prepare(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, resource_type, resource_id, organization_id, metadata_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    crypto.randomUUID(), actorUserId, action, resourceType, resourceId,
    organizationId, JSON.stringify(metadata), nowIso()
  );
}

async function updateMe(request, env, user) {
  const body = await readJson(request);
  const displayName = cleanString(body.display_name ?? user.display_name, '名称', { max: 80 });
  const locale = cleanString(body.locale ?? user.locale, '语言', { min: 2, max: 16 });
  assert(['zh-CN', 'en-US'].includes(locale), 400, 'invalid_locale', '暂时仅支持中文或英文');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET display_name = ?1, locale = ?2, updated_at = ?3 WHERE id = ?4')
      .bind(displayName, locale, now, user.id),
    auditStatement(env.DB, user.id, 'user.update', 'user', user.id)
  ]);
  return json(request, env, { user: { ...user, display_name: displayName, locale } });
}

async function listProfiles(request, env, user) {
  const result = await env.DB.prepare(
    `SELECT p.id, p.name, p.birth_year, p.reminder_interval_hours, p.last_cleaned_at,
            p.created_at, p.updated_at,
            CASE WHEN p.owner_user_id = ?1 THEN 'owner'
                 WHEN MAX(CASE ps.permission WHEN 'edit' THEN 3 WHEN 'consult' THEN 2 WHEN 'view' THEN 1 ELSE 0 END) = 3 THEN 'edit'
                 WHEN MAX(CASE ps.permission WHEN 'edit' THEN 3 WHEN 'consult' THEN 2 WHEN 'view' THEN 1 ELSE 0 END) = 2 THEN 'consult'
                 ELSE 'view' END AS access_level
       FROM profiles p
       LEFT JOIN profile_shares ps ON ps.profile_id = p.id
        AND ps.revoked_at IS NULL
        AND (ps.expires_at IS NULL OR ps.expires_at > ?2)
       LEFT JOIN organization_memberships om ON om.organization_id = ps.organization_id
        AND om.user_id = ?1 AND om.status = 'active'
      WHERE p.owner_user_id = ?1 OR om.user_id = ?1
      GROUP BY p.id
      ORDER BY p.updated_at DESC`
  ).bind(user.id, nowIso()).all();
  return json(request, env, { profiles: rows(result) });
}

async function createProfile(request, env, user) {
  const body = await readJson(request);
  const id = crypto.randomUUID();
  const name = cleanString(body.name, '档案名称', { min: 1, max: 60 });
  const birthYear = cleanInteger(body.birth_year, '出生年份', { min: 1900, max: new Date().getUTCFullYear(), optional: true });
  const reminderHours = cleanInteger(body.reminder_interval_hours ?? 24, '清洁提醒间隔', { min: 1, max: 720 });
  const now = nowIso();
  const statements = [
    env.DB.prepare(
      `INSERT INTO profiles
        (id, owner_user_id, name, birth_year, reminder_interval_hours, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`
    ).bind(id, user.id, name, birthYear ?? null, reminderHours, now),
    ...allPermanentFdiCodes().map((code) => env.DB.prepare(
      `INSERT INTO teeth (id, profile_id, fdi_code, updated_at) VALUES (?1, ?2, ?3, ?4)`
    ).bind(crypto.randomUUID(), id, code, now)),
    auditStatement(env.DB, user.id, 'profile.create', 'profile', id)
  ];
  await env.DB.batch(statements);
  return json(request, env, {
    profile: { id, name, birth_year: birthYear ?? null, reminder_interval_hours: reminderHours, last_cleaned_at: null, created_at: now }
  }, 201);
}

async function getProfile(request, env, user, profileId) {
  const accessLevel = await requireProfileAccess(env.DB, user.id, profileId, 'view');
  const profile = await env.DB.prepare(
    `SELECT id, name, birth_year, reminder_interval_hours, last_cleaned_at, created_at, updated_at
       FROM profiles WHERE id = ?1`
  ).bind(profileId).first();
  const teethResult = await env.DB.prepare(
    `SELECT id, fdi_code, nickname, note, updated_at FROM teeth
      WHERE profile_id = ?1 ORDER BY fdi_code`
  ).bind(profileId).all();
  return json(request, env, { profile: { ...profile, access_level: accessLevel, teeth: rows(teethResult) } });
}

async function updateTooth(request, env, user, profileId, fdiCode) {
  await requireProfileAccess(env.DB, user.id, profileId, 'edit');
  const body = await readJson(request);
  const nickname = cleanString(body.nickname ?? '', '牙齿名称', { max: 40 });
  const note = cleanString(body.note ?? '', '牙齿备注', { max: 2000 });
  const now = nowIso();
  const tooth = await env.DB.prepare('SELECT id FROM teeth WHERE profile_id = ?1 AND fdi_code = ?2')
    .bind(profileId, fdiCode).first();
  if (!tooth) throw new ApiError(404, 'tooth_not_found', '未找到该牙位');
  await env.DB.batch([
    env.DB.prepare('UPDATE teeth SET nickname = ?1, note = ?2, updated_at = ?3 WHERE id = ?4')
      .bind(nickname, note, now, tooth.id),
    auditStatement(env.DB, user.id, 'tooth.update', 'tooth', tooth.id, null, { profile_id: profileId, fdi_code: fdiCode })
  ]);
  return json(request, env, { tooth: { id: tooth.id, fdi_code: fdiCode, nickname, note, updated_at: now } });
}

async function resolveEventSource(env, user, profileId, accessLevel, requestedSource, organizationId) {
  assert(EVENT_SOURCES.has(requestedSource), 400, 'invalid_source', '记录来源不正确');
  if (accessLevel === 'owner') {
    assert(['user', 'device'].includes(requestedSource), 403, 'invalid_source', '用户只能创建个人或设备记录');
    return { source: requestedSource, organizationId: null };
  }
  assert(organizationId, 400, 'organization_required', '医师记录必须关联机构');
  const role = await requireOrganizationRole(env.DB, user.id, organizationId, ['dentist', 'assistant', 'hospital_admin']);
  const source = role === 'dentist' ? 'dentist' : 'hospital';
  assert(requestedSource === source, 403, 'invalid_source', '记录来源与账号角色不一致');
  await requireOrganizationProfilePermission(env.DB, user.id, organizationId, profileId, 'consult');
  return { source, organizationId };
}

async function createEvent(request, env, user, profileId) {
  const accessLevel = await getProfileAccess(env.DB, user.id, profileId);
  assert(accessLevel !== 'none', 404, 'profile_not_found', '未找到该牙齿档案');
  const body = await readJson(request);
  const eventType = cleanString(body.event_type, '记录类型', { min: 1, max: 30 });
  assert(EVENT_TYPES.has(eventType), 400, 'invalid_event_type', '记录类型不正确');
  const requestedSource = cleanString(body.source, '记录来源', { min: 1, max: 20 });
  const organizationId = body.organization_id ? routeId(body.organization_id, '机构') : null;
  const sourceContext = await resolveEventSource(env, user, profileId, accessLevel, requestedSource, organizationId);
  const title = cleanString(body.title, '标题', { min: 1, max: 120 });
  const note = cleanString(body.note ?? '', '备注', { max: 4000 });
  const occurredAt = cleanTimestamp(body.occurred_at ?? nowIso(), '发生时间');
  const toothCode = cleanFdiCode(body.tooth_code, true);
  let toothId = null;
  if (toothCode) {
    const tooth = await env.DB.prepare('SELECT id FROM teeth WHERE profile_id = ?1 AND fdi_code = ?2')
      .bind(profileId, toothCode).first();
    if (!tooth) throw new ApiError(404, 'tooth_not_found', '未找到该牙位');
    toothId = tooth.id;
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  const statements = [
    env.DB.prepare(
      `INSERT INTO events
        (id, profile_id, tooth_id, created_by_user_id, event_type, source, title, note, occurred_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`
    ).bind(id, profileId, toothId, user.id, eventType, sourceContext.source, title, note, occurredAt, now),
    auditStatement(env.DB, user.id, 'event.create', 'event', id, sourceContext.organizationId, { profile_id: profileId, event_type: eventType })
  ];
  if (eventType === 'cleaning') {
    statements.push(env.DB.prepare('UPDATE profiles SET last_cleaned_at = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(occurredAt, now, profileId));
  }
  await env.DB.batch(statements);
  return json(request, env, {
    event: { id, profile_id: profileId, tooth_id: toothId, tooth_code: toothCode ?? null, event_type: eventType, source: sourceContext.source, title, note, occurred_at: occurredAt, created_at: now }
  }, 201);
}

async function listTimeline(request, env, user, profileId) {
  await requireProfileAccess(env.DB, user.id, profileId, 'view');
  const url = new URL(request.url);
  const before = cleanTimestamp(url.searchParams.get('before'), '时间游标', true) ?? '9999-12-31T23:59:59.999Z';
  const limitInput = Number(url.searchParams.get('limit') || 50);
  const limit = Number.isInteger(limitInput) ? Math.min(Math.max(limitInput, 1), 100) : 50;
  const toothCode = cleanFdiCode(url.searchParams.get('tooth'), true);
  const eventType = url.searchParams.get('type');
  if (eventType) assert(EVENT_TYPES.has(eventType), 400, 'invalid_event_type', '记录类型不正确');

  let sql = `SELECT e.id, e.event_type, e.source, e.title, e.note, e.occurred_at, e.created_at,
                    t.fdi_code AS tooth_code,
                    (SELECT COUNT(*) FROM photos ph WHERE ph.event_id = e.id AND ph.deleted_at IS NULL) AS photo_count
               FROM events e
               LEFT JOIN teeth t ON t.id = e.tooth_id
              WHERE e.profile_id = ?1 AND e.occurred_at < ?2`;
  const bindings = [profileId, before];
  if (toothCode) {
    sql += ` AND t.fdi_code = ?${bindings.length + 1}`;
    bindings.push(toothCode);
  }
  if (eventType) {
    sql += ` AND e.event_type = ?${bindings.length + 1}`;
    bindings.push(eventType);
  }
  sql += ` ORDER BY e.occurred_at DESC, e.id DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);
  const result = await env.DB.prepare(sql).bind(...bindings).all();
  const events = rows(result);
  return json(request, env, { events, next_before: events.length === limit ? events.at(-1).occurred_at : null });
}

async function getEvent(request, env, user, eventId) {
  const event = await requireEventAccess(env.DB, user.id, eventId, 'view');
  const photosResult = await env.DB.prepare(
    `SELECT p.id, p.tooth_id, p.media_type, p.byte_size, p.width, p.height, p.captured_at, p.created_at,
            t.fdi_code AS tooth_code
       FROM photos p LEFT JOIN teeth t ON t.id = p.tooth_id
      WHERE p.event_id = ?1 AND p.deleted_at IS NULL ORDER BY p.captured_at DESC`
  ).bind(eventId).all();
  return json(request, env, { event: { ...event, photos: rows(photosResult) } });
}

async function uploadPhoto(request, env, user, eventId) {
  const event = await requireEventAccess(env.DB, user.id, eventId, 'edit');
  const image = await readSafePng(request);
  const toothCode = cleanFdiCode(request.headers.get('x-tooth-code'), true);
  const capturedAt = cleanTimestamp(request.headers.get('x-captured-at') || nowIso(), '拍摄时间');
  let toothId = event.tooth_id || null;
  if (toothCode) {
    const tooth = await env.DB.prepare('SELECT id FROM teeth WHERE profile_id = ?1 AND fdi_code = ?2')
      .bind(event.profile_id, toothCode).first();
    if (!tooth) throw new ApiError(404, 'tooth_not_found', '未找到该牙位');
    toothId = tooth.id;
  }
  const id = crypto.randomUUID();
  const storageKey = imageStorageKey(user.id, id);
  const digest = await sha256Hex(image.buffer);
  const now = nowIso();

  await env.PHOTOS.put(storageKey, image.buffer, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' },
    customMetadata: { photoId: id, profileId: event.profile_id }
  });
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO photos
          (id, profile_id, event_id, tooth_id, uploaded_by_user_id, storage_key, media_type, byte_size,
           width, height, sha256, captured_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'image/png', ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind(id, event.profile_id, eventId, toothId, user.id, storageKey, image.byteSize, image.width, image.height, digest, capturedAt, now),
      auditStatement(env.DB, user.id, 'photo.create', 'photo', id, null, { profile_id: event.profile_id, event_id: eventId })
    ]);
  } catch (error) {
    await env.PHOTOS.delete(storageKey);
    throw error;
  }
  return json(request, env, {
    photo: { id, event_id: eventId, tooth_id: toothId, media_type: 'image/png', byte_size: image.byteSize, width: image.width, height: image.height, captured_at: capturedAt, created_at: now }
  }, 201);
}

async function getPhoto(request, env, user, photoId) {
  const photo = await requirePhotoAccess(env.DB, user.id, photoId, 'view');
  const object = await env.PHOTOS.get(photo.storage_key);
  if (!object) throw new ApiError(404, 'photo_not_found', '照片文件不存在');
  return binary(request, env, object.body, photo.media_type, object.httpEtag);
}

async function deletePhoto(request, env, user, photoId) {
  const photo = await requirePhotoAccess(env.DB, user.id, photoId, 'edit');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE photos SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL').bind(now, photoId),
    auditStatement(env.DB, user.id, 'photo.soft_delete', 'photo', photoId, null, { profile_id: photo.profile_id })
  ]);
  return empty(request, env);
}

async function listMessages(request, env, user, profileId) {
  await requireProfileAccess(env.DB, user.id, profileId, 'view');
  const result = await env.DB.prepare(
    `SELECT m.id, m.event_id, m.sender_user_id, m.organization_id, m.body, m.created_at,
            u.display_name AS sender_name
       FROM messages m JOIN users u ON u.id = m.sender_user_id
      WHERE m.profile_id = ?1 AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC LIMIT 100`
  ).bind(profileId).all();
  return json(request, env, { messages: rows(result) });
}

async function createMessage(request, env, user, profileId) {
  const accessLevel = await getProfileAccess(env.DB, user.id, profileId);
  assert(accessLevel !== 'none' && accessLevel !== 'view', 404, 'profile_not_found', '未找到可咨询的牙齿档案');
  const body = await readJson(request);
  const messageBody = cleanString(body.body, '消息', { min: 1, max: 4000 });
  const eventId = body.event_id ? routeId(body.event_id, '记录') : null;
  if (eventId) {
    const event = await requireEventAccess(env.DB, user.id, eventId, 'view');
    assert(event.profile_id === profileId, 400, 'event_profile_mismatch', '记录不属于该档案');
  }
  let organizationId = null;
  if (accessLevel !== 'owner') {
    organizationId = routeId(body.organization_id, '机构');
    await requireOrganizationRole(env.DB, user.id, organizationId, ['dentist', 'assistant', 'hospital_admin']);
    await requireOrganizationProfilePermission(env.DB, user.id, organizationId, profileId, 'consult');
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO messages
        (id, profile_id, event_id, sender_user_id, organization_id, body, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    ).bind(id, profileId, eventId, user.id, organizationId, messageBody, now),
    auditStatement(env.DB, user.id, 'message.create', 'message', id, organizationId, { profile_id: profileId })
  ]);
  return json(request, env, { message: { id, profile_id: profileId, event_id: eventId, organization_id: organizationId, body: messageBody, created_at: now } }, 201);
}

async function shareProfile(request, env, user, profileId) {
  const access = await getProfileAccess(env.DB, user.id, profileId);
  assert(access === 'owner', 404, 'profile_not_found', '只有档案所有者可以授权');
  const body = await readJson(request);
  const organizationId = routeId(body.organization_id, '机构');
  const permission = cleanString(body.permission, '权限', { min: 1, max: 16 });
  assert(['view', 'consult', 'edit'].includes(permission), 400, 'invalid_permission', '授权范围不正确');
  const expiresAt = cleanTimestamp(body.expires_at, '到期时间', true);
  if (expiresAt) assert(expiresAt > nowIso(), 400, 'invalid_expiry', '到期时间必须晚于当前时间');
  const organization = await env.DB.prepare("SELECT id FROM organizations WHERE id = ?1 AND status = 'active'")
    .bind(organizationId).first();
  if (!organization) throw new ApiError(404, 'organization_not_found', '未找到可授权的机构');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO profile_shares
        (profile_id, organization_id, permission, granted_by_user_id, expires_at, created_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
       ON CONFLICT(profile_id, organization_id) DO UPDATE SET
         permission = excluded.permission, granted_by_user_id = excluded.granted_by_user_id,
         expires_at = excluded.expires_at, created_at = excluded.created_at, revoked_at = NULL`
    ).bind(profileId, organizationId, permission, user.id, expiresAt ?? null, now),
    auditStatement(env.DB, user.id, 'profile.share', 'profile', profileId, organizationId, { permission, expires_at: expiresAt ?? null })
  ]);
  return json(request, env, { share: { profile_id: profileId, organization_id: organizationId, permission, expires_at: expiresAt ?? null } });
}

async function revokeProfileShare(request, env, user, profileId, organizationId) {
  const access = await getProfileAccess(env.DB, user.id, profileId);
  assert(access === 'owner', 404, 'profile_not_found', '只有档案所有者可以撤销授权');
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE profile_shares SET revoked_at = ?1 WHERE profile_id = ?2 AND organization_id = ?3')
      .bind(now, profileId, organizationId),
    auditStatement(env.DB, user.id, 'profile.share_revoke', 'profile', profileId, organizationId)
  ]);
  return empty(request, env);
}

async function listOrganizations(request, env, user) {
  const result = await env.DB.prepare(
    `SELECT o.id, o.name, o.external_code, o.status, om.role
       FROM organization_memberships om JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = ?1 AND om.status = 'active' ORDER BY o.name`
  ).bind(user.id).all();
  return json(request, env, { organizations: rows(result) });
}

async function importHospitalRecord(request, env, user, organizationId) {
  await requireOrganizationRole(env.DB, user.id, organizationId, ['dentist', 'hospital_admin', 'integration']);
  const body = await readJson(request);
  const profileId = routeId(body.profile_id, '档案');
  await requireOrganizationProfilePermission(env.DB, user.id, organizationId, profileId, 'edit');
  const externalSystem = cleanString(body.external_system, '来源系统', { min: 1, max: 80 });
  const externalRecordId = cleanString(body.external_record_id, '外部记录编号', { min: 1, max: 120 });
  const recordType = cleanString(body.record_type, '记录类型', { min: 1, max: 80 });
  const occurredAt = cleanTimestamp(body.occurred_at, '发生时间');
  assert(body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload), 400, 'invalid_payload', '医院记录内容不正确');
  const payloadJson = JSON.stringify(body.payload);
  assert(new TextEncoder().encode(payloadJson).byteLength <= 48 * 1024, 413, 'payload_too_large', '医院记录内容过大');
  const sourceHash = await sha256Hex(new TextEncoder().encode(payloadJson));
  const existing = await env.DB.prepare(
    `SELECT id FROM hospital_imports
      WHERE organization_id = ?1 AND external_system = ?2 AND external_record_id = ?3`
  ).bind(organizationId, externalSystem, externalRecordId).first();
  if (existing) return json(request, env, { import: { id: existing.id, duplicate: true } });

  const importId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const title = cleanString(body.title ?? recordType, '标题', { min: 1, max: 120 });
  const now = nowIso();
  try {
    await env.DB.batch([
      env.DB.prepare(
      `INSERT INTO hospital_imports
        (id, organization_id, profile_id, imported_by_user_id, external_system, external_record_id,
         record_type, occurred_at, payload_json, source_sha256, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(importId, organizationId, profileId, user.id, externalSystem, externalRecordId, recordType, occurredAt, payloadJson, sourceHash, now),
    env.DB.prepare(
      `INSERT INTO events
        (id, profile_id, created_by_user_id, event_type, source, title, note, occurred_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'hospital_import', 'hospital', ?4, '', ?5, ?6, ?6)`
    ).bind(eventId, profileId, user.id, title, occurredAt, now),
      auditStatement(env.DB, user.id, 'hospital.import', 'hospital_import', importId, organizationId, { profile_id: profileId, event_id: eventId })
    ]);
  } catch (error) {
    const duplicate = await env.DB.prepare(
      `SELECT id FROM hospital_imports
        WHERE organization_id = ?1 AND external_system = ?2 AND external_record_id = ?3`
    ).bind(organizationId, externalSystem, externalRecordId).first();
    if (duplicate) return json(request, env, { import: { id: duplicate.id, duplicate: true } });
    throw error;
  }
  return json(request, env, { import: { id: importId, event_id: eventId, duplicate: false } }, 201);
}

async function routeAuthenticated(request, env, user, parts) {
  const method = request.method;
  if (parts.length === 2 && parts[1] === 'me') {
    if (method === 'GET') return json(request, env, { user });
    if (method === 'PATCH') return updateMe(request, env, user);
  }
  if (parts.length === 2 && parts[1] === 'profiles') {
    if (method === 'GET') return listProfiles(request, env, user);
    if (method === 'POST') return createProfile(request, env, user);
  }
  if (parts[1] === 'profiles' && parts[2]) {
    const profileId = routeId(parts[2], '档案');
    if (parts.length === 3 && method === 'GET') return getProfile(request, env, user, profileId);
    if (parts.length === 4 && parts[3] === 'timeline' && method === 'GET') return listTimeline(request, env, user, profileId);
    if (parts.length === 5 && parts[3] === 'teeth' && method === 'PUT') {
      return updateTooth(request, env, user, profileId, cleanFdiCode(parts[4]));
    }
    if (parts.length === 4 && parts[3] === 'events' && method === 'POST') return createEvent(request, env, user, profileId);
    if (parts.length === 4 && parts[3] === 'messages') {
      if (method === 'GET') return listMessages(request, env, user, profileId);
      if (method === 'POST') return createMessage(request, env, user, profileId);
    }
    if (parts.length === 4 && parts[3] === 'shares' && method === 'POST') return shareProfile(request, env, user, profileId);
    if (parts.length === 5 && parts[3] === 'shares' && method === 'DELETE') {
      return revokeProfileShare(request, env, user, profileId, routeId(parts[4], '机构'));
    }
  }
  if (parts[1] === 'events' && parts[2]) {
    const eventId = routeId(parts[2], '记录');
    if (parts.length === 3 && method === 'GET') return getEvent(request, env, user, eventId);
    if (parts.length === 4 && parts[3] === 'photos' && method === 'POST') return uploadPhoto(request, env, user, eventId);
  }
  if (parts[1] === 'photos' && parts[2] && parts.length === 3) {
    const photoId = routeId(parts[2], '照片');
    if (method === 'GET') return getPhoto(request, env, user, photoId);
    if (method === 'DELETE') return deletePhoto(request, env, user, photoId);
  }
  if (parts.length === 2 && parts[1] === 'organizations' && method === 'GET') {
    return listOrganizations(request, env, user);
  }
  if (parts.length === 4 && parts[1] === 'organizations' && parts[3] === 'imports' && method === 'POST') {
    return importHospitalRecord(request, env, user, routeId(parts[2], '机构'));
  }
  throw new ApiError(404, 'not_found', '接口不存在');
}

export async function handleRequest(request, env) {
  const requestId = crypto.randomUUID();
  try {
    assert(env.DB && env.PHOTOS, 503, 'service_not_configured', '数据服务尚未配置');
    if (request.method === 'OPTIONS') return preflight(request, env);
    assertAllowedOrigin(request, env);
    const parts = pathParts(request.url);
    if (parts.length === 1 && parts[0] === 'health' && request.method === 'GET') {
      return json(request, env, { status: 'ok', service: 'teethsee-backend', version: API_VERSION });
    }
    assert(parts[0] === 'v1', 404, 'not_found', '接口不存在');
    const user = await requireCurrentUser(request, env.DB);
    return await routeAuthenticated(request, env, user, parts);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error(JSON.stringify({ request_id: requestId, error: error?.name || 'Error' }));
    }
    return errorResponse(request, env, error, requestId);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
