-- Phone Market — начальная схема.
-- Таблицы, ограничения, индексы, RLS. Бизнес-логика (склад, заказы, trade-in) —
-- в следующей миграции (функции).
--
-- Доступ:
--   anon          — читает активные категории и товары (без min_price), создаёт заявки только через RPC.
--   authenticated — то же; администратор (есть в public.admins) — полный доступ на чтение
--                   и запись справочников; заказы/trade-in меняет только через RPC.
--   service_role  — Edge Functions (Telegram-бот, загрузка фото).

-- ---------------------------------------------------------------------------
-- Служебная схема: не открыта через API, только хелперы для политик и триггеров.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Администраторы
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Администратор = пользователь Supabase Auth, который есть в этой таблице. Добавляется вручную.';

-- Проверка «текущий пользователь — админ». security definer: читает admins в обход RLS.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Категории
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Шаблон характеристик: [{ "key", "label", "unit"?, "type", "options"? }]
  spec_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(spec_fields) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_sort_idx on public.categories (sort_order, name);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Товары
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  -- restrict: категорию с товарами удалить нельзя («Сначала перенесите или удалите товары»).
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text not null default '',
  description text not null default '',
  condition text not null default 'new' check (condition in ('new', 'used')),
  -- Только у Б/У: { grade, batteryHealth?, warrantyMonths?, defects?, kit? }
  used_info jsonb,
  price integer not null check (price >= 0),
  -- Нижняя граница торга для бота. Анониму не отдаётся (см. права на колонки ниже).
  min_price integer check (min_price >= 0),
  -- Себестоимость (закупка) за штуку. Тоже только для админа.
  cost_price integer check (cost_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  images text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_used_info_valid check (
    (condition = 'used') = (used_info is not null)
    and (used_info is null or used_info ->> 'grade' in ('excellent', 'good', 'fair'))
  ),
  constraint products_min_price_le_price check (min_price is null or min_price <= price),
  constraint products_images_limit check (cardinality(images) <= 10)
);

create index products_category_id_idx on public.products (category_id);
create index products_active_created_idx on public.products (created_at desc) where is_active;

create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Заказы (заявки на товар) и их история
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity (start with 1001) unique,
  status text not null default 'new' check (status in ('new', 'confirmed', 'completed', 'cancelled')),
  source text not null default 'site' check (source in ('site', 'telegram')),
  -- set null: при удалении товара заказ остаётся, название и цена сохранены копией.
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  price integer not null check (price >= 0),
  -- Себестоимость за штуку на момент заказа — для прибыли. null — не была указана.
  cost_price integer check (cost_price >= 0),
  quantity integer not null check (quantity > 0),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 100),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{9,15}$'),
  delivery_type text not null check (delivery_type in ('pickup', 'delivery')),
  address text not null default '' check (length(address) <= 300),
  location_lat double precision check (location_lat between -90 and 90),
  location_lng double precision check (location_lng between -180 and 180),
  desired_date date,
  desired_time time,
  comment text not null default '' check (length(comment) <= 1000),
  admin_note text not null default '' check (length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_location_pair check ((location_lat is null) = (location_lng is null))
);

create index orders_product_id_idx on public.orders (product_id);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null check (type in ('created', 'status_changed', 'cancelled', 'note_updated')),
  from_status text,
  to_status text,
  message text not null,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Trade-in и история
