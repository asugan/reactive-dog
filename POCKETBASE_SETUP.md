# PocketBase Schema Migration Guide

This guide documents the migration from Supabase PostgreSQL schema to PocketBase collections for the Reactive Dog App.

## Overview

Successfully migrated from Supabase SQL migrations to PocketBase JSON collections format.

**Original File:** `supabase/migrations/001_initial_schema.sql`
**Generated File:** `pocketbase_collections.json`

## Collections Structure

### 1. user_profiles
Extended user information with subscription management.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Auto-generated unique ID |
| user | relation | Reference to users collection (1-to-1) |
| subscription_tier | select | Values: `free`, `premium` |
| full_name | text | User's display name |
| username | text | Unique username |
| created | autodate | Creation timestamp |
| updated | autodate | Last update timestamp |

**Relations:**
- `user` → `users` collection (cascade delete)

### 2. dog_profiles
Dog/Pet profiles owned by users.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Auto-generated unique ID |
| owner_id | relation | Reference to users collection |
| name | text | **Required** - Dog's name |
| breed | text | Dog breed |
| age | number | Dog age in years |
| weight | number | Weight in kg |
| triggers | json | Array of trigger types |
| reactivity_level | number | 1-5 scale |
| training_method | select | BAT, CC/DS, LAT, Other |
| notes | editor | Rich text notes |
| created | autodate | Creation timestamp |
| updated | autodate | Last update timestamp |

**Relations:**
- `owner_id` → `users` collection (cascade delete)

### 3. trigger_logs
Reactive behavior incident logs.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Auto-generated unique ID |
| dog_id | relation | Reference to dog_profiles |
| owner_id | relation | Reference to users collection |
| trigger_type | select | **Required** - Dog_OffLeash, Dog_OnLeash, Human, Bike, Car, Noise, Other |
| distance_meters | number | Distance when triggered |
| severity | number | 1-5 scale |
| location_latitude | number | GPS coordinates |
| location_longitude | number | GPS coordinates |
| weather | text | Weather conditions |
| dog_energy_level | number | 1-5 scale |
| time_since_last_meal_hours | number | Hours since last feeding |
| photo_url | url | Photo evidence URL |
| notes | editor | Rich text notes |
| logged_at | date | When incident occurred |
| created | autodate | Creation timestamp |

**Relations:**
- `dog_id` → `dog_profiles` (cascade delete)
- `owner_id` → `users` (cascade delete)

### 4. walks
BAT training walk sessions.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Auto-generated unique ID |
| dog_id | relation | Reference to dog_profiles |
| owner_id | relation | Reference to users collection |
| started_at | date | **Required** - Walk start time |
| ended_at | date | Walk end time |
| distance_threshold_meters | number | Threshold distance maintained |
| success_rating | number | 1-5 scale |
| technique_used | select | U_Turn, Find_It, LAT, Other |
| notes | editor | Session notes |
| created | autodate | Creation timestamp |

**Relations:**
- `dog_id` → `dog_profiles` (cascade delete)
- `owner_id` → `users` (cascade delete)

### 5. community_posts
Community forum posts.

| Field | Type | Description |
|-------|------|-------------|
| id | text | Auto-generated unique ID |
| author_id | relation | Reference to users collection |
| title | text | **Required** - Post title |
| content | editor | **Required** - Rich text content |
| post_type | select | general, win_of_the_day, question, success_story |
| likes_count | number | Like counter (min: 0) |
| created | autodate | Creation timestamp |
| updated | autodate | Last update timestamp |

**Relations:**
- `author_id` → `users` (cascade delete)

## Import Instructions

### Step 1: Prepare PocketBase

1. Start PocketBase server
2. Access Admin UI at `http://localhost:8090/_/#/`
3. Login with admin credentials

### Step 2: Import Collections

1. Navigate to **Settings** → **Import collections**
2. Click **"Load from JSON file"**
3. Select `pocketbase_collections.json`
4. Review the changes (all 5 collections should be listed)
5. Click **Import**

### Step 3: Configure API Rules

After import, set up security rules for each collection:

