-- Limpieza (plan de refactor, 18 nov 2026): se eliminan Gimnasio, Contenido, Estudio de vídeo,
-- agentes y resúmenes semanales de IA. Los datos se exportaron antes a JSON fuera del repo.
-- body_measurements se conserva: la usa Nutrición (revisiones).

-- Estudio de vídeo
drop function if exists public.studio_worker(text, uuid, text, jsonb);
drop policy if exists "studio: propios" on storage.objects;
drop table if exists public.video_jobs;
drop table if exists public.studio_settings;
-- El bucket «studio» (vacío) se borra a mano en Supabase → Storage: no se permite borrarlo por SQL.

-- Contenido
drop table if exists public.content_piece_transactions;
drop table if exists public.content_metrics;
drop table if exists public.content_pieces;

-- Agentes
drop table if exists public.agent_actions;
drop table if exists public.agent_logs;
drop table if exists public.agent_runs;
drop table if exists public.agent_tasks;
drop table if exists public.agents;

-- IA: resúmenes semanales
drop table if exists public.ai_weekly_summaries;

-- Gimnasio (los entrenos siguen en Hevy)
drop table if exists public.gym_sets;
drop table if exists public.gym_workouts;
drop table if exists public.gym_exercises;