-- ---------------------------------------------------------------------------
create table public.trade_ins (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity (start with 501) unique,
  status text not null default 'new'
    check (status in ('new', 'evaluated', 'accepted', 'rejected', 'completed')),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 100),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{9,15}$'),
  -- Устройство клиента: { category, brand, model, memory?, grade, batteryHealth?, defects?, kit? }
  device jsonb not null check (
    jsonb_typeof(device) = 'object'
    and device ->> 'category' in ('smartphone', 'laptop', 'watch', 'other')
    and device ->> 'grade' in ('excellent', 'good', 'fair')
    and length(btrim(coalesce(device ->> 'brand', ''))) > 0
    and length(btrim(coalesce(device ->> 'model', ''))) > 0
  ),
  -- Только ссылки на фото (R2), не data URL: база не хранит файлы.
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  desired_product_id uuid references public.products (id) on delete set null,
  desired_product_name text not null default '',
  desired_product_price integer check (desired_product_price >= 0),
  comment text not null default '' check (length(comment) <= 1000),
  admin_estimate integer check (admin_estimate > 0),
  admin_note text not null default '' check (length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trade_ins_desired_product_id_idx on public.trade_ins (desired_product_id);
create index trade_ins_created_idx on public.trade_ins (created_at desc);
create index trade_ins_status_created_idx on public.trade_ins (status, created_at desc);

create trigger trade_ins_updated_at
  before update on public.trade_ins
  for each row execute function private.set_updated_at();

create table public.trade_in_events (
  id uuid primary key default gen_random_uuid(),
  trade_in_id uuid not null references public.trade_ins (id) on delete cascade,
  type text not null check (type in ('created', 'evaluated', 'status_changed', 'note_updated')),
  from_status text,
  to_status text,
  message text not null,
  created_at timestamptz not null default now()
);

create index trade_in_events_trade_in_id_idx on public.trade_in_events (trade_in_id, created_at);

-- ---------------------------------------------------------------------------
-- Telegram-бот: настройки (одна строка), чаты, сообщения
-- ---------------------------------------------------------------------------
create table public.bot_settings (
  -- Всегда одна строка: id = true.
  id boolean primary key default true check (id),
  -- connected и token_hint меняет только Edge Function telegram-setup (service_role).
  -- Сам токен здесь не хранится — он в секретах Edge Functions.
  connected boolean not null default false,
  token_hint text not null default '' check (length(token_hint) <= 4),
  bot_username text not null default '' check (bot_username = '' or bot_username ~ '^[A-Za-z][A-Za-z0-9_]{3,31}$'),
  is_enabled boolean not null default true,
  group_id text not null default '' check (group_id = '' or group_id ~ '^-?[0-9]{5,20}$'),
  notify jsonb not null default
    '{"newOrder": true, "orderStatus": true, "newTradeIn": true, "lowStock": true}'::jsonb
    check (jsonb_typeof(notify) = 'object'),
  ai_enabled boolean not null default true,
  greeting text not null default '' check (length(greeting) <= 1000),
  ai_instructions text not null default '' check (length(ai_instructions) <= 4000),
  allow_bargaining boolean not null default true,
  allow_orders boolean not null default true,
  handoff_to_manager boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger bot_settings_updated_at
  before update on public.bot_settings
  for each row execute function private.set_updated_at();

insert into public.bot_settings (greeting, ai_instructions) values (
  'Здравствуйте! Я помощник магазина. Подскажу по наличию и ценам, помогу оформить заявку. Оплата — при получении.',
  'Отвечай коротко и вежливо, на «вы». Цены и наличие бери только из каталога, не выдумывай. '
    || 'Онлайн-оплаты нет — оплата при получении. Если не знаешь ответа — позови менеджера.'
);

create table public.bot_chats (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null unique,
  customer_name text not null default '',
  telegram_username text not null default '',
  customer_phone text not null default '',
  mode text not null default 'bot' check (mode in ('bot', 'manager', 'closed')),
  handoff_reason text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_text text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index bot_chats_last_message_idx on public.bot_chats (last_message_at desc);
create index bot_chats_mode_idx on public.bot_chats (mode, last_message_at desc);
create index bot_chats_order_id_idx on public.bot_chats (order_id);

create table public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.bot_chats (id) on delete cascade,
  sender text not null check (sender in ('customer', 'bot', 'manager')),
  text text not null check (length(text) between 1 and 4096),
  created_at timestamptz not null default now()
);

create index bot_messages_chat_idx on public.bot_messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.trade_ins enable row level security;
alter table public.trade_in_events enable row level security;
alter table public.bot_settings enable row level security;
alter table public.bot_chats enable row level security;
alter table public.bot_messages enable row level security;

-- Аноним ничего не пишет напрямую — только через RPC (security definer).
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- admins: пользователь видит только свою строку (так клиент проверяет «я админ?»).
create policy "admins: read own row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- categories
create policy "categories: read active or admin" on public.categories
  for select to anon, authenticated
  using (is_active or (select private.is_admin()));

create policy "categories: admin insert" on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy "categories: admin update" on public.categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "categories: admin delete" on public.categories
  for delete to authenticated using ((select private.is_admin()));

-- products: клиент видит только активные товары из активных категорий.
create policy "products: read active or admin" on public.products
  for select to anon, authenticated
  using (
    (
      is_active
      and exists (
        select 1 from public.categories c where c.id = category_id and c.is_active
      )
    )
    or (select private.is_admin())
  );

create policy "products: admin insert" on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy "products: admin update" on public.products
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "products: admin delete" on public.products
  for delete to authenticated using ((select private.is_admin()));

-- min_price и cost_price анониму не отдаём: RLS режет строки, а не колонки, поэтому — права на колонки.
-- Клиентский код запрашивает товары явным списком колонок (select=*, у анона упадёт).
revoke select on public.products from anon;
grant select (
  id, category_id, name, slug, brand, description, condition, used_info,
  price, stock, is_active, images, specs, created_at, updated_at
) on public.products to anon;

-- orders / trade_ins и история: читает только админ, пишут только RPC.
create policy "orders: admin read" on public.orders
  for select to authenticated using ((select private.is_admin()));
create policy "order_events: admin read" on public.order_events
  for select to authenticated using ((select private.is_admin()));
create policy "trade_ins: admin read" on public.trade_ins
  for select to authenticated using ((select private.is_admin()));
create policy "trade_in_events: admin read" on public.trade_in_events
  for select to authenticated using ((select private.is_admin()));

revoke insert, update, delete, truncate
  on public.orders, public.order_events, public.trade_ins, public.trade_in_events
  from authenticated;

-- bot_settings: админ читает и меняет всё, кроме connected/token_hint (это делает Edge Function).
create policy "bot_settings: admin read" on public.bot_settings
  for select to authenticated using ((select private.is_admin()));
create policy "bot_settings: admin update" on public.bot_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke insert, update, delete, truncate on public.bot_settings from authenticated;
grant update (
  bot_username, is_enabled, group_id, notify, ai_enabled, greeting, ai_instructions,
  allow_bargaining, allow_orders, handoff_to_manager
) on public.bot_settings to authenticated;

-- bot_chats: админ читает и меняет режим/непрочитанные. Новые чаты и сообщения
-- создаёт Edge Function (webhook бота, отправка ответа менеджера).
create policy "bot_chats: admin read" on public.bot_chats
  for select to authenticated using ((select private.is_admin()));
create policy "bot_chats: admin update" on public.bot_chats
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke insert, update, delete, truncate on public.bot_chats from authenticated;
grant update (mode, handoff_reason, unread_count) on public.bot_chats to authenticated;

create policy "bot_messages: admin read" on public.bot_messages
  for select to authenticated using ((select private.is_admin()));

revoke insert, update, delete, truncate on public.bot_messages from authenticated;
revoke insert, update, delete, truncate on public.admins from authenticated;
