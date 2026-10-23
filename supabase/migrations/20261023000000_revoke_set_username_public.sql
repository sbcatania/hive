-- Functions are executable by PUBLIC by default, so revoking from anon alone
-- left set_username callable by signed-out users. Restrict it to signed-in users.
revoke execute on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
