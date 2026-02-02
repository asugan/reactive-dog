# Reactive Dog Training App

Mobile app for owners of reactive dogs (dogs that bark, lunge, or exhibit aggressive behavior toward other dogs, people, or stimuli).

## Tech Stack

- **Frontend:** React Native with Expo (TypeScript)
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Maps:** expo-location, react-native-maps
- **UI:** react-native-paper
- **Charts:** react-native-chart-kit
- **Analytics:** PostHog
- **Payments:** RevenueCat (future)
- **Notifications:** expo-notifications

## Project Structure

```
app/
├── (auth)/
│   ├── login.tsx
│   ├── signup.tsx
│   └── _layout.tsx
├── (tabs)/
│   ├── index.tsx         # Dashboard
│   ├── log.tsx           # Quick trigger log
│   ├── progress.tsx      # Charts & stats
│   ├── community.tsx     # Forum
│   └── _layout.tsx
├── walk/
│   ├── _layout.tsx       # Walk stack navigator
│   ├── index.tsx         # Pre-walk setup & checklist
│   ├── active.tsx        # Active walk mode with GPS tracking
│   └── summary.tsx       # Post-walk reflection
├── settings/
│   └── profile.tsx
├── onboarding/
│   ├── _layout.tsx       # Onboarding stack navigator
│   ├── index.tsx         # Welcome screen
│   ├── dog-profile.tsx   # Dog info & triggers
│   ├── assessment.tsx    # Reactivity quiz
│   └── technique.tsx     # Training method recommendation
├── _layout.tsx           # Root layout with auth/onboarding routing
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── posthog.ts        # PostHog config
└── .env.example
```

## Setup

### 1. Install dependencies

```bash
cd reactive-dog
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
4. Create `.env` file:

```bash
cp .env.example .env
```

5. Fill in your Supabase credentials in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. PostHog Setup

1. Go to [posthog.com](https://posthog.com) and create a project
2. Get your API key
3. Add to `.env`:

```
EXPO_PUBLIC_POSTHOG_KEY=your_posthog_key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 4. Run the app

```bash
npm start
# or
npx expo start
```

## Features

### MVP (V1) - Implementation Status
- ✅ **Supabase Backend** - Auth, database, and RLS policies configured
- ✅ **Dog Profile Onboarding** - Multi-step flow with:
  - Welcome screen with statistics
  - Dog profile creation (name, breed, age, weight)
  - Trigger selection (Dogs, Humans, Bikes, Cars, Noise, Other)
  - Reactivity level assessment (1-5 scale)
  - Training method matching quiz (BAT, CC/DS, LAT)
  - Automatic Supabase integration
- ✅ **Trigger Logging** - Quick 2-tap logging with:
  - Trigger type selection (Dog off/on-leash, Human, Bike, Car, Noise, Other)
  - Severity rating (1-5 scale with color coding)
  - Distance tracking (meters)
  - Optional notes
  - Recent logs display
  - Automatic Supabase sync
- ✅ **Progress Analytics** - Charts & statistics with:
  - Time range selector (7/30/90 days)
  - Line chart: Reactions over time
  - Bar chart: Triggers by type
  - Stats cards: Total reactions, avg severity, week-over-week comparison
  - Recent activity list
- ✅ **BAT Training Mode** - Full training walk experience with:
  - Pre-walk checklist (treats, equipment, mindset)
  - Distance threshold configuration (5-50m alerts)
  - Active walk mode with GPS tracking & timer
  - Technique reminders (U-Turn, Find It, Look at That)
  - Quick trigger logging during walk
  - Post-walk reflection & success rating
  - Pause/resume functionality
  - Haptic feedback for logging
- ✅ Community forum - Anonymous support community with:
  - Post types: General, Win of the Day, Question, Success Story
  - Anonymous posting (auto-generated names)
  - Like system
  - Filter by post type
- ⏳ PDF export for behaviorists

### Freemium Model
| Feature | Free | Pro ($4.99/mo) |
|---------|------|----------------|
| Daily logs | 3/day | Unlimited |
| Data history | 30 days | Lifetime |
| Basic charts | ✅ | ✅ |
| Advanced analytics | ❌ | ✅ |
| PDF reports | ❌ | ✅ |
| Community posting | Read-only | Full access |

## Development

### Database Schema

The app uses the following tables:
- `profiles` - User profiles (extends auth.users)
- `dog_profiles` - Dog information and triggers
- `trigger_logs` - Reaction logs with location, severity
- `walks` - BAT session tracking
- `community_posts` - Forum posts

### Row Level Security

All tables have RLS enabled with policies ensuring:
- Users can only access their own dog and trigger data
- Community posts are readable by everyone but only editable by author
- Profile data is viewable by all but only editable by owner

## Development Status

### Completed ✅
- [x] Set up Supabase project and run migrations
- [x] Configure Supabase client and RLS policies
- [x] Implement dog profile onboarding flow (5 screens)
- [x] Auth routing with automatic onboarding redirect

### In Progress ⏳
- [x] Build trigger logging UI
- [x] Create progress charts
- [x] BAT training mode with GPS tracking & distance alerts
- [ ] Implement community forum
- [ ] Configure PostHog analytics

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [PostHog React Native](https://posthog.com/docs/libraries/react-native)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

## License

MIT
