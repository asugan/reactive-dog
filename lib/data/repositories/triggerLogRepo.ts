import { getDatabase } from '../database';
import { generateId } from '../id';
import type { TriggerLog } from '../types';

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

const mapRow = (row: DbTriggerLogRow): TriggerLog => {
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

export interface CreateTriggerLogInput {
  id?: string;
  dog_id: string;
  owner_id: string;
  trigger_type: string;
  severity: number;
  distance_meters?: number | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  notes?: string | null;
  logged_at?: string;
}

export interface ListTriggerLogOptions {
  since?: string;
  sort?: 'logged_at' | '-logged_at';
  limit?: number;
  offset?: number;
}

const resolveSortOrder = (sort: ListTriggerLogOptions['sort']) => {
  return sort === 'logged_at' ? 'ASC' : 'DESC';
};

export const create = async (input: CreateTriggerLogInput) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? generateId('log');
  const loggedAt = input.logged_at ?? now;

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
      id,
      input.dog_id,
      input.owner_id,
      input.trigger_type,
      input.severity,
      input.distance_meters ?? null,
      input.location_latitude ?? null,
      input.location_longitude ?? null,
      input.notes ?? null,
      loggedAt,
      now,
      now,
    ]
  );

  const row = await db.getFirstAsync<DbTriggerLogRow>('SELECT * FROM trigger_logs WHERE id = ? LIMIT 1', [id]);
  if (!row) {
    throw new Error('Failed to create trigger log.');
  }

  return mapRow(row);
};

export const listByOwner = async (ownerId: string, options: ListTriggerLogOptions = {}) => {
  const db = await getDatabase();
  const whereParts = ['owner_id = ?'];
  const params: (string | number)[] = [ownerId];

  if (options.since) {
    whereParts.push('logged_at >= ?');
    params.push(options.since);
  }

  let sql = `SELECT * FROM trigger_logs WHERE ${whereParts.join(' AND ')} ORDER BY logged_at ${resolveSortOrder(options.sort)}`;

  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);

    if (options.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = await db.getAllAsync<DbTriggerLogRow>(sql, params);
  return rows.map(mapRow);
};

export const countByOwner = async (ownerId: string, since?: string) => {
  const db = await getDatabase();

  if (!since) {
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) as total FROM trigger_logs WHERE owner_id = ?',
      [ownerId]
    );
    return Number(row?.total ?? 0);
  }

  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM trigger_logs WHERE owner_id = ? AND logged_at >= ?',
    [ownerId, since]
  );
  return Number(row?.total ?? 0);
};

export const listAll = async () => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DbTriggerLogRow>('SELECT * FROM trigger_logs ORDER BY logged_at DESC');
  return rows.map(mapRow);
};
