-- Прочие расходы магазина (аренда, реклама, доставка, зарплата и т.п.) для статистики.
-- Вносит и видит только админ. Прибыль после расходов считает страница статистики:
-- прибыль по заказам за период минус сумма расходов за тот же период.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0 and amount <= 1000000000),
  comment text not null check (length(btrim(comment)) between 1 and 500),
  -- День расхода (по Москве, как и статистика заказов).
  spent_on date not null default (now() at time zone 'Europe/Moscow')::date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;

create policy "expenses: admin read" on public.expenses
  for select to authenticated using ((select private.is_admin()));
create policy "expenses: admin insert" on public.expenses
  for insert to authenticated with check ((select private.is_admin()));
create policy "expenses: admin update" on public.expenses
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "expenses: admin delete" on public.expenses
  for delete to authenticated using ((select private.is_admin()));

revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
