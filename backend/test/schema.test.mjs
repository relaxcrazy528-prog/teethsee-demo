import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const schemaUrl = new URL('../migrations/0001_initial.sql', import.meta.url);
const schema = readFileSync(schemaUrl, 'utf8');

function sqlite(script) {
  return spawnSync('sqlite3', [':memory:'], { input: `${schema}\n${script}`, encoding: 'utf8' });
}

test('migration creates the complete persistence model', () => {
  const result = sqlite(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `);
  assert.equal(result.status, 0, result.stderr);
  const names = result.stdout.trim().split('\n');
  assert.deepEqual(names, [
    'audit_logs', 'events', 'hospital_imports', 'messages', 'organization_memberships',
    'organizations', 'photos', 'profile_shares', 'profiles', 'teeth', 'users'
  ]);
});

test('database enforces one FDI position per profile', () => {
  const result = sqlite(`
    INSERT INTO users (id, identity_provider, identity_subject_hash, created_at, updated_at)
    VALUES ('user-1', 'test', 'subject-1', '2026-08-16T00:00:00Z', '2026-08-16T00:00:00Z');
    INSERT INTO profiles (id, owner_user_id, name, created_at, updated_at)
    VALUES ('profile-1', 'user-1', 'Zoe', '2026-08-16T00:00:00Z', '2026-08-16T00:00:00Z');
    INSERT INTO teeth (id, profile_id, fdi_code, updated_at)
    VALUES ('tooth-1', 'profile-1', '11', '2026-08-16T00:00:00Z');
    INSERT INTO teeth (id, profile_id, fdi_code, updated_at)
    VALUES ('tooth-2', 'profile-1', '11', '2026-08-16T00:00:00Z');
  `);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UNIQUE constraint failed/);
});

test('database rejects public-style photo metadata without a valid owner chain', () => {
  const result = sqlite(`
    INSERT INTO photos
      (id, profile_id, event_id, uploaded_by_user_id, storage_key, media_type, byte_size,
       width, height, sha256, captured_at, created_at)
    VALUES
      ('photo-1', 'missing-profile', 'missing-event', 'missing-user', 'public/photo.png',
       'image/png', 100, 10, 10, 'abc', '2026-08-16T00:00:00Z', '2026-08-16T00:00:00Z');
  `);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FOREIGN KEY constraint failed/);
});
