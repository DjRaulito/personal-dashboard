-- Alimentos cocidos enlazados a su versión en crudo: el plan pesa siempre en crudo
-- (arroz ×2,5, pasta ×2…). Peso cocido = peso crudo × cooked_factor.
alter table public.nutrition_foods
  add column cooked_from uuid references public.nutrition_foods (id) on delete set null,
  add column cooked_factor numeric(4, 2) check (cooked_factor > 0 and cooked_factor < 10),
  add constraint nutrition_foods_cooked_pair check ((cooked_from is null) = (cooked_factor is null));

create index nutrition_foods_cooked_from_idx on public.nutrition_foods (cooked_from);
