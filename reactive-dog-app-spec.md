# Reactive Dog Training App - Product Specification

## Overview
Mobile app for owners of reactive dogs (dogs that bark, lunge, or exhibit aggressive behavior toward other dogs, people, or stimuli).

**Target MRR:** $200-300
**Platform:** React Native (iOS & Android)
**Monetization:** Freemium subscription ($4.99/mo)

---

## Problem Statement

Reactive dog owners face:
- Stressful, embarrassing walks
- Guilt about socialization failures
- Expensive behaviorist fees ($100-300/hour)
- Isolation and lack of support

**Target User:** 25-45, urban, dog = "child replacement", follows #reactivedogs on Instagram

---

## MVP Feature Set (V1)

### 1. Trigger Logging
```
- Trigger types: Dog (on/off-leash), Human, Bike, Car, Noise, Other
- Distance tracking: "Dog was 5m away, reacted at 10m"
- Reaction severity: 1-5 scale (alert → bark → lunge → bite attempt)
- Context: Time, GPS location, weather, dog's energy level, last meal
- Photo capture: Document specific triggers
- Notes: Free text for patterns
```

### 2. BAT Training Mode (✅ Implemented)
```
✅ Pre-walk checklist: Equipment, treats, mindset check
✅ Distance threshold: Configure alert distance (5-50m)
✅ Active walk mode: GPS tracking, timer, pause/resume
✅ Technique reminders: U-Turn, Find It, Look at That
✅ Quick trigger logging: 2-tap logging during walk
✅ Real-time stats: Duration, trigger count, location status
✅ Post-walk reflection: Success rating (1-5), technique used, notes
⏳ Weekly BAT session planner
```

### 3. Progress Analytics (✅ Implemented)
```
✅ Reaction frequency over time (line chart)
✅ Distance threshold improvements (via BAT walk mode)
⏳ "Good days vs bad days" calendar heatmap
✅ Trigger frequency by type (bar chart)
✅ Statistics cards:
   - Total reactions
   - Average severity (with color coding)
   - This week vs last week comparison
✅ Time range selector (7/30/90 days)
✅ Recent activity list
⏳ PDF export for behaviorists (professional reports)
```

### 4. Community Features
```
- Anonymous support forum (text-only, no photos)
- "Win of the day" micro-posts
- Opt-in local owner map (for meetups)
- Expert Q&A sessions (behaviorist AMAs)
- Success stories library
```

---

## Technical Architecture

### Tech Stack
```typescript
// Core
- React Native with Expo
- TypeScript

// Backend
- Supabase (Auth, PostgreSQL, Storage)
- Edge Functions for PDF generation

// Maps & Location
- expo-location (GPS tracking)
- react-native-maps (trigger pinning)

// UI/Charts
- react-native-chart-kit (analytics)
- react-native-paper or native-base (UI kit)

// Payments
- RevenueCat (subscription management)

// Notifications
- expo-notifications (training reminders)
```

### Project Structure
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
│   └── profile.tsx       # (future)
├── onboarding/
│   ├── _layout.tsx       # Stack navigator
│   ├── index.tsx         # Welcome + stats
│   ├── dog-profile.tsx   # Dog info & triggers
│   ├── assessment.tsx    # 4-question reactivity quiz
│   └── technique.tsx     # Training method recommendation
├── _layout.tsx           # Root with auth/onboarding guards
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── posthog.ts        # PostHog config
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Monetization Strategy

### Freemium Model

| Feature | Free | Pro ($4.99/month) |
|---------|------|-------------------|
| Daily logs | 3/day | Unlimited |
| Data history | 30 days | Lifetime |
| Basic charts | ✅ | ✅ |
| Advanced analytics | ❌ | ✅ |
| PDF reports | ❌ | ✅ |
| Community posting | Read-only | Full access |
| Expert content | Limited | Full library |
| Priority support | ❌ | ✅ |

### Additional Revenue
- **Behaviorist marketplace:** Book consultations ($50-100, 20% commission)
- **Custom training plans:** PDF guides ($19.99)
- **Equipment affiliate:** Gentle leaders, treat pouches

### Pricing Psychology
- Annual plan: $39.99/year (33% savings)
- Lifetime deal: $99 (for early adopters)

---

## User Flow

