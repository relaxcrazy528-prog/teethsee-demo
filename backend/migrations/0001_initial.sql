PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  identity_provider TEXT NOT NULL,
  identity_subject_hash TEXT NOT NULL,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(identity_provider, identity_subject_hash)
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  birth_year INTEGER,
  reminder_interval_hours INTEGER NOT NULL DEFAULT 24 CHECK(reminder_interval_hours BETWEEN 1 AND 720),
  last_cleaned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_profiles_owner ON profiles(owner_user_id);

CREATE TABLE teeth (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fdi_code TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(profile_id, fdi_code)
);

CREATE INDEX idx_teeth_profile ON teeth(profile_id);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tooth_id TEXT REFERENCES teeth(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('capture','cleaning','consultation','visit','treatment','follow_up','note','hospital_import')),
  source TEXT NOT NULL CHECK(source IN ('user','device','dentist','hospital','system')),
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_events_profile_time ON events(profile_id, occurred_at DESC);
CREATE INDEX idx_events_tooth_time ON events(tooth_id, occurred_at DESC);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tooth_id TEXT REFERENCES teeth(id),
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK(media_type = 'image/png'),
  byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 8388608),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 6000),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 6000),
  sha256 TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_photos_profile_time ON photos(profile_id, captured_at DESC);
CREATE INDEX idx_photos_event ON photos(event_id);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  external_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE organization_memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('dentist','assistant','hospital_admin','integration')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','disabled')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(organization_id, user_id)
);

CREATE INDEX idx_memberships_user ON organization_memberships(user_id, status);

CREATE TABLE profile_shares (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK(permission IN ('view','consult','edit')),
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY(profile_id, organization_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT REFERENCES organizations(id),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_messages_profile_time ON messages(profile_id, created_at DESC);

CREATE TABLE hospital_imports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  imported_by_user_id TEXT NOT NULL REFERENCES users(id),
  external_system TEXT NOT NULL,
  external_record_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, external_system, external_record_id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
