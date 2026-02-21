-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text not null unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Games ────────────────────────────────────────────────────────────────────
create table games (
  id              uuid default uuid_generate_v4() primary key,
  created_by      uuid references profiles(id),
  phase           text not null default 'lobby'
                  check (phase in ('lobby','setup','active','ended')),
  turn_phase      text not null default 'king_demands'
                  check (turn_phase in ('king_demands','planning','events','resolution','scoring')),
  turn_number     int  not null default 1,
  max_turns       int  not null default 20,
  player_count    int  not null default 0,
  map             jsonb,                        -- WorldMap serialized
  current_king_demand jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Game players join table ──────────────────────────────────────────────────
create table game_players (
  game_id   uuid references games(id)    on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (game_id, player_id)
);

-- ─── Duchies ──────────────────────────────────────────────────────────────────
create table duchies (
  id                 uuid default uuid_generate_v4() primary key,
  game_id            uuid references games(id) on delete cascade not null,
  player_id          uuid references profiles(id) not null,
  name               text not null,
  color              text not null default '#888888',
  tiles              jsonb not null default '[]',      -- [{x,y}]
  resources          jsonb not null default '{"grain":0,"timber":0,"ore":0,"cloth":0,"fish":0,"spice":0,"gold":100}',
  population         jsonb not null default '{"total":500,"farmers":300,"artisans":100,"merchants":70,"soldiers":30,"happiness":50}',
  buildings          jsonb not null default '[]',
  kings_favor        int  not null default 50 check (kings_favor between 0 and 100),
  development_mode   text not null default 'incentivize'
                     check (development_mode in ('command','incentivize','laissez_faire')),
  spy_network        int  not null default 0  check (spy_network between 0 and 100),
  military_strength  int  not null default 10,
  turn_ready         boolean not null default false,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ─── Events log ───────────────────────────────────────────────────────────────
create table game_events (
  id         uuid default uuid_generate_v4() primary key,
  game_id    uuid references games(id) on delete cascade not null,
  turn       int  not null,
  scope      text not null check (scope in ('global','duchy','pair')),
  duchy_id   uuid references duchies(id),      -- null if global
  payload    jsonb not null,
  created_at timestamptz default now()
);

-- ─── Row-level security ───────────────────────────────────────────────────────
alter table profiles     enable row level security;
alter table games        enable row level security;
alter table game_players enable row level security;
alter table duchies      enable row level security;
alter table game_events  enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Games: all authenticated users can read; creator can update
create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (auth.uid() = created_by);
create policy "games_update" on games for update using (auth.uid() = created_by);

-- Game players: anyone can join; player can see their own row
create policy "game_players_select" on game_players for select using (true);
create policy "game_players_insert" on game_players for insert with check (auth.uid() = player_id);

-- Duchies: all players in a game can read; player can update only their duchy
create policy "duchies_select" on duchies for select using (true);
create policy "duchies_insert" on duchies for insert with check (auth.uid() = player_id);
create policy "duchies_update" on duchies for update using (auth.uid() = player_id);

-- Events: readable by all players in the game
create policy "events_select" on game_events for select using (true);

-- ─── Updated-at triggers ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger games_updated_at   before update on games   for each row execute procedure set_updated_at();
create trigger duchies_updated_at before update on duchies for each row execute procedure set_updated_at();

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime for the tables players need to subscribe to
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table duchies;
alter publication supabase_realtime add table game_events;
