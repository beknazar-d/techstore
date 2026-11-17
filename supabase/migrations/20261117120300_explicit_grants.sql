-- Явные права на таблицы.
-- Новые проекты Supabase не выдают anon/authenticated доступ к таблицам автоматически,
-- а локальный стек выдаёт. Чтобы боевая и локальная базы вели себя одинаково,
-- снимаем всё и выдаём ровно нужное. Строки дополнительно режет RLS.

revoke all on all tables in schema public from anon, authenticated;

-- Клиенты (anon) и вошедшие: каталог. У товаров анониму — без min_price и cost_price.
grant select on public.categories to anon, authenticated;
grant select (
  id, category_id, name, slug, brand, description, condition, used_info,
  price, stock, is_active, images, specs, created_at, updated_at
) on public.products to anon;

-- Админ (RLS проверяет private.is_admin()): справочники целиком.
grant select, insert, update, delete on public.categories, public.products to authenticated;

-- Заказы, trade-in, история, бот: админ только читает, пишут RPC и Edge Functions.
grant select on
  public.orders, public.order_events, public.trade_ins, public.trade_in_events,
  public.bot_settings, public.bot_chats, public.bot_messages, public.admins
to authenticated;

grant update (
  bot_username, is_enabled, group_id, notify, ai_enabled, greeting, ai_instructions,
  allow_bargaining, allow_orders, handoff_to_manager
) on public.bot_settings to authenticated;

grant update (mode, handoff_reason, unread_count) on public.bot_chats to authenticated;

-- Edge Functions (Telegram-бот, загрузка фото) работают с ключом service_role.
grant all on all tables in schema public to service_role;
