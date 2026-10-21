-- Online Hive games played by shared link.
--
-- Anyone may read a game (for spectating). All writes go through SECURITY
-- DEFINER functions that check a per-seat secret token; only its SHA-256 is
-- stored, in a table clients can't read. Move legality is checked by both
-- players' browsers (the engine is client-side WebAssembly); the server
-- enforces turn order, clocks, and the game lifecycle.

create table public.games (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  game_type text not null check (game_type ~ '^Base(\+M?L?P?)?$'),
  tournament boolean not null default true,
  moves text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  result text check (result in ('WhiteWins', 'BlackWins', 'Draw')),
  result_reason text,
  white_joined boolean not null default false,
  black_joined boolean not null default false,
  base_ms integer check (base_ms is null or base_ms > 0),
  increment_ms integer not null default 0 check (increment_ms >= 0),
  white_ms bigint,
  black_ms bigint,
  turn_started_at timestamptz,
  draw_offer text check (draw_offer in ('w', 'b')),
  takeback_request text check (takeback_request in ('w', 'b')),
  rematch_id text
);

create table public.game_seats (
  game_id text not null references public.games (id) on delete cascade,
  color text not null check (color in ('w', 'b')),
  token_hash text not null,
  primary key (game_id, color)
);

alter table public.games enable row level security;
alter table public.game_seats enable row level security;

create policy "Games are public to read" on public.games for select to anon, authenticated using (true);
-- game_seats has no policies: only the functions below can touch it.

alter publication supabase_realtime add table public.games;

-- Helpers ------------------------------------------------------------------

