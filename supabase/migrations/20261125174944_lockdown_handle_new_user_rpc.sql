-- Trigger-only profile creation function should not be callable via PostgREST RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
