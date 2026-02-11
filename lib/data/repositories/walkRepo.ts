import { getDatabase } from '../database';
import { generateId } from '../id';
import type { WalkRecord } from '../types';

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

const mapRow = (row: DbWalkRow): WalkRecord => {
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

export interface CreateWalkInput {
  id?: string;
  dog_id: string;
  owner_id: string;
  distance_threshold_meters: number;
  started_at?: string;
}

export type UpdateWalkInput = Partial<
  Pick<WalkRecord, 'dog_id' | 'owner_id' | 'distance_threshold_meters' | 'started_at' | 'ended_at' | 'success_rating' | 'technique_used' | 'notes'>
>;

export interface ListWalkOptions {
  since?: string;
  sort?: 'started_at' | '-started_at';
  limit?: number;
  offset?: number;
}

const resolveSortOrder = (sort: ListWalkOptions['sort']) => {
  return sort === 'started_at' ? 'ASC' : 'DESC';
};

export const getById = async (id: string) => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DbWalkRow>('SELECT * FROM walks WHERE id = ? LIMIT 1', [id]);
  return row ? mapRow(row) : null;
};

export const create = async (input: CreateWalkInput) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? generateId('walk');
  const startedAt = input.started_at ?? now;

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
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
    `,
    [id, input.dog_id, input.owner_id, input.distance_threshold_meters, startedAt, now, now]
  );

  const created = await getById(id);
  if (!created) {
    throw new Error('Failed to create walk.');
  }

  return created;
};

export const update = async (id: string, input: UpdateWalkInput) => {
  const existing = await getById(id);
  if (!existing) {
    throw new Error('Walk not found.');
  }

  const next: WalkRecord = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  const db = await getDatabase();
  await db.runAsync(
    `
      UPDATE walks
      SET
        dog_id = ?,
        owner_id = ?,
        distance_threshold_meters = ?,
        started_at = ?,
        ended_at = ?,
        success_rating = ?,
        technique_used = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      next.dog_id,
      next.owner_id,
      next.distance_threshold_meters,
      next.started_at,
      next.ended_at,
      next.success_rating,
      next.technique_used,
      next.notes,
      next.updated_at,
      id,
    ]
  );

  const updated = await getById(id);
  if (!updated) {
    throw new Error('Failed to update walk.');
  }

  return updated;
};

export const listByOwner = async (ownerId: string, options: ListWalkOptions = {}) => {
  const db = await getDatabase();
  const whereParts = ['owner_id = ?'];
  const params: (string | number)[] = [ownerId];

  if (options.since) {
    whereParts.push('started_at >= ?');
    params.push(options.since);
  }

  let sql = `SELECT * FROM walks WHERE ${whereParts.join(' AND ')} ORDER BY started_at ${resolveSortOrder(options.sort)}`;

  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);

    if (options.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = await db.getAllAsync<DbWalkRow>(sql, params);
  return rows.map(mapRow);
};

export const countByOwner = async (ownerId: string, since?: string) => {
  const db = await getDatabase();

  if (!since) {
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM walks WHERE owner_id = ?', [
      ownerId,
    ]);
    return Number(row?.total ?? 0);
  }

  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) as total FROM walks WHERE owner_id = ? AND started_at >= ?',
    [ownerId, since]
  );
  return Number(row?.total ?? 0);
};

export const listAll = async () => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DbWalkRow>('SELECT * FROM walks ORDER BY started_at DESC');
  return rows.map(mapRow);
};