create or replace function public.hive_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create or replace function public.hive_seat(p_id text, p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select color from public.game_seats where game_id = p_id and token_hash = public.hive_hash(p_token)
$$;

create or replace function public.hive_new_id() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end
$$;

-- Lifecycle ----------------------------------------------------------------

create or replace function public.create_game(
  p_game_type text, p_tournament boolean, p_color text, p_token text,
  p_base_ms integer default null, p_increment_ms integer default 0
) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  new_id text;
begin
  if p_color not in ('w', 'b') then raise exception 'Invalid colour'; end if;
  if length(p_token) < 16 then raise exception 'Token too short'; end if;
  loop
    new_id := public.hive_new_id();
    exit when not exists (select 1 from public.games where id = new_id);
  end loop;
  insert into public.games (id, game_type, tournament, base_ms, increment_ms, white_ms, black_ms, white_joined, black_joined)
  values (new_id, p_game_type, p_tournament, p_base_ms, coalesce(p_increment_ms, 0), p_base_ms, p_base_ms, p_color = 'w', p_color = 'b');
  insert into public.game_seats (game_id, color, token_hash) values (new_id, p_color, public.hive_hash(p_token));
  return new_id;
end
$$;

-- Returns the caller's colour ('w' / 'b'), claiming the free seat if there is
-- one, or 'spectator'.
create or replace function public.join_game(p_id text, p_token text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.games;
  seat text;
begin
  select * into g from public.games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  seat := public.hive_seat(p_id, p_token);
  if seat is not null then return seat; end if;
  if g.status <> 'waiting' or length(p_token) < 16 then return 'spectator'; end if;
  seat := case when g.white_joined then 'b' else 'w' end;
  insert into public.game_seats (game_id, color, token_hash) values (p_id, seat, public.hive_hash(p_token));
  update public.games
     set white_joined = true, black_joined = true, status = 'active',
         turn_started_at = now(), updated_at = now()
   where id = p_id;
  return seat;
end
$$;

create or replace function public.hive_finish(p_id text, p_result text, p_reason text) returns void
language sql volatile set search_path = '' as $$
  update public.games
     set status = 'finished', result = p_result, result_reason = p_reason,
         draw_offer = null, takeback_request = null, updated_at = now()
   where id = p_id
$$;

-- Deducts thinking time from the side to move; finishes the game on flag.
-- Returns false if the side to move has run out of time.
create or replace function public.hive_tick(p_id text) returns boolean
language plpgsql volatile set search_path = '' as $$
declare
  g public.games;
  mover text;
  left_ms bigint;
begin
  select * into g from public.games where id = p_id;
  if g.base_ms is null or g.status <> 'active' then return true; end if;
  mover := case when coalesce(array_length(g.moves, 1), 0) % 2 = 0 then 'w' else 'b' end;
  left_ms := (case when mover = 'w' then g.white_ms else g.black_ms end)
             - floor(extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint;
  if left_ms <= 0 then
    if mover = 'w' then
      update public.games set white_ms = 0 where id = p_id;
    else
      update public.games set black_ms = 0 where id = p_id;
    end if;
    perform public.hive_finish(p_id, case when mover = 'w' then 'BlackWins' else 'WhiteWins' end, 'time');
    return false;
  end if;
  if mover = 'w' then
    update public.games set white_ms = left_ms + g.increment_ms where id = p_id;
  else
    update public.games set black_ms = left_ms + g.increment_ms where id = p_id;
  end if;
  return true;
end
$$;

-- p_ply must equal the number of moves already played (guards against races).
-- p_result is set by the mover's client when the move ends the game.
create or replace function public.play_move(
  p_id text, p_token text, p_ply integer, p_move text,
  p_result text default null, p_reason text default null
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.games;
  seat text;
  n integer;
begin
  select * into g from public.games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  if g.status <> 'active' then raise exception 'Game is not in progress'; end if;
  seat := public.hive_seat(p_id, p_token);
  n := coalesce(array_length(g.moves, 1), 0);
  if seat is null then raise exception 'You are not playing in this game'; end if;
  if seat <> (case when n % 2 = 0 then 'w' else 'b' end) then raise exception 'It is not your turn'; end if;
  if p_ply <> n then raise exception 'Out of sync; reload the game'; end if;
  if length(p_move) > 24 or p_move !~ '^(pass|[wb][QSBGAMLP][1-3]?( [-/\\]?[wb][QSBGAMLP][1-3]?[-/\\]?)?)$' then
    raise exception 'Malformed move';
  end if;
  if not public.hive_tick(p_id) then return n; end if;
  update public.games
     set moves = array_append(moves, p_move), turn_started_at = now(), updated_at = now(),
         draw_offer = case when draw_offer = seat then draw_offer else null end,
         takeback_request = null
   where id = p_id;
  if p_result in ('WhiteWins', 'BlackWins', 'Draw') then
    perform public.hive_finish(p_id, p_result, coalesce(p_reason, 'surround'));
  end if;
  return n + 1;
end
$$;

create or replace function public.claim_timeout(p_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  g public.games;
  mover text;
  left_ms bigint;
begin
  select * into g from public.games where id = p_id for update;
  if not found or g.status <> 'active' or g.base_ms is null then return false; end if;
  mover := case when coalesce(array_length(g.moves, 1), 0) % 2 = 0 then 'w' else 'b' end;
  left_ms := (case when mover = 'w' then g.white_ms else g.black_ms end)
             - floor(extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint;
  if left_ms > 0 then return false; end if;
  perform public.hive_tick(p_id);
  return true;
end
$$;

create or replace function public.resign_game(p_id text, p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  if not exists (select 1 from public.games where id = p_id and status = 'active') then raise exception 'Game is not in progress'; end if;
  perform public.hive_finish(p_id, case when seat = 'w' then 'BlackWins' else 'WhiteWins' end, 'resignation');
end
$$;

-- Offering when the opponent has already offered accepts the draw.
create or replace function public.offer_draw(p_id text, p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
  g public.games;
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  select * into g from public.games where id = p_id for update;
  if g.status <> 'active' then raise exception 'Game is not in progress'; end if;
  if g.draw_offer is not null and g.draw_offer <> seat then
    perform public.hive_finish(p_id, 'Draw', 'agreement');
  else
    update public.games set draw_offer = seat, updated_at = now() where id = p_id;
  end if;
end
$$;

create or replace function public.decline_draw(p_id text, p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  update public.games set draw_offer = null, updated_at = now() where id = p_id and draw_offer is not null and draw_offer <> seat;
end
$$;

create or replace function public.request_takeback(p_id text, p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
  g public.games;
  n integer;
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  select * into g from public.games where id = p_id for update;
  n := coalesce(array_length(g.moves, 1), 0);
  if g.status <> 'active' then raise exception 'Game is not in progress'; end if;
  -- You need at least one move of your own to take back.
  if (seat = 'w' and n < 1) or (seat = 'b' and n < 2) then raise exception 'Nothing to take back'; end if;
  update public.games set takeback_request = seat, updated_at = now() where id = p_id;
end
$$;

-- Accepting undoes the requester's last move (and the reply after it, if any).
create or replace function public.answer_takeback(p_id text, p_token text, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  seat text := public.hive_seat(p_id, p_token);
  g public.games;
  n integer;
  last_mover text;
  drop_n integer;
begin
  if seat is null then raise exception 'You are not playing in this game'; end if;
  select * into g from public.games where id = p_id for update;
  if g.status <> 'active' or g.takeback_request is null or g.takeback_request = seat then return; end if;
  if not p_accept then
    update public.games set takeback_request = null, updated_at = now() where id = p_id;
    return;
  end if;
  n := coalesce(array_length(g.moves, 1), 0);
  last_mover := case when (n - 1) % 2 = 0 then 'w' else 'b' end;
  drop_n := case when last_mover = g.takeback_request then 1 else 2 end;
  if drop_n > n then drop_n := n; end if;
  update public.games
     set moves = moves[1:n - drop_n], takeback_request = null, draw_offer = null,
         turn_started_at = now(), updated_at = now()
   where id = p_id;
end
$$;

-- Creates a follow-up game with colours swapped; the opponent finds it via rematch_id.
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
  new_id := public.create_game(g.game_type, g.tournament, case when seat = 'w' then 'b' else 'w' end, p_new_token, g.base_ms, g.increment_ms);
  update public.games set rematch_id = new_id, updated_at = now() where id = p_id;
  return new_id;
end
$$;

create or replace function public.server_now() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

-- Only the RPC entry points are callable by clients.
revoke all on function public.hive_hash(text), public.hive_seat(text, text), public.hive_new_id(),
  public.hive_finish(text, text, text), public.hive_tick(text) from public, anon, authenticated;
revoke all on table public.game_seats from anon, authenticated;
revoke insert, update, delete on table public.games from anon, authenticated;
grant execute on function public.create_game(text, boolean, text, text, integer, integer), public.join_game(text, text),
  public.play_move(text, text, integer, text, text, text), public.claim_timeout(text), public.resign_game(text, text),
  public.offer_draw(text, text), public.decline_draw(text, text), public.request_takeback(text, text),
  public.answer_takeback(text, text, boolean), public.create_rematch(text, text, text), public.server_now()
  to anon, authenticated;
