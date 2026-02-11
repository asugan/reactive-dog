import { getDatabase } from '../database';
import { generateId } from '../id';
import type { DogProfile, LocalExportPayload, TriggerLog, WalkPoint, WalkRecord } from '../types';

const LOCAL_OWNER_ID_KEY = 'local_owner_id';
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

interface DbSettingRow {
  key: string;
  value: string;
}

interface DbDogProfileRow {
  id: string;
  owner_id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  triggers: string;
  reactivity_level: number;
  training_method: string | null;
  created_at: string;
  updated_at: string;
}

interface DbTriggerLogRow {
  id: string;
  dog_id: string;
  owner_id: string;
  trigger_type: string;
  severity: number;
  distance_meters: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
}

interface DbWalkRow {
  id: string;
  dog_id: string;
  owner_id: string;
  distance_threshold_meters: number;
  started_at: string;
  ended_at: string | null;
  success_rating: number | null;
  technique_used: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DbWalkPointRow {
  id: string;
  walk_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  created_at: string;
}

interface ParsedImportPayload {
  dog_profiles: Partial<DogProfile>[];
  trigger_logs: Partial<TriggerLog>[];
  walks: Partial<WalkRecord>[];
  walk_points: Partial<WalkPoint>[];
  app_settings: Record<string, unknown>;
}

const mapDogProfileRow = (row: DbDogProfileRow): DogProfile => {
  let triggers: string[] = [];
  try {
    const parsed = JSON.parse(row.triggers);
    if (Array.isArray(parsed)) {
      triggers = parsed.map((item) => String(item));
    }
  } catch {
    triggers = [];
  }

  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    breed: row.breed,
    age: Number(row.age) || 0,
    weight: Number(row.weight) || 0,
    triggers,
    reactivity_level: Number(row.reactivity_level) || 0,
    training_method: row.training_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const mapTriggerLogRow = (row: DbTriggerLogRow): TriggerLog => {
  return {
    id: row.id,
    dog_id: row.dog_id,
    owner_id: row.owner_id,
    trigger_type: row.trigger_type,
    severity: Number(row.severity) || 0,
    distance_meters: row.distance_meters === null ? null : Number(row.distance_meters),
    location_latitude: row.location_latitude === null ? null : Number(row.location_latitude),
    location_longitude: row.location_longitude === null ? null : Number(row.location_longitude),
    notes: row.notes,
    logged_at: row.logged_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const mapWalkRow = (row: DbWalkRow): WalkRecord => {
  return {
    id: row.id,
    dog_id: row.dog_id,
    owner_id: row.owner_id,
    distance_threshold_meters: Number(row.distance_threshold_meters) || 0,
    started_at: row.started_at,
    ended_at: row.ended_at,
    success_rating: row.success_rating === null ? null : Number(row.success_rating),
    technique_used: row.technique_used,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const mapWalkPointRow = (row: DbWalkPointRow): WalkPoint => {
  return {
    id: row.id,
    walk_id: row.walk_id,
    latitude: Number(row.latitude) || 0,
    longitude: Number(row.longitude) || 0,
    accuracy: row.accuracy === null ? null : Number(row.accuracy),
    captured_at: row.captured_at,
    created_at: row.created_at,
  };
};

const normalizeBooleanString = (value: string | null) => {
  return value === 'true' ? 'true' : 'false';
};

export const getSetting = async (key: string) => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DbSettingRow>('SELECT key, value FROM app_settings WHERE key = ? LIMIT 1', [key]);
  return row?.value ?? null;
};

export const setSetting = async (key: string, value: string) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    [key, value, now]
  );
};

export const getAllSettings = async () => {
  const db = await getDatabase();
  const rows = (await db.getAllAsync<DbSettingRow>('SELECT key, value FROM app_settings ORDER BY key ASC')) as DbSettingRow[];
  return rows.reduce<Record<string, string>>((accumulator: Record<string, string>, row: DbSettingRow) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});
};

export const ensureLocalOwnerId = async () => {
  const existing = await getSetting(LOCAL_OWNER_ID_KEY);
  if (existing) {
    return existing;
  }

  const ownerId = generateId('owner');
  await setSetting(LOCAL_OWNER_ID_KEY, ownerId);
  await setSetting(ONBOARDING_COMPLETE_KEY, 'false');
  return ownerId;
};

export const setOnboardingComplete = async (value: boolean) => {
  await setSetting(ONBOARDING_COMPLETE_KEY, value ? 'true' : 'false');
};

export const isOnboardingComplete = async () => {
  const value = await getSetting(ONBOARDING_COMPLETE_KEY);
  return value === 'true';
};

export const clearAllLocalData = async () => {
  const ownerId = await ensureLocalOwnerId();
  const db = await getDatabase();

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await db.runAsync('DELETE FROM trigger_logs');
    await db.runAsync('DELETE FROM walk_points');
    await db.runAsync('DELETE FROM walks');
    await db.runAsync('DELETE FROM dog_profiles');
    await db.runAsync('DELETE FROM app_settings');

    const now = new Date().toISOString();
    await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      LOCAL_OWNER_ID_KEY,
      ownerId,
      now,
    ]);
    await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      ONBOARDING_COMPLETE_KEY,
      'false',
      now,
    ]);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const exportLocalData = async (): Promise<LocalExportPayload> => {
  const db = await getDatabase();

  const settingsRows = await db.getAllAsync<DbSettingRow>('SELECT key, value FROM app_settings ORDER BY key ASC');
  const dogRows = await db.getAllAsync<DbDogProfileRow>('SELECT * FROM dog_profiles ORDER BY created_at DESC');
  const logRows = await db.getAllAsync<DbTriggerLogRow>('SELECT * FROM trigger_logs ORDER BY logged_at DESC');
  const walkRows = await db.getAllAsync<DbWalkRow>('SELECT * FROM walks ORDER BY started_at DESC');
  const walkPointRows = await db.getAllAsync<DbWalkPointRow>('SELECT * FROM walk_points ORDER BY captured_at ASC');

  const appSettings = (settingsRows as DbSettingRow[]).reduce<Record<string, string>>((accumulator: Record<string, string>, row: DbSettingRow) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    app_settings: appSettings,
    dog_profiles: dogRows.map(mapDogProfileRow),
    trigger_logs: logRows.map(mapTriggerLogRow),
    walks: walkRows.map(mapWalkRow),
    walk_points: walkPointRows.map(mapWalkPointRow),
  };
};

