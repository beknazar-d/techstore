-- WhatsApp через Wappi (wappi.pro): клиенты пишут в WhatsApp, отвечают тот же ИИ-бот и менеджер, что в Telegram.
-- Переписка — в тех же bot_chats / bot_messages, у чата появляется канал.
-- Токен Wappi — в Supabase Vault (wappi_token_*, только service_role); в bot_settings — профиль и статус номера.

-- ---------------------------------------------------------------------------
-- Чаты: канал Telegram или WhatsApp
-- ---------------------------------------------------------------------------
-- «if not exists» / «drop … if exists»: повторный запуск безопасен.
alter table public.bot_chats
  add column if not exists channel text not null default 'telegram' check (channel in ('telegram', 'whatsapp')),
  add column if not exists whatsapp_chat_id text unique check (whatsapp_chat_id is null or length(whatsapp_chat_id) between 5 and 100),
  alter column telegram_chat_id drop not null;

alter table public.bot_chats drop constraint if exists bot_chats_channel_id;
alter table public.bot_chats
  add constraint bot_chats_channel_id check (
    (channel = 'telegram' and telegram_chat_id is not null)
    or (channel = 'whatsapp' and whatsapp_chat_id is not null)
  );

-- ---------------------------------------------------------------------------
-- Заявки из WhatsApp
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders
  add constraint orders_source_check check (source in ('site', 'telegram', 'whatsapp'));

