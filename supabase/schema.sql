-- MoodFlix database setup.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- 1. One row per user: display name and favourite genres.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  fav_genres int[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 2. What each user thinks of a movie: liked / disliked / seen (one status per movie).
create table if not exists public.user_movies (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id int not null,
  status text not null check (status in ('liked', 'disliked', 'seen')),
  title text,
  poster_path text,
  genre_ids int[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- 3. Everything a user watched in a Watch Party (one row per viewing).
create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id int,                         -- null for pasted links that aren't a TMDB movie
  title text not null,
  poster_path text,
  genre_ids int[] not null default '{}',
  kind text not null default 'video',   -- 'trailer' or 'video'
  room_code text,
  people int,                           -- how many were in the room
  watched_at timestamptz not null default now()
);
create index if not exists watch_history_user_time on public.watch_history (user_id, watched_at desc);

-- Row Level Security: every user can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.user_movies enable row level security;
alter table public.watch_history enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "own movies" on public.user_movies;
create policy "own movies" on public.user_movies
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own history" on public.watch_history;
create policy "own history" on public.watch_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Make sure logged-in users can reach these tables through the API.
grant select, insert, update, delete on public.profiles, public.user_movies, public.watch_history to authenticated;