const parsePayload = (value: unknown): ParsedImportPayload => {
  if (!value || typeof value !== 'object') {
    throw new Error('Import payload is not a valid JSON object.');
  }

  const payload = value as Partial<LocalExportPayload>;
  if (!Array.isArray(payload.dog_profiles) || !Array.isArray(payload.trigger_logs) || !Array.isArray(payload.walks)) {
    throw new Error('Import payload is missing required arrays.');
  }

  if (!payload.app_settings || typeof payload.app_settings !== 'object' || Array.isArray(payload.app_settings)) {
    throw new Error('Import payload app_settings must be an object.');
  }

  return {
    dog_profiles: payload.dog_profiles as Partial<DogProfile>[],
    trigger_logs: payload.trigger_logs as Partial<TriggerLog>[],
    walks: payload.walks as Partial<WalkRecord>[],
    walk_points: Array.isArray(payload.walk_points) ? payload.walk_points as Partial<WalkPoint>[] : [],
    app_settings: payload.app_settings as Record<string, unknown>,
  };
};

const resolveString = (value: unknown, fallback = '') => {
  return typeof value === 'string' ? value : fallback;
};

const resolveNullableString = (value: unknown) => {
  return typeof value === 'string' ? value : null;
};

const resolveNumber = (value: unknown, fallback = 0) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const importLocalData = async (value: unknown) => {
  const payload = parsePayload(value);
  const existingOwnerId = await ensureLocalOwnerId();
  const importedSettings = payload.app_settings;
  const importedOwnerId = existingOwnerId;

  const db = await getDatabase();
  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

  try {
    await db.runAsync('DELETE FROM trigger_logs');
    await db.runAsync('DELETE FROM walk_points');
    await db.runAsync('DELETE FROM walks');
    await db.runAsync('DELETE FROM dog_profiles');
    await db.runAsync('DELETE FROM app_settings');

    const now = new Date().toISOString();
    await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      LOCAL_OWNER_ID_KEY,
      importedOwnerId,
      now,
    ]);

    const importedOnboarding = normalizeBooleanString(resolveString(importedSettings[ONBOARDING_COMPLETE_KEY], 'false'));
    await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      ONBOARDING_COMPLETE_KEY,
      importedOnboarding,
      now,
    ]);

    for (const [key, rawValue] of Object.entries(importedSettings)) {
      if (key === LOCAL_OWNER_ID_KEY || key === ONBOARDING_COMPLETE_KEY) {
        continue;
      }

      await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
        key,
        resolveString(rawValue),
        now,
      ]);
    }

    for (const rawProfile of payload.dog_profiles) {
      const profile = rawProfile;
      const profileId = resolveString(profile.id, generateId('dog'));

      const triggers = Array.isArray(profile.triggers)
        ? profile.triggers.map((item) => String(item))
        : [];

      const createdAt = resolveString(profile.created_at, now);
      const updatedAt = resolveString(profile.updated_at, createdAt);

      await db.runAsync(
        `
          INSERT INTO dog_profiles (
            id,
            owner_id,
            name,
            breed,
            age,
            weight,
            triggers,
            reactivity_level,
            training_method,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          profileId,
          importedOwnerId,
          resolveString(profile.name, 'My Dog'),
          resolveString(profile.breed),
          resolveNumber(profile.age, 0),
          resolveNumber(profile.weight, 0),
          JSON.stringify(triggers),
          resolveNumber(profile.reactivity_level, 3),
          resolveNullableString(profile.training_method),
          createdAt,
          updatedAt,
        ]
      );
    }

    for (const rawLog of payload.trigger_logs) {
      const log = rawLog;
      const logId = resolveString(log.id, generateId('log'));
      const createdAt = resolveString(log.created_at, now);
      const updatedAt = resolveString(log.updated_at, createdAt);

      await db.runAsync(
        `
          INSERT INTO trigger_logs (
            id,
            dog_id,
            owner_id,
            trigger_type,
            severity,
            distance_meters,
            location_latitude,
            location_longitude,
            notes,
            logged_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          logId,
          resolveString(log.dog_id),
          importedOwnerId,
          resolveString(log.trigger_type, 'Other'),
          resolveNumber(log.severity, 3),
          typeof log.distance_meters === 'number' ? log.distance_meters : null,
          typeof log.location_latitude === 'number' ? log.location_latitude : null,
          typeof log.location_longitude === 'number' ? log.location_longitude : null,
          resolveNullableString(log.notes),
          resolveString(log.logged_at, createdAt),
          createdAt,
          updatedAt,
        ]
      );
    }

    for (const rawWalk of payload.walks) {
      const walk = rawWalk;
      const walkId = resolveString(walk.id, generateId('walk'));
      const createdAt = resolveString(walk.created_at, now);
      const updatedAt = resolveString(walk.updated_at, createdAt);

      await db.runAsync(
        `
          INSERT INTO walks (
            id,
            dog_id,
            owner_id,
            distance_threshold_meters,
            started_at,
            ended_at,
            success_rating,
            technique_used,
            notes,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          walkId,
          resolveString(walk.dog_id),
          importedOwnerId,
          resolveNumber(walk.distance_threshold_meters, 15),
          resolveString(walk.started_at, createdAt),
          resolveNullableString(walk.ended_at),
          typeof walk.success_rating === 'number' ? walk.success_rating : null,
          resolveNullableString(walk.technique_used),
          resolveNullableString(walk.notes),
          createdAt,
          updatedAt,
        ]
      );
    }

    for (const rawWalkPoint of payload.walk_points) {
      const point = rawWalkPoint;
      const pointId = resolveString(point.id, generateId('point'));
      const createdAt = resolveString(point.created_at, now);
      const capturedAt = resolveString(point.captured_at, createdAt);

      await db.runAsync(
        `
          INSERT INTO walk_points (
            id,
            walk_id,
            latitude,
            longitude,
            accuracy,
            captured_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pointId,
          resolveString(point.walk_id),
          resolveNumber(point.latitude, 0),
          resolveNumber(point.longitude, 0),
          typeof point.accuracy === 'number' ? point.accuracy : null,
          capturedAt,
          createdAt,
        ]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const SETTING_KEYS = {
  LOCAL_OWNER_ID_KEY,
  ONBOARDING_COMPLETE_KEY,
} as const;