create or replace function public.create_order(
  p_product_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_type text,
  p_address text default '',
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_desired_date date default null,
  p_desired_time time default null,
  p_comment text default '',
  p_source text default 'site'
)
returns table (order_id uuid, order_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_category_active boolean;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_comment text := btrim(coalesce(p_comment, ''));
  v_has_location boolean := p_location_lat is not null and p_location_lng is not null;
  v_order public.orders%rowtype;
begin
  -- Проверка полей
  if v_name = '' then perform private.fail('validation', 'Укажите ваше имя'); end if;
  if length(v_name) > 100 then perform private.fail('validation', 'Имя — не длиннее 100 символов'); end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    perform private.fail('validation', 'Укажите корректный номер телефона');
  end if;
  if p_quantity is null or p_quantity < 1 then
    perform private.fail('validation', 'Количество должно быть не меньше 1');
  end if;
  if p_quantity > 100 then
    perform private.fail('validation', 'В одной заявке — не больше 100 шт.');
  end if;
  if p_delivery_type is null or p_delivery_type not in ('pickup', 'delivery') then
    perform private.fail('validation', 'Выберите самовывоз или доставку');
  end if;
  if p_delivery_type = 'delivery' and v_address = '' and not v_has_location then
    perform private.fail('validation', 'Укажите адрес доставки или отправьте геолокацию');
  end if;
  if length(v_address) > 300 then perform private.fail('validation', 'Адрес — не длиннее 300 символов'); end if;
  if length(v_comment) > 1000 then perform private.fail('validation', 'Комментарий — не длиннее 1000 символов'); end if;
  if v_has_location and (p_location_lat not between -90 and 90 or p_location_lng not between -180 and 180) then
    perform private.fail('validation', 'Неверные координаты');
  end if;
  -- Источники «telegram» и «whatsapp» ставят только Edge Functions бота (service_role).
  if coalesce(p_source, 'site') <> 'site' then
    if p_source not in ('telegram', 'whatsapp') or coalesce((select auth.jwt()) ->> 'role', '') <> 'service_role' then
      perform private.fail('validation', 'Неверный источник заявки');
    end if;
  end if;

  -- Блокируем товар до конца транзакции: две заявки одновременно не спишут лишнего.
  select * into v_product from public.products where id = p_product_id for update;
  if not found then perform private.fail('not_found', 'Товар не найден'); end if;

  select c.is_active into v_category_active from public.categories c where c.id = v_product.category_id;
  if not v_product.is_active or not coalesce(v_category_active, false) then
    perform private.fail('product_unavailable', 'Товар сейчас недоступен для заказа');
  end if;

  if v_product.stock < p_quantity then
    perform private.fail(
      'out_of_stock',
      case when v_product.stock = 0
        then 'Недостаточно товара на складе: товар закончился'
        else format('Недостаточно товара на складе: осталось %s шт.', v_product.stock)
      end
    );
  end if;

  update public.products set stock = stock - p_quantity where id = v_product.id;

  insert into public.orders (
    status, source, product_id, product_name, price, cost_price, quantity,
    customer_name, customer_phone, delivery_type, address, location_lat, location_lng,
    desired_date, desired_time, comment
  ) values (
    'new', coalesce(p_source, 'site'), v_product.id, v_product.name, v_product.price, v_product.cost_price, p_quantity,
    v_name, v_phone, p_delivery_type,
    case when p_delivery_type = 'delivery' then v_address else '' end,
    case when p_delivery_type = 'delivery' and v_has_location then p_location_lat end,
    case when p_delivery_type = 'delivery' and v_has_location then p_location_lng end,
    p_desired_date, p_desired_time, v_comment
  )
  returning * into v_order;

  insert into public.order_events (order_id, type, from_status, to_status, message)
  values (v_order.id, 'created', null, 'new', format('Заявка создана, со склада списано %s шт.', p_quantity));

  return query select v_order.id, v_order.number;
end;
$$;

create or replace function public.admin_stats(p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'Europe/Moscow';
  v_low_stock constant integer := 3; -- как shop.lowStockThreshold
  v_to date := (now() at time zone v_tz)::date;
  v_from date;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  perform private.require_admin();
  if p_days is null or p_days not in (7, 30, 90) then
    perform private.fail('validation', 'Период — 7, 30 или 90 дней');
  end if;

  v_from := v_to - (p_days - 1);
  v_start := v_from::timestamp at time zone v_tz;
  v_end := (v_to + 1)::timestamp at time zone v_tz;

  with o as (
    select
      ord.*,
      (ord.created_at at time zone v_tz)::date as day,
      ord.price::bigint * ord.quantity as amount,
      case when ord.cost_price is null then null
        else (ord.price - ord.cost_price)::bigint * ord.quantity end as gain
    from public.orders ord
    where ord.created_at >= v_start and ord.created_at < v_end
  ),
  done as (
    select * from o where status = 'completed'
  ),
  totals as (
    select
      coalesce(sum(amount), 0) as revenue,
      coalesce(sum(gain), 0) as profit,
      coalesce(sum(amount) filter (where gain is not null), 0) as revenue_with_cost,
      coalesce(sum(amount) filter (where gain is null), 0) as revenue_without_cost,
      count(*) as completed
    from done
  ),
  counts as (
    select
      count(*) as total,
      count(*) filter (where status = 'cancelled') as cancelled,
      count(*) filter (where status in ('new', 'confirmed')) as in_progress,
      coalesce(sum(amount) filter (where status in ('new', 'confirmed')), 0) as in_progress_value,
      count(*) filter (where source = 'site') as site,
      count(*) filter (where source = 'telegram') as telegram,
      count(*) filter (where source = 'whatsapp') as whatsapp
    from o
  ),
  days as (
    select gs::date as day from generate_series(v_from, v_to, interval '1 day') gs
  ),
  daily as (
    select
      d.day,
      coalesce(sum(o.amount) filter (where o.status = 'completed'), 0) as revenue,
      coalesce(sum(o.gain) filter (where o.status = 'completed'), 0) as profit,
      count(o.id) filter (where o.status <> 'cancelled') as orders
    from days d
    left join o on o.day = d.day
    group by d.day
  ),
  top as (
    select
      product_id,
      min(product_name) as name,
      sum(quantity) as quantity,
      sum(amount) as revenue,
      case when bool_or(gain is null) then null else sum(gain) end as profit
    from done
    -- Удалённый товар (product_id = null) группируем по названию из заказа.
    group by product_id, case when product_id is null then product_name end
    order by revenue desc
    limit 5
  ),
  ti as (
    select
      count(*) as total,
      count(*) filter (where status in ('accepted', 'completed')) as accepted
    from public.trade_ins
    where created_at >= v_start and created_at < v_end
  ),
  inv as (
    select
      coalesce(sum(stock), 0) as units,
      coalesce(sum(coalesce(cost_price, 0)::bigint * stock), 0) as cost_value,
      coalesce(sum(price::bigint * stock), 0) as retail_value,
      count(*) filter (where stock > 0 and stock <= v_low_stock) as low_stock,
      count(*) filter (where stock = 0) as out_of_stock,
      count(*) filter (where cost_price is null) as missing_cost
    from public.products
    where is_active
  )
  select jsonb_build_object(
    'period', p_days,
    'from', to_char(v_from, 'YYYY-MM-DD'),
    'to', to_char(v_to, 'YYYY-MM-DD'),
    'revenue', t.revenue,
    'profit', t.profit,
    'marginPercent', case when t.revenue_with_cost > 0
      then round(t.profit * 100.0 / t.revenue_with_cost, 1) end,
    'revenueWithoutCost', t.revenue_without_cost,
    'ordersTotal', c.total,
    'ordersCompleted', t.completed,
    'ordersCancelled', c.cancelled,
    'ordersInProgress', c.in_progress,
    'inProgressValue', c.in_progress_value,
    'averageCheck', case when t.completed > 0 then round(t.revenue::numeric / t.completed) end,
    'cancelRatePercent', case when c.total > 0 then round(c.cancelled * 100.0 / c.total, 1) end,
    'ordersBySource', jsonb_build_object('site', c.site, 'telegram', c.telegram, 'whatsapp', c.whatsapp),
    'tradeInsTotal', ti.total,
    'tradeInsAccepted', ti.accepted,
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'revenue', d.revenue,
        'profit', d.profit,
        'orders', d.orders
      ) order by d.day), '[]'::jsonb)
      from daily d
    ),
    'topProducts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'productId', tp.product_id,
        'name', tp.name,
        'quantity', tp.quantity,
        'revenue', tp.revenue,
        'profit', tp.profit
      ) order by tp.revenue desc), '[]'::jsonb)
      from top tp
    ),
    'inventory', jsonb_build_object(
      'units', i.units,
      'costValue', i.cost_value,
      'retailValue', i.retail_value,
      'lowStock', i.low_stock,
      'outOfStock', i.out_of_stock,
      'missingCost', i.missing_cost
    )
  )
  into v_result
  from totals t, counts c, ti, inv i;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Настройки WhatsApp. Подключение и статус меняет только Edge Function telegram-admin (service_role).
