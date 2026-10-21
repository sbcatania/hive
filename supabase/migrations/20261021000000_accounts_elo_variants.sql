-- Optional accounts (Supabase Auth email + password), Elo ratings for rated
-- online games, a cloud journal for saved games, and rule variants online.

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  rating integer not null default 1200,
  peak_rating integer not null default 1200,
  rated_games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are public" on public.profiles for select to anon, authenticated using (true);
revoke insert, update, delete on table public.profiles from anon, authenticated;

-- Creates a profile for every new account, using the requested username if it's
-- valid and free, otherwise a generated one.
create or replace function public.hive_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := coalesce(new.raw_user_meta_data ->> 'username', '');
  name text;
begin
  if wanted ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where lower(username) = lower(wanted)) then
    name := wanted;
  else
    name := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end
$$;

create trigger hive_on_auth_user_created after insert on auth.users
  for each row execute function public.hive_new_user();

create unique index profiles_username_lower on public.profiles (lower(username));

create or replace function public.set_username(p_username text) returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'Usernames are 3-20 letters, numbers or underscores'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(p_username) and id <> auth.uid()) then
    raise exception 'That username is taken';
  end if;
  update public.profiles set username = p_username where id = auth.uid();
  return p_username;
end
$$;

-- Games: players, rating and variants ----------------------------------------

alter table public.games
  add column variant jsonb,
  add column rated boolean not null default false,
  add column white_player uuid references public.profiles (id) on delete set null,
  add column black_player uuid references public.profiles (id) on delete set null,
  add column white_rating integer,
  add column black_rating integer,
  add column white_delta integer,
  add column black_delta integer,
  add column rating_applied boolean not null default false;

create index games_white_player on public.games (white_player, updated_at desc);
create index games_black_player on public.games (black_player, updated_at desc);

-- Elo with K = 40 for a player's first 20 rated games, 20 afterwards. Games
-- with fewer than two moves (aborted) don't count.
create or replace function public.hive_apply_rating(p_id text) returns void
language plpgsql volatile set search_path = '' as $$
declare
  g public.games;
  w public.profiles;
  b public.profiles;
  expected_w double precision;
  score_w double precision;
  kw integer;
  kb integer;
  dw integer;
  db integer;
begin
  select * into g from public.games where id = p_id for update;
  if not g.rated or g.rating_applied or g.status <> 'finished' or g.white_player is null or g.black_player is null
     or g.white_player = g.black_player or coalesce(array_length(g.moves, 1), 0) < 2 then
    return;
  end if;
  select * into w from public.profiles where id = g.white_player for update;
  select * into b from public.profiles where id = g.black_player for update;
  expected_w := 1.0 / (1.0 + power(10.0, (b.rating - w.rating) / 400.0));
  score_w := case g.result when 'WhiteWins' then 1.0 when 'BlackWins' then 0.0 else 0.5 end;
  kw := case when w.rated_games < 20 then 40 else 20 end;
  kb := case when b.rated_games < 20 then 40 else 20 end;
  dw := round(kw * (score_w - expected_w));
  db := round(kb * ((1 - score_w) - (1 - expected_w)));
  update public.profiles set rating = rating + dw, peak_rating = greatest(peak_rating, rating + dw), rated_games = rated_games + 1,
    wins = wins + (score_w = 1)::int, losses = losses + (score_w = 0)::int, draws = draws + (score_w = 0.5)::int
   where id = w.id;
  update public.profiles set rating = rating + db, peak_rating = greatest(peak_rating, rating + db), rated_games = rated_games + 1,
    wins = wins + (score_w = 0)::int, losses = losses + (score_w = 1)::int, draws = draws + (score_w = 0.5)::int
   where id = b.id;
  update public.games set white_rating = w.rating, black_rating = b.rating, white_delta = dw, black_delta = db, rating_applied = true
   where id = p_id;
end
$$;

create or replace function public.hive_finish(p_id text, p_result text, p_reason text) returns void
language plpgsql volatile set search_path = '' as $$
begin
  update public.games
     set status = 'finished', result = p_result, result_reason = p_reason,
         draw_offer = null, takeback_request = null, updated_at = now()
   where id = p_id;
  perform public.hive_apply_rating(p_id);
end
$$;

