import { ApiError } from './errors.mjs';

const LEVELS = Object.freeze({ none: 0, view: 1, consult: 2, edit: 3, owner: 4 });

export function permissionAllows(actual, required) {
  return (LEVELS[actual] || 0) >= (LEVELS[required] || Number.POSITIVE_INFINITY);
}

export async function getProfileAccess(db, userId, profileId) {
  const now = new Date().toISOString();
  const result = await db.prepare(
    `SELECT
       CASE
         WHEN p.owner_user_id = ?1 THEN 'owner'
         WHEN MAX(CASE WHEN om.user_id IS NULL THEN 0 WHEN ps.permission = 'edit' THEN 3 WHEN ps.permission = 'consult' THEN 2 WHEN ps.permission = 'view' THEN 1 ELSE 0 END) = 3 THEN 'edit'
         WHEN MAX(CASE WHEN om.user_id IS NULL THEN 0 WHEN ps.permission = 'edit' THEN 3 WHEN ps.permission = 'consult' THEN 2 WHEN ps.permission = 'view' THEN 1 ELSE 0 END) = 2 THEN 'consult'
         WHEN MAX(CASE WHEN om.user_id IS NULL THEN 0 WHEN ps.permission = 'edit' THEN 3 WHEN ps.permission = 'consult' THEN 2 WHEN ps.permission = 'view' THEN 1 ELSE 0 END) = 1 THEN 'view'
         ELSE 'none'
       END AS access_level
     FROM profiles p
     LEFT JOIN profile_shares ps
       ON ps.profile_id = p.id
      AND ps.revoked_at IS NULL
      AND (ps.expires_at IS NULL OR ps.expires_at > ?3)
     LEFT JOIN organization_memberships om
       ON om.organization_id = ps.organization_id
      AND om.user_id = ?1
      AND om.status = 'active'
     WHERE p.id = ?2
     GROUP BY p.id, p.owner_user_id`
  ).bind(userId, profileId, now).first();

  if (!result) throw new ApiError(404, 'profile_not_found', '未找到该牙齿档案');
  return result.access_level || 'none';
}

export async function requireProfileAccess(db, userId, profileId, required = 'view') {
  const actual = await getProfileAccess(db, userId, profileId);
  if (!permissionAllows(actual, required)) {
    // Do not reveal whether another user's profile exists.
    throw new ApiError(404, 'profile_not_found', '未找到该牙齿档案');
  }
  return actual;
}

export async function requireEventAccess(db, userId, eventId, required = 'view') {
  const event = await db.prepare(
    `SELECT id, profile_id, tooth_id, event_type, source, title, note, occurred_at, created_at
       FROM events WHERE id = ?1`
  ).bind(eventId).first();
  if (!event) throw new ApiError(404, 'event_not_found', '未找到该记录');
  await requireProfileAccess(db, userId, event.profile_id, required);
  return event;
}

export async function requirePhotoAccess(db, userId, photoId, required = 'view') {
  const photo = await db.prepare(
    `SELECT id, profile_id, event_id, tooth_id, storage_key, media_type, byte_size,
            width, height, sha256, captured_at, created_at, deleted_at
       FROM photos WHERE id = ?1 AND deleted_at IS NULL`
  ).bind(photoId).first();
  if (!photo) throw new ApiError(404, 'photo_not_found', '未找到该照片');
  await requireProfileAccess(db, userId, photo.profile_id, required);
  return photo;
}

export async function requireOrganizationRole(db, userId, organizationId, allowedRoles) {
  const membership = await db.prepare(
    `SELECT role FROM organization_memberships
      WHERE organization_id = ?1 AND user_id = ?2 AND status = 'active'`
  ).bind(organizationId, userId).first();
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new ApiError(403, 'organization_access_denied', '没有该机构的操作权限');
  }
  return membership.role;
}

export async function requireOrganizationProfilePermission(db, userId, organizationId, profileId, required) {
  const now = new Date().toISOString();
  const row = await db.prepare(
    `SELECT ps.permission
       FROM profile_shares ps
       JOIN organization_memberships om
         ON om.organization_id = ps.organization_id
        AND om.user_id = ?1
        AND om.status = 'active'
      WHERE ps.organization_id = ?2
        AND ps.profile_id = ?3
        AND ps.revoked_at IS NULL
        AND (ps.expires_at IS NULL OR ps.expires_at > ?4)`
  ).bind(userId, organizationId, profileId, now).first();
  if (!row || !permissionAllows(row.permission, required)) {
    throw new ApiError(404, 'profile_not_found', '未找到该牙齿档案');
  }
  return row.permission;
}
