-- Reactive Dog App Database Schema

-- Enable RLS
alter table if exists profiles enable row level security;
alter table if exists triggers enable row level security;
alter table if exists walks enable row level security;

-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  subscription_tier text default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Dog profiles table
create table if not exists dog_profiles (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  breed text,
  age integer,
  weight numeric,
  triggers text[] default '{}',
  reactivity_level integer check (reactivity_level between 1 and 5),
  training_method text check (training_method in ('BAT', 'CC/DS', 'LAT', 'Other')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger logs table
create table if not exists trigger_logs (
  id uuid default gen_random_uuid() primary key,
  dog_id uuid references dog_profiles(id) on delete cascade not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  trigger_type text not null check (trigger_type in ('Dog_OffLeash', 'Dog_OnLeash', 'Human', 'Bike', 'Car', 'Noise', 'Other')),
  distance_meters numeric,
  severity integer check (severity between 1 and 5),
  location_latitude numeric,
  location_longitude numeric,
  weather text,
  dog_energy_level integer check (dog_energy_level between 1 and 5),
  time_since_last_meal_hours numeric,
  photo_url text,
  notes text,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Walks table (for BAT sessions)
create table if not exists walks (
  id uuid default gen_random_uuid() primary key,
  dog_id uuid references dog_profiles(id) on delete cascade not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  distance_threshold_meters numeric,
  success_rating integer check (success_rating between 1 and 5),
  technique_used text check (technique_used in ('U_Turn', 'Find_It', 'LAT', 'Other')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Community posts table
create table if not exists community_posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  post_type text default 'general' check (post_type in ('general', 'win_of_the_day', 'question', 'success_story')),
  likes_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies

-- Profiles: Users can read all profiles, update only their own
create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Dog profiles: Only owner can CRUD
create policy "Dog profiles viewable by owner"
  on dog_profiles for select
  using (auth.uid() = owner_id);

create policy "Dog profiles insertable by owner"
  on dog_profiles for insert
  with check (auth.uid() = owner_id);

create policy "Dog profiles updatable by owner"
  on dog_profiles for update
  using (auth.uid() = owner_id);

create policy "Dog profiles deletable by owner"
  on dog_profiles for delete
  using (auth.uid() = owner_id);

-- Trigger logs: Only owner can CRUD
create policy "Trigger logs viewable by owner"
  on trigger_logs for select
  using (auth.uid() = owner_id);

create policy "Trigger logs insertable by owner"
  on trigger_logs for insert
  with check (auth.uid() = owner_id);

create policy "Trigger logs updatable by owner"
  on trigger_logs for update
  using (auth.uid() = owner_id);

create policy "Trigger logs deletable by owner"
  on trigger_logs for delete
  using (auth.uid() = owner_id);

-- Walks: Only owner can CRUD
create policy "Walks viewable by owner"
  on walks for select
  using (auth.uid() = owner_id);

create policy "Walks insertable by owner"
  on walks for insert
  with check (auth.uid() = owner_id);

create policy "Walks updatable by owner"
  on walks for update
  using (auth.uid() = owner_id);

create policy "Walks deletable by owner"
  on walks for delete
  using (auth.uid() = owner_id);

-- Community posts: Everyone can read, authenticated users can create
create policy "Community posts viewable by everyone"
  on community_posts for select
  using (true);

create policy "Authenticated users can create posts"
  on community_posts for insert
  with check (auth.uid() = author_id);

create policy "Users can update own posts"
  on community_posts for update
  using (auth.uid() = author_id);

create policy "Users can delete own posts"
  on community_posts for delete
  using (auth.uid() = author_id);

-- Functions

-- Update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

create trigger update_dog_profiles_updated_at
  before update on dog_profiles
  for each row execute function update_updated_at_column();

create trigger update_community_posts_updated_at
  before update on community_posts
  for each row execute function update_updated_at_column();

-- Function to handle new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
