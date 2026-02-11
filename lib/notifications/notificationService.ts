import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getSetting, setSetting } from '../data/repositories/settingsRepo';

const TRAINING_REMINDER_CHANNEL_ID = 'training-reminders';
const WEEKLY_REMINDER_IDS_KEY = 'notifications_weekly_plan_ids';
const WEEKLY_REMINDER_HOUR_KEY = 'notifications_weekly_plan_hour';
const WEEKLY_REMINDER_MINUTE_KEY = 'notifications_weekly_plan_minute';
const DEFAULT_WEEKLY_REMINDER_HOUR = 19;
const DEFAULT_WEEKLY_REMINDER_MINUTE = 0;
const ACTIVE_WALK_REMINDER_SECONDS = 8 * 60;

const DAY_TO_WEEKDAY: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

const TECHNIQUE_LABELS: Record<string, string> = {
  U_Turn: 'U-Turn',
  Find_It: 'Find It',
  LAT: 'Look at That',
  Other: 'your chosen technique',
};

let isNotificationHandlerConfigured = false;

const parseStoredIds = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
};

const getStoredWeeklyReminderIds = async () => {
  const raw = await getSetting(WEEKLY_REMINDER_IDS_KEY);
  return parseStoredIds(raw);
};

const setStoredWeeklyReminderIds = async (ids: string[]) => {
  await setSetting(WEEKLY_REMINDER_IDS_KEY, JSON.stringify(ids));
};

const parseStoredNumber = (value: string | null) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

const isValidReminderTime = (hour: number, minute: number) => {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

export interface WeeklyReminderTime {
  hour: number;
  minute: number;
}

export const getWeeklyReminderTime = async (): Promise<WeeklyReminderTime> => {
  const [storedHour, storedMinute] = await Promise.all([
    getSetting(WEEKLY_REMINDER_HOUR_KEY),
    getSetting(WEEKLY_REMINDER_MINUTE_KEY),
  ]);

  const parsedHour = parseStoredNumber(storedHour);
  const parsedMinute = parseStoredNumber(storedMinute);

  if (parsedHour === null || parsedMinute === null || !isValidReminderTime(parsedHour, parsedMinute)) {
    return {
      hour: DEFAULT_WEEKLY_REMINDER_HOUR,
      minute: DEFAULT_WEEKLY_REMINDER_MINUTE,
    };
  }

  return {
    hour: parsedHour,
    minute: parsedMinute,
  };
};

export const setWeeklyReminderTime = async ({ hour, minute }: WeeklyReminderTime) => {
  if (!isValidReminderTime(hour, minute)) {
    throw new Error('Invalid weekly reminder time');
  }

  await Promise.all([
    setSetting(WEEKLY_REMINDER_HOUR_KEY, String(hour)),
    setSetting(WEEKLY_REMINDER_MINUTE_KEY, String(minute)),
  ]);
};

const getTechniqueLabel = (technique: string | null | undefined) => {
  if (!technique) {
    return 'your chosen technique';
  }

  return TECHNIQUE_LABELS[technique] ?? technique.replace('_', ' ');
};

export const initializeNotifications = async () => {
  if (!isNotificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    isNotificationHandlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TRAINING_REMINDER_CHANNEL_ID, {
      name: 'Training reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D4ED8',
    });
  }
};

export const getNotificationPermissionStatus = async () => {
  await initializeNotifications();
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
};

export const requestNotificationPermission = async () => {
  await initializeNotifications();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return requested.granted;
};

export const clearWeeklyPlanReminders = async () => {
  const ids = await getStoredWeeklyReminderIds();

  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        return;
      }
    })
  );

  await setStoredWeeklyReminderIds([]);
};

interface WeeklyReminderOptions {
  plannedDays: string[];
  dogName?: string | null;
  requestPermissionIfNeeded?: boolean;
  reminderHour?: number;
  reminderMinute?: number;
}

interface WeeklyReminderResult {
  scheduledCount: number;
  permissionGranted: boolean;
}

export const syncWeeklyPlanReminders = async ({
  plannedDays,
  dogName,
  requestPermissionIfNeeded = false,
  reminderHour,
  reminderMinute,
}: WeeklyReminderOptions): Promise<WeeklyReminderResult> => {
  const uniqueDays = Array.from(new Set(plannedDays)).filter((day) => Number.isInteger(DAY_TO_WEEKDAY[day]));
  const storedReminderTime = await getWeeklyReminderTime();
  const effectiveReminderTime = {
    hour: typeof reminderHour === 'number' ? reminderHour : storedReminderTime.hour,
    minute: typeof reminderMinute === 'number' ? reminderMinute : storedReminderTime.minute,
  };
  const safeReminderTime = isValidReminderTime(effectiveReminderTime.hour, effectiveReminderTime.minute)
    ? effectiveReminderTime
    : {
        hour: DEFAULT_WEEKLY_REMINDER_HOUR,
        minute: DEFAULT_WEEKLY_REMINDER_MINUTE,
      };
  const permissionGranted = requestPermissionIfNeeded
    ? await requestNotificationPermission()
    : await getNotificationPermissionStatus();

  await clearWeeklyPlanReminders();

  if (!permissionGranted || uniqueDays.length === 0) {
    return {
      scheduledCount: 0,
      permissionGranted,
    };
  }

  const label = dogName?.trim() || 'Your dog';
  const notificationIds: string[] = [];

  for (const day of uniqueDays) {
    const weekday = DAY_TO_WEEKDAY[day];
    if (!weekday) {
      continue;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'BAT session reminder',
        body: `${label} icin bugun kisa bir BAT calismasi planli.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: safeReminderTime.hour,
        minute: safeReminderTime.minute,
        channelId: TRAINING_REMINDER_CHANNEL_ID,
      },
    });

    notificationIds.push(notificationId);
  }

  await setStoredWeeklyReminderIds(notificationIds);

  return {
    scheduledCount: notificationIds.length,
    permissionGranted: true,
  };
};

interface ActiveWalkReminderOptions {
  technique?: string | null;
  distanceThreshold?: number | null;
}

export const scheduleActiveWalkCheckInReminder = async ({
  technique,
  distanceThreshold,
}: ActiveWalkReminderOptions): Promise<string | null> => {
  const permissionGranted = await getNotificationPermissionStatus();
  if (!permissionGranted) {
    return null;
  }

  const techniqueLabel = getTechniqueLabel(technique);
  const distanceLabel =
    typeof distanceThreshold === 'number' && Number.isFinite(distanceThreshold)
      ? `${Math.round(distanceThreshold)}m`
      : 'your threshold distance';

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'BAT walk check-in',
      body: `Mesafeyi ${distanceLabel} civarinda tut ve ${techniqueLabel} teknigini hatirla.`,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: ACTIVE_WALK_REMINDER_SECONDS,
      repeats: true,
      channelId: TRAINING_REMINDER_CHANNEL_ID,
    },
  });

  return notificationId;
};

export const cancelReminderById = async (id: string | null | undefined) => {
  if (!id) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    return;
  }
};

export const sendTestNotification = async () => {
  const permissionGranted = await getNotificationPermissionStatus();
  if (!permissionGranted) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Notifications are active',
      body: 'BAT hatirlaticilari bu cihazda aktif.',
      sound: 'default',
    },
    trigger: null,
  });

  return true;
};
