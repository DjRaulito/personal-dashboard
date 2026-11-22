-- Tareas con vista propia (Fondo value, Portátiles) declaran más campos: hasta 30 por tarea
alter table public.scheduled_tasks drop constraint scheduled_tasks_fields_check;
alter table public.scheduled_tasks add constraint scheduled_tasks_fields_check
  check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 30);