-- New entry point with variants and rating (the old create_game stays for
-- compatibility; PostgREST can't disambiguate overloads with defaults).
create or replace function public.new_game(
  p_game_type text, p_tournament boolean, p_color text, p_token text,
  p_base_ms integer default null, p_increment_ms integer default 0,
  p_variant jsonb default null, p_rated boolean default false
) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  new_id text;
begin
  if p_color not in ('w', 'b') then raise exception 'Invalid colour'; end if;
  if length(p_token) < 16 then raise exception 'Token too short'; end if;
  if p_rated and auth.uid() is null then raise exception 'Sign in to create a rated game'; end if;
  if p_variant is not null and (jsonb_typeof(p_variant) <> 'object' or length(p_variant::text) > 2000) then
    raise exception 'Invalid variant';
  end if;
  loop
    new_id := public.hive_new_id();
    exit when not exists (select 1 from public.games where id = new_id);
  end loop;
  insert into public.games (id, game_type, tournament, base_ms, increment_ms, white_ms, black_ms, white_joined, black_joined,
                            variant, rated, white_player, black_player)
  values (new_id, p_game_type, p_tournament, p_base_ms, coalesce(p_increment_ms, 0), p_base_ms, p_base_ms, p_color = 'w', p_color = 'b',
          p_variant, coalesce(p_rated, false),
          case when p_color = 'w' then auth.uid() end, case when p_color = 'b' then auth.uid() end);
  insert into public.game_seats (game_id, color, token_hash) values (new_id, p_color, public.hive_hash(p_token));
  return new_id;
end
$$;

-- Returns 'w' / 'b' (your seat), 'spectator', 'login_required' (rated game,
-- signed out) or 'same_account' (you can't play yourself in a rated game).
create or replace function public.join_game(p_id text, p_token text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.games;
  seat text;
  me uuid := auth.uid();
begin
  select * into g from public.games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  seat := public.hive_seat(p_id, p_token);
  if seat is not null then
    -- Link the seat to the account if the player signed in after creating it (unrated only).
    if me is not null and not g.rated then
      if seat = 'w' and g.white_player is null and g.black_player is distinct from me then
        update public.games set white_player = me where id = p_id;
      elsif seat = 'b' and g.black_player is null and g.white_player is distinct from me then
        update public.games set black_player = me where id = p_id;
      end if;
    end if;
    return seat;
  end if;
  if g.status <> 'waiting' or length(p_token) < 16 then return 'spectator'; end if;
  if g.rated and me is null then return 'login_required'; end if;
  if g.rated and me = coalesce(g.white_player, g.black_player) then return 'same_account'; end if;
  seat := case when g.white_joined then 'b' else 'w' end;
  insert into public.game_seats (game_id, color, token_hash) values (p_id, seat, public.hive_hash(p_token));
  update public.games
     set white_joined = true, black_joined = true, status = 'active', turn_started_at = now(), updated_at = now(),
         white_player = case when seat = 'w' and white_player is distinct from me then me else white_player end,
         black_player = case when seat = 'b' and black_player is distinct from me then me else black_player end
   where id = p_id;
  return seat;
end
$$;

create or replace function public.create_rematch(p_id text, p_token text, p_new_token text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
  g public.games;
  new_id text;
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  select * into g from public.games where id = p_id for update;
  if g.status <> 'finished' then raise exception 'Game is still in progress'; end if;
  if g.rematch_id is not null then return g.rematch_id; end if;
  new_id := public.new_game(g.game_type, g.tournament, case when seat = 'w' then 'b' else 'w' end, p_new_token,
                               g.base_ms, g.increment_ms, g.variant, g.rated and auth.uid() is not null);
  update public.games set rematch_id = new_id, updated_at = now() where id = p_id;
  return new_id;
end
$$;

-- Cloud journal --------------------------------------------------------------

create table public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_id text not null,
  mode text not null check (mode in ('cpu', 'local')),
  rules jsonb not null,
  moves text[] not null default '{}',
  result text check (result in ('WhiteWins', 'BlackWins', 'Draw')),
  result_reason text,
  label text,
  human_color text check (human_color in ('w', 'b')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

alter table public.saved_games enable row level security;
create policy "Own saved games: read" on public.saved_games for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own saved games: insert" on public.saved_games for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own saved games: update" on public.saved_games for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own saved games: delete" on public.saved_games for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.saved_games from anon;

-- Permissions ------------------------------------------------------------------

revoke all on function public.hive_apply_rating(text), public.hive_finish(text, text, text), public.hive_new_user() from public, anon, authenticated;
grant execute on function public.new_game(text, boolean, text, text, integer, integer, jsonb, boolean), public.join_game(text, text),
  public.create_rematch(text, text, text) to anon, authenticated;
grant execute on function public.set_username(text) to authenticated;
revoke execute on function public.set_username(text) from anon;
