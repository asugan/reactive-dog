import { getDatabase } from '../database';
import { generateId } from '../id';
import type { WalkPoint } from '../types';

interface DbWalkPointRow {
  id: string;
  walk_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  created_at: string;
}

const mapRow = (row: DbWalkPointRow): WalkPoint => {
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

export interface CreateWalkPointInput {
  id?: string;
  walk_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  captured_at?: string;
}

export interface ListWalkPointOptions {
  sort?: 'captured_at' | '-captured_at';
  limit?: number;
}

const resolveSortOrder = (sort: ListWalkPointOptions['sort']) => {
  return sort === '-captured_at' ? 'DESC' : 'ASC';
};

export const createMany = async (inputs: CreateWalkPointInput[]) => {
  if (inputs.length === 0) {
    return [] as WalkPoint[];
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  const createdIds: string[] = [];

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    for (const input of inputs) {
      const id = input.id ?? generateId('point');
      const capturedAt = input.captured_at ?? now;

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
        [id, input.walk_id, input.latitude, input.longitude, input.accuracy ?? null, capturedAt, now]
      );

      createdIds.push(id);
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  const placeholders = createdIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<DbWalkPointRow>(
    `SELECT * FROM walk_points WHERE id IN (${placeholders}) ORDER BY captured_at ASC`,
    createdIds
  );

  return rows.map(mapRow);
};

export const listByWalkId = async (walkId: string, options: ListWalkPointOptions = {}) => {
  const db = await getDatabase();
  const params: (string | number)[] = [walkId];
  let sql = `SELECT * FROM walk_points WHERE walk_id = ? ORDER BY captured_at ${resolveSortOrder(options.sort)}`;

  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = await db.getAllAsync<DbWalkPointRow>(sql, params);
  return rows.map(mapRow);
};

export const listByWalkIds = async (walkIds: string[], options: ListWalkPointOptions = {}) => {
  if (walkIds.length === 0) {
    return [] as WalkPoint[];
  }

  const db = await getDatabase();
  const placeholders = walkIds.map(() => '?').join(', ');
  const sql = `
    SELECT *
    FROM walk_points
    WHERE walk_id IN (${placeholders})
    ORDER BY captured_at ${resolveSortOrder(options.sort)}
  `;

  const rows = await db.getAllAsync<DbWalkPointRow>(sql, walkIds);
  return rows.map(mapRow);
};

export const deleteByWalkId = async (walkId: string) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM walk_points WHERE walk_id = ?', [walkId]);
};
