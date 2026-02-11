export interface DogProfile {
  id: string;
  owner_id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  triggers: string[];
  reactivity_level: number;
  training_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerLog {
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

export interface WalkRecord {
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

export interface WalkPoint {
  id: string;
  walk_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  created_at: string;
}

export interface LocalExportPayload {
  version: number;
  exported_at: string;
  app_settings: Record<string, string>;
  dog_profiles: DogProfile[];
  trigger_logs: TriggerLog[];
  walks: WalkRecord[];
  walk_points: WalkPoint[];
}
