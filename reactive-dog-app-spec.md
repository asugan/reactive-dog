# Reactive Dog App - Product Specification (Local-first)

## 1) Overview

Reactive Dog is a mobile training companion for owners of reactive dogs.

The product is now intentionally local-first:

- No account requirement
- No login/signup flow
- No cloud database required for core usage
- All user data stored on-device

## 2) Product goals

- Reduce owner stress during reactive walks
- Make trigger logging very fast in real contexts
- Provide clear progress signals over days/weeks
- Keep behavior tracking private and available offline

## 3) Current scope

### In scope

- Dog onboarding and profile setup
- Trigger logging
- BAT walk workflow (setup, active, summary)
- Progress charts, map, and PDF export
- Local data management in settings (export/import/reset)

### Out of scope

- Community/social feed
- Multi-user accounts
- Remote moderation/admin tools
- Cloud sync/backup

## 4) Core user flows

### Onboarding

1. Welcome
2. Dog profile creation
3. Behavior assessment quiz
4. Recommended technique screen
5. Enter app tabs

### Daily usage

1. Open dashboard
2. Start walk or quick-log triggers
3. Review progress trends
4. Export/report data when needed

## 5) Technical architecture

### App stack

- React Native + Expo + TypeScript
- SQLite via `expo-sqlite`
- Repository-based data access layer

### Data layer

- Database init and migrations: `lib/data/database.ts`
- Repositories:
  - `lib/data/repositories/dogProfileRepo.ts`
  - `lib/data/repositories/triggerLogRepo.ts`
  - `lib/data/repositories/walkRepo.ts`
  - `lib/data/repositories/settingsRepo.ts`
- App bootstrap: `lib/localApp.ts`

### Identity model

- App creates a local owner ID on first run
- Owner ID is stored in `app_settings`
- RevenueCat is initialized with this local owner ID

## 6) Local schema

- `migration_meta` - schema versioning
- `app_settings` - app-level settings (`local_owner_id`, onboarding state, etc.)
- `dog_profiles` - dog identity and reactivity profile
- `trigger_logs` - trigger incidents and metadata
- `walks` - BAT session lifecycle and outcomes

## 7) Feature notes

### Trigger logging

- Supports trigger type, severity, distance, notes, and optional location
- Designed for low-friction quick entry

### BAT walk mode

- Setup checklist and threshold distance
- Active mode with timer and quick logs
- Summary with success rating and technique reflection

### Progress

- Time windows (7/30/90 days)
- Trend charts and trigger distribution
- Heatmap and trigger location map
- PDF export (premium-gated)

### Settings

- Export local data as JSON
- Import JSON backup
- Delete all local data with confirmation

## 8) Monetization

- RevenueCat-based subscription model
- Premium features currently include advanced exports/reporting paths

## 9) Quality and validation

Minimum regression checklist:

1. First launch -> onboarding -> tabs
2. Create trigger log and verify it appears in recent activity
3. Start/end walk and verify summary is saved
4. Progress screen reflects new data in charts/map
5. Export/import/reset flows work from settings

## 10) Known tradeoffs

- Data is tied to device storage unless user exports backups
- Reinstall/device change can cause data loss without export/import

## 11) Near-term roadmap

1. Add CSV export next to JSON export
2. Add safer import validation and conflict diagnostics
3. Add optional encrypted local backup file support
4. Evaluate optional cloud sync as a separate future module