### Onboarding (✅ Implemented)
1. **Welcome Screen:** "You're not alone - 30% of dogs are reactive" with statistics and motivation
2. **Dog Profile:** Collect name, breed, age, weight, and reactivity level (1-5 scale)
3. **Trigger Selection:** Multi-select trigger types (Dogs on/off-leash, Humans, Bikes, Cars, Noise, Other)
4. **Assessment Quiz:** 4-question reactivity assessment to determine:
   - Behavioral patterns (staring vs barking vs fleeing)
   - Trigger distance awareness
   - Food responsiveness
   - Training goals
5. **Technique Match:** Algorithm auto-suggests:
   - **BAT** (Behavior Adjustment Training) - For dogs who bark/lunge
   - **CC/DS** (Counter-Conditioning/Desensitization) - For fearful/anxious dogs
   - **LAT** (Look at That) - For dogs who stare intensely
6. **Auto-save:** Dog profile saved to Supabase with recommended technique

### Daily Usage
1. **Morning:** Check dashboard for yesterday's summary
2. **Pre-walk:** Open app, set today's goals
3. **During walk:** Quick log trigger (2 taps) or activate BAT mode
4. **Post-walk:** Rate success, add notes
5. **Evening:** Check community for support

---

## Growth Strategy

### Pre-Launch (Month 1-2)

**Content Marketing:**
- Instagram/TikTok: @reactiveroverapp
  - Educational: "It's not aggression, it's threshold management"
  - Relatable memes: "When your dog sees another dog 100m away"
  - Success transformations

**Community Building:**
- Reddit r/reactivedogs (47k members)
  - Value-first posts: Free BAT guides
  - Soft launch: "Building this for my reactive dog, need beta testers"
  
- Facebook Groups:
  - Reactive Dogs Support Group
  - Fearful Dogs

**Partnerships:**
- Local certified behaviorists (30% affiliate commission)
- Dog trainers (recommend app to clients)
- Veterinary behaviorists (professional tool positioning)

### Launch Strategy

**Beta Program:**
- 50 reactive dog owners from Reddit
- Private TestFlight/Play Console
- Weekly feedback calls
- Lifetime 50% discount for beta users

**Launch Channels:**
1. Product Hunt ("Tools for dog owners")
2. r/reactivedogs announcement post
3. Instagram influencer partnerships (micro-influencers, 10k-50k followers)
4. Email list of behaviorists

---

## V2+ Roadmap

### Version 2.0 (Months 4-6)
- **Equipment Integration:** Fi collar, Whistle (activity + pulse data)
- **AI Photo Analysis:** Risk assessment of approaching dogs
- **Advanced BAT:** Video tutorials, step-by-step protocols
- **Vet Behaviorist Marketplace:** Book consultations in-app

### Version 3.0 (Months 7-12)
- **Group Walks:** Organized reactive-friendly routes
- **Voice Logging:** Siri/Google Assistant integration
- **Medication Tracking:** For dogs on behavioral meds
- **Weather Integration:** "High reactivity days" prediction

### Future Ideas
- **Reactive Cat Mode:** Expand to other pets
- **Trainer Dashboard:** For professionals managing multiple clients
- **Research Partnership:** Data sharing with veterinary universities

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users abandon app on bad days | High | High | Widget + 2-tap quick log, gentle reminders |
| Too technical (jargon) | Medium | Medium | Quiz-based onboarding, plain language |
| Competition from general apps | Medium | Low | Niche focus, community depth |
| Behaviorists view as threat | Low | Medium | Position as professional tool, partnerships |
| Low retention after improvement | Medium | High | Community features, "pay it forward" program |

---

## Success Metrics

**Month 3 Targets:**
- 500 downloads
- 100 MAU (Monthly Active Users)
- 15% conversion to Pro
- $75 MRR

**Month 6 Targets:**
- 2,000 downloads
- 600 MAU
- 20% conversion
- $240 MRR

**Month 12 Targets:**
- 10,000 downloads
- 3,000 MAU
- 25% conversion + marketplace
- $600+ MRR

**Key Metrics:**
- DAU/MAU ratio (aim for >30%)
- Session frequency (3+ walks/week)
- Feature adoption (BAT mode usage)
- Community engagement (posts per user)
- Churn rate (target <5%/month)

---

## Competitive Analysis

### Direct Competitors
**1. DogLog**
- Pros: Simple, free
- Cons: Generic, no reactive-specific features
- Gap: No BAT training, no community

**2. Puppr (training app)**
- Pros: Video tutorials
- Cons: General obedience, not reactive-focused
- Gap: No logging/analytics

