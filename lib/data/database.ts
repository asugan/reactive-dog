import * as SQLite from 'expo-sqlite';

const DB_NAME = 'reactive_dog_local.db';
const CURRENT_SCHEMA_VERSION = 1;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const ensureMigrationMetaTable = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migration_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
};

const applyInitialSchema = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migration_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dog_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      breed TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL DEFAULT 0,
      weight REAL NOT NULL DEFAULT 0,
      triggers TEXT NOT NULL DEFAULT '[]',
      reactivity_level INTEGER NOT NULL DEFAULT 3,
      training_method TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dog_profiles_owner_id ON dog_profiles(owner_id);

    CREATE TABLE IF NOT EXISTS trigger_logs (
      id TEXT PRIMARY KEY NOT NULL,
      dog_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      severity INTEGER NOT NULL,
      distance_meters REAL,
      location_latitude REAL,
      location_longitude REAL,
      notes TEXT,
      logged_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trigger_logs_owner_id ON trigger_logs(owner_id);
    CREATE INDEX IF NOT EXISTS idx_trigger_logs_logged_at ON trigger_logs(logged_at);

    CREATE TABLE IF NOT EXISTS walks (
      id TEXT PRIMARY KEY NOT NULL,
      dog_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      distance_threshold_meters REAL NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      success_rating INTEGER,
      technique_used TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_walks_owner_id ON walks(owner_id);
    CREATE INDEX IF NOT EXISTS idx_walks_started_at ON walks(started_at);
  `);
};

const getStoredSchemaVersion = async (db: SQLite.SQLiteDatabase) => {
  await ensureMigrationMetaTable(db);
  const row = await db.getFirstAsync<{ schema_version: number }>(
    'SELECT schema_version FROM migration_meta WHERE id = 1'
  );
  return row?.schema_version ?? 0;
};

const persistSchemaVersion = async (db: SQLite.SQLiteDatabase, schemaVersion: number) => {
  const now = new Date().toISOString();
  await db.runAsync(
    `
      INSERT INTO migration_meta (id, schema_version, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        updated_at = excluded.updated_at
    `,
    [schemaVersion, now]
  );
};

const runMigrations = async (db: SQLite.SQLiteDatabase) => {
  const version = await getStoredSchemaVersion(db);
  if (version >= CURRENT_SCHEMA_VERSION) {
    return;
  }

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    if (version < 1) {
      await applyInitialSchema(db);
      await persistSchemaVersion(db, 1);
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL');
      await runMigrations(db);
      return db;
    })();
  }

  return databasePromise;
};

export const initializeLocalData = async () => {
  await getDatabase();
};
