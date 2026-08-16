export function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function audit(db, {
  actorUserId,
  action,
  resourceType,
  resourceId,
  organizationId = null,
  metadata = {}
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO audit_logs
      (id, actor_user_id, action, resource_type, resource_id, organization_id, metadata_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(id, actorUserId, action, resourceType, resourceId, organizationId, JSON.stringify(metadata), now).run();
}
