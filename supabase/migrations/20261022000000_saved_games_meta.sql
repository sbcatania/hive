-- Extra per-game details for saved CPU / pass-and-play games: CPU level, clock, and
-- help used (hints, takebacks, evaluation) so "clean wins" survive across devices.
-- Additive: existing rows get null.
alter table public.saved_games add column if not exists meta jsonb;
