-- rls_auto_enable() la crea Supabase para activar RLS automáticamente (event trigger).
-- No debe poder llamarse por la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
