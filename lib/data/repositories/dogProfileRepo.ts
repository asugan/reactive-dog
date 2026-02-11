import { getDatabase } from '../database';
import { generateId } from '../id';
import type { DogProfile } from '../types';

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

const mapRow = (row: DbDogProfileRow): DogProfile => {
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

export interface CreateDogProfileInput {
  id?: string;
  owner_id: string;
  name: string;
  breed?: string;
  age?: number;
  weight?: number;
  triggers?: string[];
  reactivity_level?: number;
  training_method?: string | null;
}

export type UpdateDogProfileInput = Partial<
  Pick<
    DogProfile,
    'owner_id' | 'name' | 'breed' | 'age' | 'weight' | 'triggers' | 'reactivity_level' | 'training_method'
  >
>;

export const getById = async (id: string) => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DbDogProfileRow>('SELECT * FROM dog_profiles WHERE id = ? LIMIT 1', [id]);
  return row ? mapRow(row) : null;
};

export const getByOwnerId = async (ownerId: string) => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DbDogProfileRow>(
    'SELECT * FROM dog_profiles WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1',
    [ownerId]
  );
  return row ? mapRow(row) : null;
};

export const listByOwner = async (ownerId: string) => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DbDogProfileRow>(
    'SELECT * FROM dog_profiles WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId]
  );
  return rows.map(mapRow);
};

export const listAll = async () => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DbDogProfileRow>('SELECT * FROM dog_profiles ORDER BY created_at DESC');
  return rows.map(mapRow);
};

export const create = async (input: CreateDogProfileInput) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? generateId('dog');

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
      id,
      input.owner_id,
      input.name.trim(),
      input.breed ?? '',
      input.age ?? 0,
      input.weight ?? 0,
      JSON.stringify(input.triggers ?? []),
      input.reactivity_level ?? 3,
      input.training_method ?? null,
      now,
      now,
    ]
  );

  const created = await getById(id);
  if (!created) {
    throw new Error('Failed to create dog profile.');
  }

  return created;
};

export const update = async (id: string, input: UpdateDogProfileInput) => {
  const existing = await getById(id);
  if (!existing) {
    throw new Error('Dog profile not found.');
  }

  const next: DogProfile = {
    ...existing,
    ...input,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    triggers: input.triggers !== undefined ? input.triggers : existing.triggers,
    updated_at: new Date().toISOString(),
  };

  const db = await getDatabase();
  await db.runAsync(
    `
      UPDATE dog_profiles
      SET
        owner_id = ?,
        name = ?,
        breed = ?,
        age = ?,
        weight = ?,
        triggers = ?,
        reactivity_level = ?,
        training_method = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      next.owner_id,
      next.name,
      next.breed,
      next.age,
      next.weight,
      JSON.stringify(next.triggers),
      next.reactivity_level,
      next.training_method,
      next.updated_at,
      id,
    ]
  );

  const updated = await getById(id);
  if (!updated) {
    throw new Error('Failed to update dog profile.');
  }

  return updated;
};