-- ---------------------------------------------------------------------------
alter table public.bot_settings
  add column whatsapp_connected boolean not null default false,
  add column whatsapp_enabled boolean not null default true,
  add column whatsapp_profile_id text not null default ''
    check (whatsapp_profile_id = '' or whatsapp_profile_id ~ '^[A-Za-z0-9-]{4,64}$'),
  add column whatsapp_token_hint text not null default '' check (length(whatsapp_token_hint) <= 4),
  add column whatsapp_phone text not null default '' check (whatsapp_phone = '' or whatsapp_phone ~ '^[0-9]{9,15}$'),
  add column whatsapp_status text not null default '' check (whatsapp_status in ('', 'online', 'offline')),
  add column whatsapp_paid_until timestamptz;

-- Админ сам только включает и выключает ответы в WhatsApp.
grant update (whatsapp_enabled) on public.bot_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Токен Wappi в Vault
-- ---------------------------------------------------------------------------
create or replace function public.wappi_token_set(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_.-]{20,200}$' then
    perform private.fail('validation', 'Токен не похож на токен Wappi');
  end if;
  select id into v_id from vault.secrets where name = 'wappi_token';
  if v_id is null then
    perform vault.create_secret(p_token, 'wappi_token', 'API-токен Wappi (WhatsApp)');
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end;
$$;

create or replace function public.wappi_token_get()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'wappi_token' limit 1;
$$;

create or replace function public.wappi_token_clear()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where name = 'wappi_token';
$$;

-- ---------------------------------------------------------------------------
-- Входящее сообщение из WhatsApp (как bot_receive_message, но по whatsapp_chat_id)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_receive_message(
  p_whatsapp_chat_id text,
  p_customer_name text,
  p_customer_phone text,
  p_text text,
  p_handoff_reason text default null
)
returns public.bot_chats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := left(btrim(coalesce(p_text, '')), 4096);
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
  v_chat public.bot_chats%rowtype;
begin
  if coalesce(btrim(p_whatsapp_chat_id), '') = '' then perform private.fail('validation', 'Нет chat_id'); end if;
  if v_text = '' then perform private.fail('validation', 'Пустое сообщение'); end if;

  insert into public.bot_chats (channel, whatsapp_chat_id, customer_name, customer_phone)
  values (
    'whatsapp',
    btrim(p_whatsapp_chat_id),
    left(btrim(coalesce(p_customer_name, '')), 200),
    case when length(v_phone) between 9 and 15 then '+' || v_phone else '' end
  )
  on conflict (whatsapp_chat_id) do update set
    customer_name = case when excluded.customer_name <> '' then excluded.customer_name else public.bot_chats.customer_name end,
    customer_phone = case when public.bot_chats.customer_phone = '' then excluded.customer_phone else public.bot_chats.customer_phone end
  returning * into v_chat;

  insert into public.bot_messages (chat_id, sender, text) values (v_chat.id, 'customer', v_text);

  update public.bot_chats set
    unread_count = unread_count + 1,
    last_message_text = v_text,
    last_message_at = now(),
    mode = case when p_handoff_reason is not null then 'manager' else mode end,
    handoff_reason = case when p_handoff_reason is not null then left(p_handoff_reason, 300) else handoff_reason end
  where id = v_chat.id
  returning * into v_chat;

  return v_chat;
end;
$$;

revoke all on function
  public.wappi_token_set(text), public.wappi_token_get(), public.wappi_token_clear(),
  public.whatsapp_receive_message(text, text, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.wappi_token_set(text), public.wappi_token_get(), public.wappi_token_clear(),
  public.whatsapp_receive_message(text, text, text, text, text)
to service_role;