#### user_profiles
```
List Rule:   user = @request.auth.id
View Rule:   user = @request.auth.id
Create Rule: user = @request.auth.id
Update Rule: user = @request.auth.id
Delete Rule: user = @request.auth.id
```

#### dog_profiles
```
List Rule:   owner_id = @request.auth.id
View Rule:   owner_id = @request.auth.id
Create Rule: owner_id = @request.auth.id
Update Rule: owner_id = @request.auth.id
Delete Rule: owner_id = @request.auth.id
```

#### trigger_logs
```
List Rule:   owner_id = @request.auth.id
View Rule:   owner_id = @request.auth.id
Create Rule: owner_id = @request.auth.id
Update Rule: owner_id = @request.auth.id
Delete Rule: owner_id = @request.auth.id
```

#### walks
```
List Rule:   owner_id = @request.auth.id
View Rule:   owner_id = @request.auth.id
Create Rule: owner_id = @request.auth.id
Update Rule: owner_id = @request.auth.id
Delete Rule: owner_id = @request.auth.id
```

#### community_posts
```
List Rule:   ""
View Rule:   ""
Create Rule: @request.auth.id != ''
Update Rule: author_id = @request.auth.id
Delete Rule: author_id = @request.auth.id
```

### Step 4: Configure Auth

1. Go to **Collections** → **users**
2. Set OAuth2 providers (Google, GitHub, etc.)
3. Disable email/password auth if only using OAuth
4. Configure allowed OAuth providers

## Usage Examples

### Create User Profile with Subscription

```javascript
// After user registration
await pb.collection('user_profiles').create({
  user: userId,
  subscription_tier: 'free',
  full_name: 'John Doe',
  username: 'johndoe'
});
```

### Create a Dog Profile

```javascript
await pb.collection('dog_profiles').create({
  owner_id: pb.authStore.model.id,
  name: 'Max',
  breed: 'Golden Retriever',
  age: 3,
  reactivity_level: 4,
  triggers: ['Dogs', 'Bikes']
});
```

### Log a Trigger Incident

```javascript
await pb.collection('trigger_logs').create({
  dog_id: dogId,
  owner_id: pb.authStore.model.id,
  trigger_type: 'Dog_OffLeash',
  severity: 3,
  location_latitude: 40.7128,
  location_longitude: -74.0060,
  notes: 'Encounter at park entrance'
});
```

### Query User's Subscription

```javascript
const profile = await pb.collection('user_profiles')
  .getFirstListItem(`user = "${userId}"`);

if (profile.subscription_tier === 'premium') {
  // Enable premium features
}
```

## Data Validation

### Check Constraints Migrated

- **reactivity_level**: 1-5 (integer)
- **severity**: 1-5 (integer)
- **dog_energy_level**: 1-5 (integer)
- **success_rating**: 1-5 (integer)
- **likes_count**: Minimum 0
- **trigger_type**: Enum validation
- **training_method**: Enum validation
- **technique_used**: Enum validation
- **post_type**: Enum validation

## Important Notes

1. **Cascade Deletes**: All user data is deleted when user is removed
2. **Unique Constraints**: `username` in user_profiles is unique
3. **Auto Timestamps**: `created` and `updated` fields auto-managed
4. **Relations**: Use PocketBase expand feature to fetch related data
5. **Auth**: Built-in users collection extended via user_profiles

## Differences from Supabase

| Feature | Supabase | PocketBase |
|---------|----------|------------|
| Auth | auth.users | Built-in users |
| Profile Extension | profiles table | user_profiles collection |
| RLS | SQL Policies | API Rules |
| Timestamps | created_at/updated_at | created/updated |
| UUID | gen_random_uuid() | Auto-generated 15-char ID |

## Troubleshooting

### Field Not Found Errors
If API rules fail with "unknown field", ensure:
- Field names match exactly (case-sensitive)
- Relation fields use correct collectionId references
- Field IDs are unique within the collection

### Import Failures
- Check JSON syntax validity
- Ensure all collectionIds reference existing collections
- Verify field type compatibility

## Next Steps

1. Set up OAuth providers in PocketBase settings
2. Configure email templates
3. Set up file storage for avatars and photos
4. Implement client-side SDK integration
5. Test all CRUD operations with different user roles
