# Reactive Dog Training App

Mobile app for reactive dog owners to track triggers, run structured BAT walks, and monitor progress over time.

## Local-first architecture

The app now runs fully local on the device:

- No login/signup flow
- No cloud backend dependency
- All core data stored in on-device SQLite
- No community tab or backend social features

## Tech stack

- Frontend: React Native + Expo + TypeScript
- Local data: `expo-sqlite`
- UI: `react-native-paper`
- Charts: `react-native-chart-kit`
- Maps: `react-native-maps`, `expo-location`
- Billing: RevenueCat
- Analytics: PostHog (optional)

## Main features

- Onboarding flow: dog profile + assessment + technique recommendation
- Quick trigger logging: type, severity, distance, notes
- BAT walk mode: setup, active walk, quick logging, summary
- Progress analytics: charts, heatmap, trigger map, PDF export (premium)
- Settings: local data export/import (JSON) and full local data reset

## Project structure

```text
app/
|- (tabs)/
|  |- index.tsx
|  |- walk-tab.tsx
|  |- log.tsx
|  |- progress.tsx
|  |- settings.tsx
|  `- _layout.tsx
|- onboarding/
|  |- index.tsx
|  |- dog-profile.tsx
|  |- assessment.tsx
|  |- technique.tsx
|  `- _layout.tsx
|- walk/
|  |- index.tsx
|  |- active.tsx
|  |- summary.tsx
|  `- _layout.tsx
|- paywall.tsx
`- _layout.tsx

lib/
|- localApp.ts
|- data/
|  |- database.ts
|  |- id.ts
|  |- types.ts
|  `- repositories/
|     |- dogProfileRepo.ts
|     |- triggerLogRepo.ts
|     |- walkRepo.ts
|     `- settingsRepo.ts
|- billing/
|  |- revenuecat.ts
|  `- access.ts
`- posthog.ts
```

## Setup

1) Install dependencies

```bash
npm install
```

2) Create env file

```bash
cp .env.example .env
```

3) Fill env values as needed

```bash
EXPO_PUBLIC_POSTHOG_KEY=your_posthog_key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_key
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_key
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=premium
```

4) Run app

```bash
npm start
```

## Local database schema

Core tables:

- `app_settings`
- `dog_profiles`
- `trigger_logs`
- `walks`
- `migration_meta`

Migrations are managed in `lib/data/database.ts`.

## Development scripts

- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`

## Notes

- Data is device-local. Reinstalling app can remove data unless exported first.
- Premium checks are device/app-user based through RevenueCat.

## License

MIT
