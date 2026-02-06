# Reactive Dog Training App

Mobile app for owners of reactive dogs (dogs that bark, lunge, or exhibit aggressive behavior toward other dogs, people, or stimuli).

## Tech Stack

- **Frontend:** React Native with Expo (TypeScript)
- **Backend:** PocketBase (Auth, Database, Storage)
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
├── lib/
│   ├── pocketbase.ts     # PocketBase client
│   └── posthog.ts        # PostHog config
└── .env.example
```

## Setup

### 1. Install dependencies

```bash
cd reactive-dog
npm install
```

### 2. PocketBase Setup

1. Download and run [PocketBase](https://pocketbase.io/)
2. Access the Admin UI (typically at `http://localhost:8090/_/`)
3. Go to **Settings** -> **Import collections** and use `pocketbase_collections.json`
4. Create `.env` file:

```bash
cp .env.example .env
```

5. Fill in your PocketBase URL in `.env`:

```
EXPO_PUBLIC_POCKETBASE_URL=http://your-pocketbase-url:8090
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
- ✅ **PocketBase Backend** - Auth and collections configured
- ✅ **Dog Profile Onboarding** - Multi-step flow with:
  - Welcome screen with statistics
  - Dog profile creation (name, breed, age, weight)
  - Trigger selection (Dogs, Humans, Bikes, Cars, Noise, Other)
  - Reactivity level assessment (1-5 scale)
  - Training method matching quiz (BAT, CC/DS, LAT)
  - Automatic PocketBase integration
- ✅ **Trigger Logging** - Quick 2-tap logging with:
  - Trigger type selection (Dog off/on-leash, Human, Bike, Car, Noise, Other)
  - Severity rating (1-5 scale with color coding)
  - Distance tracking (meters)
  - Optional notes
  - Recent logs display
  - Automatic PocketBase sync
- ✅ **Progress Analytics** - Charts & statistics with:
  - Time range selector (7/30/90 days)
  - Line chart: Reactions over time
  - Bar chart: Triggers by type
  - Stats cards: Total reactions, avg severity, week-over-week comparison
  - Recent activity list
  - **Interactive Trigger Map** - Visualize all reactive incidents on a map:
    - Color-coded pins by trigger type
    - GPS coordinates from BAT walks and quick logs
    - Auto-zoom to show all triggers
    - Tap pins for detailed info (type, severity, date)
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
  - Opt-in local owner map (privacy-first approximate locations)
- ✅ PDF export for behaviorists - Professional reports with:
  - Dog profile summary
  - Reaction statistics and trends
  - BAT training session logs
  - Shareable PDF format

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

The app uses the following collections in PocketBase:
- `user_profiles` - Extended user info
- `dog_profiles` - Dog information and triggers
- `trigger_logs` - Reaction logs with location, severity
- `walks` - BAT session tracking
- `community_posts` - Forum posts

### API Rules

All collections have API rules configured ensuring:
- Users can only access their own dog and trigger data
- Community posts are readable by everyone but only editable by author
- Profile data is viewable by all but only editable by owner

## Development Status

### Completed ✅
- [x] Set up PocketBase collections and import schema
- [x] Configure PocketBase client and API rules
- [x] Implement dog profile onboarding flow (5 screens)
- [x] Auth routing with automatic onboarding redirect

### In Progress ⏳
- [x] Build trigger logging UI
- [x] Create progress charts
- [x] BAT training mode with GPS tracking & distance alerts
- [x] Implement community forum
- [x] PDF export for behaviorists
- [ ] Configure PostHog analytics

## Resources

- [PocketBase Docs](https://pocketbase.io/docs)
- [Expo Docs](https://docs.expo.dev)
- [PostHog React Native](https://posthog.com/docs/libraries/react-native)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

## License

MIT