**3. Biscuit (habit tracker)**
- Pros: Beautiful UI
- Cons: Not dog-specific
- Gap: No training protocols

### Indirect Competitors
- Pen & paper logs
- Excel spreadsheets
- Instagram communities (manual)

**Our Advantage:** Purpose-built for reactive dogs with evidence-based protocols + supportive community.

---

## Content & Education

### In-App Library
1. **BAT 101:** Beginner guide to Behavior Adjustment Training
2. **Trigger Stacking:** Why some days are worse than others
3. **Emergency U-Turn:** Step-by-step technique
4. **Treat Delivery:** Timing and positioning
5. **Equipment Guide:** Harnesses, head halters, treat pouches

### Video Content
- "Day in the life" with reactive dogs
- Success story interviews
- Expert tips (behaviorists)
- Technique demonstrations

---

## Legal & Ethics

### Data Privacy
- Health data encrypted at rest
- Option for local-only storage (no cloud)
- Community posts anonymized by default
- No selling user data

### Disclaimer
Required in-app:
```
This app is a training tool and journal, not a substitute 
for professional veterinary behaviorist consultation. 
If your dog has a bite history or severe aggression, 
please consult a certified professional.
```

### Certifications to Mention
- References to veterinary behaviorist protocols
- CCPDT (Certification Council for Professional Dog Trainers) alignment
- IAABC (International Association of Animal Behavior Consultants) standards

---

## Next Steps

### Week 1-2: Research & Validation
- [ ] Join r/reactivedogs, read 50+ posts
- [ ] Interview 5 reactive dog owners
- [ ] Survey: "What do you currently use?"
- [ ] Competitor app deep-dive

### Week 3-4: Design & Prototype (✅ Completed)
- [x] Create wireframes (Figma)
- [x] Design database schema
- [x] Set up Expo project
- [x] Supabase project setup
- [x] Implement onboarding screens

### Month 2: MVP Development (✅ Completed)
- [x] Auth & onboarding (✅ Completed)
- [x] Basic logging functionality (✅ Completed)
- [x] Progress analytics with charts (✅ Completed)
  - Line chart: Reactions over time
  - Bar chart: Triggers by type
  - Stats cards: Total reactions, avg severity, week-over-week
  - Time range selector (7/30/90 days)
- [x] BAT Training Mode (✅ Completed)
  - Pre-walk checklist & distance threshold setup
  - Active walk mode with GPS tracking
  - Technique reminders & quick logging
  - Post-walk reflection & success rating
- [ ] Beta testing with 5 users

### Month 3: Launch Prep
- [ ] Community features
- [ ] RevenueCat integration
- [ ] Beta program (50 users)
- [ ] Content creation

---

## Resources

### Learning
- BAT 2.0 by Grisha Stewart (book)
- Control Unleashed by Leslie McDevitt (book)
- r/reactivedogs wiki
- Fear Free Pets certification (optional)

### Tools
- Figma (design)
- Expo (development)
- Supabase (backend)
- RevenueCat (payments)
- PostHog (analytics)

### Community
- r/reactivedogs
- Reactive Dogs Facebook groups
- IAABC directory (behaviorist contacts)
- CCPDT trainer directory

---

## Conclusion

This app fills a genuine gap in the pet tech market. Reactive dog owners are:
- **Desperate for solutions** (high willingness to pay)
- **Under-served** (no dedicated apps)
- **Community-oriented** (word-of-mouth potential)
- **Data-motivated** (love tracking progress)

The combination of practical training tools + emotional support community creates a sticky product with clear monetization path.

**Status Update (January 2026):** MVP is now feature-complete with all core functionality implemented:

✅ **Supabase Backend** - Auth, database, and RLS policies configured
✅ **Onboarding Flow** - 5-screen flow with automatic routing
✅ **Trigger Logging** - Quick 2-tap logging with GPS coordinates
✅ **Progress Analytics** - Interactive charts, time range selection, statistics cards
✅ **BAT Training Mode** - Full walk experience with:
   - Pre-walk checklist & distance threshold configuration
   - Active walk mode with real-time GPS tracking
   - Technique reminders (U-Turn, Find It, LAT)
   - Quick trigger logging during walks
   - Post-walk reflection with success ratings

**Next Priorities:**
1. Community forum implementation
2. PDF export for behaviorist reports
3. Beta testing program launch
4. PostHog analytics integration
5. RevenueCat subscription setup
