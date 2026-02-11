import { getSetting, setSetting } from '../data/repositories/settingsRepo';

const PREMIUM_INSIGHT_METER_KEY = 'premium_insight_meter_v1';
export const MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT = 2;

interface StoredPremiumInsightMeter {
  monthKey: string;
  used: number;
  unlockedWeekKeys: string[];
}

export interface PremiumInsightMeterState {
  monthKey: string;
  used: number;
  limit: number;
  remaining: number;
  unlockedWeekKeys: string[];
}

export interface UnlockWeeklyPremiumInsightResult extends PremiumInsightMeterState {
  unlocked: boolean;
  consumed: boolean;
}

const getMonthKey = (date: Date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

export const getCurrentWeekKey = (date: Date = new Date()) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${`${weekNo}`.padStart(2, '0')}`;
};

const buildDefaultStoredMeter = (): StoredPremiumInsightMeter => {
  return {
    monthKey: getMonthKey(),
    used: 0,
    unlockedWeekKeys: [],
  };
};

const toUniqueStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => String(item)).filter(Boolean)));
};

const normalizeStoredMeter = (rawValue: string | null): StoredPremiumInsightMeter => {
  const defaultMeter = buildDefaultStoredMeter();
  if (!rawValue) {
    return defaultMeter;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPremiumInsightMeter>;
    const parsedMonthKey = typeof parsed.monthKey === 'string' ? parsed.monthKey : defaultMeter.monthKey;

    if (parsedMonthKey !== defaultMeter.monthKey) {
      return defaultMeter;
    }

    const parsedUsed = Number(parsed.used);
    const used = Number.isFinite(parsedUsed)
      ? Math.max(0, Math.min(Math.floor(parsedUsed), MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT))
      : 0;

    const unlockedWeekKeys = toUniqueStringArray(parsed.unlockedWeekKeys).slice(0, MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT);

    return {
      monthKey: parsedMonthKey,
      used: Math.max(used, unlockedWeekKeys.length),
      unlockedWeekKeys,
    };
  } catch {
    return defaultMeter;
  }
};

const toState = (meter: StoredPremiumInsightMeter): PremiumInsightMeterState => {
  const used = Math.max(0, Math.min(meter.used, MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT));

  return {
    monthKey: meter.monthKey,
    used,
    limit: MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT,
    remaining: Math.max(0, MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT - used),
    unlockedWeekKeys: meter.unlockedWeekKeys,
  };
};

const persistMeter = async (meter: StoredPremiumInsightMeter) => {
  await setSetting(PREMIUM_INSIGHT_METER_KEY, JSON.stringify(meter));
};

const getOrCreateStoredMeter = async () => {
  const raw = await getSetting(PREMIUM_INSIGHT_METER_KEY);
  const normalized = normalizeStoredMeter(raw);

  if (!raw || JSON.stringify(normalized) !== raw) {
    await persistMeter(normalized);
  }

  return normalized;
};

export const getPremiumInsightMeterState = async (): Promise<PremiumInsightMeterState> => {
  const meter = await getOrCreateStoredMeter();
  return toState(meter);
};

export const unlockWeeklyPremiumInsightPreview = async (
  weekKey: string
): Promise<UnlockWeeklyPremiumInsightResult> => {
  const meter = await getOrCreateStoredMeter();

  if (meter.unlockedWeekKeys.includes(weekKey)) {
    return {
      ...toState(meter),
      unlocked: true,
      consumed: false,
    };
  }

  if (meter.used >= MONTHLY_PREMIUM_INSIGHT_PREVIEW_LIMIT) {
    return {
      ...toState(meter),
      unlocked: false,
      consumed: false,
    };
  }

  const nextMeter: StoredPremiumInsightMeter = {
    monthKey: meter.monthKey,
    used: meter.used + 1,
    unlockedWeekKeys: [...meter.unlockedWeekKeys, weekKey],
  };

  await persistMeter(nextMeter);

  return {
    ...toState(nextMeter),
    unlocked: true,
    consumed: true,
  };
};
