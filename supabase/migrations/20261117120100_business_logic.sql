-- Бизнес-логика: склад, заказы, trade-in. Повторяет правила локальной версии (src/api/).
--
-- Все функции — security definer с пустым search_path: работают в обход RLS,
-- поэтому каждая админская функция сама проверяет private.is_admin().
--
-- Ошибки: raise exception с русским текстом (его можно показывать) и кодом в HINT:
--   validation | not_found | product_unavailable | out_of_stock | invalid_transition | auth
-- Фронтенд (src/api/) переводит HINT в ApiError.code.

-- ---------------------------------------------------------------------------
-- Хелперы
-- ---------------------------------------------------------------------------
create or replace function private.fail(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = p_message, hint = p_code, errcode = 'P0001';
end;
$$;

create or replace function private.require_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    perform private.fail('auth', 'Нужно войти в админку');
  end if;
end;
$$;

create or replace function private.order_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new' then 'Новый'
    when 'confirmed' then 'Подтверждён'
    when 'completed' then 'Выполнен'
    when 'cancelled' then 'Отменён'
    else p_status
  end;
$$;

create or replace function private.trade_in_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new' then 'Новая'
    when 'evaluated' then 'Оценена'
    when 'accepted' then 'Клиент согласен'
    when 'rejected' then 'Отказ'
    when 'completed' then 'Завершена'
    else p_status
  end;
$$;

-- 18000 → «18 000 ₽»
create or replace function private.format_price(p_value integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(to_char(p_value, 'FM999,999,999,999'), ',', ' ') || ' ₽';
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Заказы
-- ---------------------------------------------------------------------------

-- Создание заявки (доступно без входа). Одна транзакция:
-- блокирует строку товара → проверяет остаток → списывает → создаёт заказ → пишет историю.
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
  -- Источник «telegram» ставит только Edge Function бота (service_role).
  if coalesce(p_source, 'site') <> 'site' then
    if p_source <> 'telegram' or coalesce((select auth.jwt()) ->> 'role', '') <> 'service_role' then
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

-- Отмена: возвращает товар на склад ровно один раз. Повторная отмена ничего не делает.
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_from text;
  v_returned boolean := false;
begin
  perform private.require_admin();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform private.fail('not_found', 'Заказ не найден'); end if;
  if v_order.status = 'cancelled' then return v_order; end if;
  if v_order.status = 'completed' then
    perform private.fail('invalid_transition', 'Выполненный заказ отменить нельзя');
  end if;

  v_from := v_order.status;

  if v_order.product_id is not null then
    update public.products set stock = stock + v_order.quantity where id = v_order.product_id;
    v_returned := found;
  end if;

  update public.orders set status = 'cancelled' where id = v_order.id returning * into v_order;

  insert into public.order_events (order_id, type, from_status, to_status, message)
  values (
    v_order.id, 'cancelled', v_from, 'cancelled',
    case when v_returned
      then format('Заказ отменён, на склад возвращено %s шт.', v_order.quantity)
      else 'Заказ отменён (товар удалён из каталога, на склад ничего не возвращено)'
    end
  );

  return v_order;
end;
$$;

-- Смена статуса: new → confirmed → completed (или сразу new → completed). cancelled = cancel_order.
create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_from text;
  v_allowed text[];
begin
  perform private.require_admin();
  if p_status = 'cancelled' then
    return public.cancel_order(p_order_id);
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform private.fail('not_found', 'Заказ не найден'); end if;

  v_allowed := case v_order.status
    when 'new' then array['confirmed', 'completed']
    when 'confirmed' then array['completed']
    else array[]::text[]
  end;
  if p_status is null or not (p_status = any (v_allowed)) then
    perform private.fail(
      'invalid_transition',
      format('Нельзя перевести заказ из статуса «%s» в «%s»',
        private.order_status_label(v_order.status), private.order_status_label(p_status))
    );
  end if;

  v_from := v_order.status;
  update public.orders set status = p_status where id = v_order.id returning * into v_order;

  insert into public.order_events (order_id, type, from_status, to_status, message)
  values (
    v_order.id, 'status_changed', v_from, p_status,
    format('Статус: %s → %s', private.order_status_label(v_from), private.order_status_label(p_status))
  );

  return v_order;
end;
$$;

create or replace function public.set_order_admin_note(p_order_id uuid, p_note text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  perform private.require_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform private.fail('not_found', 'Заказ не найден'); end if;
  if v_order.admin_note = v_note then return v_order; end if;

  update public.orders set admin_note = v_note where id = v_order.id returning * into v_order;
  insert into public.order_events (order_id, type, message)
  values (v_order.id, 'note_updated',
    case when v_note = '' then 'Заметка администратора удалена' else 'Заметка администратора изменена' end);
  return v_order;
end;
$$;

-- Ручная корректировка остатка (приход, списание брака). Атомарно, без гонок.
create or replace function public.adjust_stock(p_product_id uuid, p_delta integer)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  perform private.require_admin();
  if p_delta is null then perform private.fail('validation', 'Изменение остатка — целое число'); end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then perform private.fail('not_found', 'Товар не найден'); end if;
  if v_product.stock + p_delta < 0 then
    perform private.fail('out_of_stock',
      format('Нельзя списать больше, чем есть на складе (%s шт.)', v_product.stock));
  end if;

  update public.products set stock = stock + p_delta where id = v_product.id returning * into v_product;
  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trade-in
-- ---------------------------------------------------------------------------

-- Заявка на trade-in (доступно без входа). Склад не трогает.
create or replace function public.create_trade_in(
  p_customer_name text,
  p_customer_phone text,
  p_device jsonb,
  p_photos text[] default '{}',
  p_desired_product_id uuid default null,
  p_comment text default ''
)
returns table (trade_in_id uuid, trade_in_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_comment text := btrim(coalesce(p_comment, ''));
  v_photos text[] := coalesce(p_photos, '{}');
  v_battery jsonb := p_device -> 'batteryHealth';
  v_desired public.products%rowtype;
  v_device jsonb;
  v_trade_in public.trade_ins%rowtype;
begin
  if v_name = '' then perform private.fail('validation', 'Укажите ваше имя'); end if;
  if length(v_name) > 100 then perform private.fail('validation', 'Имя — не длиннее 100 символов'); end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    perform private.fail('validation', 'Укажите корректный номер телефона');
  end if;
  if p_device is null or jsonb_typeof(p_device) <> 'object' then
    perform private.fail('validation', 'Опишите устройство');
  end if;
  if btrim(coalesce(p_device ->> 'brand', '')) = '' then
    perform private.fail('validation', 'Укажите марку устройства');
  end if;
  if btrim(coalesce(p_device ->> 'model', '')) = '' then
    perform private.fail('validation', 'Укажите модель устройства');
  end if;
  if coalesce(p_device ->> 'category', '') not in ('smartphone', 'laptop', 'watch', 'other') then
    perform private.fail('validation', 'Выберите тип устройства');
  end if;
  if coalesce(p_device ->> 'grade', '') not in ('excellent', 'good', 'fair') then
    perform private.fail('validation', 'Выберите состояние устройства');
  end if;
  if v_battery is not null and jsonb_typeof(v_battery) <> 'null' and (
    jsonb_typeof(v_battery) <> 'number'
    or (v_battery #>> '{}')::numeric <> trunc((v_battery #>> '{}')::numeric)
    or (v_battery #>> '{}')::numeric not between 1 and 100
  ) then
    perform private.fail('validation', 'Ёмкость аккумулятора — целое число от 1 до 100');
  end if;
  if cardinality(v_photos) > 5 then perform private.fail('validation', 'Не больше 5 фото'); end if;
  if exists (select 1 from unnest(v_photos) u where u !~ '^https://') then
    perform private.fail('validation', 'Фото нужно сначала загрузить');
  end if;
  if length(v_comment) > 1000 then perform private.fail('validation', 'Комментарий — не длиннее 1000 символов'); end if;

  -- Оставляем только известные поля, обрезаем пробелы.
  v_device := jsonb_strip_nulls(jsonb_build_object(
    'category', p_device ->> 'category',
    'brand', btrim(p_device ->> 'brand'),
    'model', btrim(p_device ->> 'model'),
    'grade', p_device ->> 'grade',
    'memory', nullif(btrim(coalesce(p_device ->> 'memory', '')), ''),
    'batteryHealth', case when jsonb_typeof(v_battery) = 'number' then v_battery end,
    'defects', nullif(btrim(coalesce(p_device ->> 'defects', '')), ''),
    'kit', nullif(btrim(coalesce(p_device ->> 'kit', '')), '')
  ));

  -- Желаемый товар могли скрыть, пока клиент заполнял форму — тогда заявка идёт без него.
  if p_desired_product_id is not null then
    select * into v_desired from public.products where id = p_desired_product_id and is_active;
  end if;

  insert into public.trade_ins (
    customer_name, customer_phone, device, photos,
    desired_product_id, desired_product_name, desired_product_price, comment
  ) values (
    v_name, v_phone, v_device, v_photos,
    v_desired.id, coalesce(v_desired.name, ''), v_desired.price, v_comment
  )
  returning * into v_trade_in;

  insert into public.trade_in_events (trade_in_id, type, from_status, to_status, message)
  values (v_trade_in.id, 'created', null, 'new', 'Заявка создана');

  return query select v_trade_in.id, v_trade_in.number;
end;
$$;

-- Оценка: ставит сумму выкупа и статус evaluated. Менять можно в new и evaluated.
create or replace function public.evaluate_trade_in(p_trade_in_id uuid, p_estimate integer, p_note text default null)
returns public.trade_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade_in public.trade_ins%rowtype;
  v_from text;
begin
  perform private.require_admin();
  if p_estimate is null or p_estimate <= 0 then
    perform private.fail('validation', 'Оценка — целое число больше нуля');
  end if;

  select * into v_trade_in from public.trade_ins where id = p_trade_in_id for update;
  if not found then perform private.fail('not_found', 'Заявка не найдена'); end if;
  if v_trade_in.status not in ('new', 'evaluated') then
    perform private.fail('invalid_transition',
      format('Оценку нельзя изменить: заявка в статусе «%s»', private.trade_in_status_label(v_trade_in.status)));
  end if;

  v_from := v_trade_in.status;
  update public.trade_ins
    set status = 'evaluated',
        admin_estimate = p_estimate,
        admin_note = case when p_note is null then admin_note else btrim(p_note) end
    where id = v_trade_in.id
    returning * into v_trade_in;

  insert into public.trade_in_events (trade_in_id, type, from_status, to_status, message)
  values (v_trade_in.id, 'evaluated', v_from, 'evaluated', 'Оценка: ' || private.format_price(p_estimate));

  return v_trade_in;
end;
$$;

-- Переходы: new → rejected; evaluated → accepted | rejected; accepted → completed | rejected.
create or replace function public.update_trade_in_status(p_trade_in_id uuid, p_status text)
returns public.trade_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade_in public.trade_ins%rowtype;
  v_from text;
  v_allowed text[];
begin
  perform private.require_admin();

  select * into v_trade_in from public.trade_ins where id = p_trade_in_id for update;
  if not found then perform private.fail('not_found', 'Заявка не найдена'); end if;

  v_allowed := case v_trade_in.status
    when 'new' then array['rejected']
    when 'evaluated' then array['accepted', 'rejected']
    when 'accepted' then array['completed', 'rejected']
    else array[]::text[]
  end;
  if p_status is null or not (p_status = any (v_allowed)) then
    perform private.fail(
      'invalid_transition',
      case when p_status = 'evaluated'
        then 'Чтобы оценить заявку, укажите сумму оценки'
        else format('Нельзя перевести заявку из статуса «%s» в «%s»',
          private.trade_in_status_label(v_trade_in.status), private.trade_in_status_label(p_status))
      end
    );
  end if;

  v_from := v_trade_in.status;
  update public.trade_ins set status = p_status where id = v_trade_in.id returning * into v_trade_in;

  insert into public.trade_in_events (trade_in_id, type, from_status, to_status, message)
  values (
    v_trade_in.id, 'status_changed', v_from, p_status,
    format('Статус: %s → %s', private.trade_in_status_label(v_from), private.trade_in_status_label(p_status))
  );

  return v_trade_in;
end;
$$;

create or replace function public.set_trade_in_admin_note(p_trade_in_id uuid, p_note text)
returns public.trade_ins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade_in public.trade_ins%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  perform private.require_admin();
  select * into v_trade_in from public.trade_ins where id = p_trade_in_id for update;
  if not found then perform private.fail('not_found', 'Заявка не найдена'); end if;
  if v_trade_in.admin_note = v_note then return v_trade_in; end if;

  update public.trade_ins set admin_note = v_note where id = v_trade_in.id returning * into v_trade_in;
  insert into public.trade_in_events (trade_in_id, type, message)
  values (v_trade_in.id, 'note_updated',
    case when v_note = '' then 'Заметка администратора удалена' else 'Заметка администратора изменена' end);
  return v_trade_in;
end;
$$;

-- ---------------------------------------------------------------------------
-- Права на функции. По умолчанию EXECUTE есть у PUBLIC — убираем и выдаём явно.
-- ---------------------------------------------------------------------------
revoke all on function
  public.create_order(uuid, integer, text, text, text, text, double precision, double precision, date, time, text, text),
  public.cancel_order(uuid),
  public.update_order_status(uuid, text),
  public.set_order_admin_note(uuid, text),
  public.adjust_stock(uuid, integer),
  public.create_trade_in(text, text, jsonb, text[], uuid, text),
  public.evaluate_trade_in(uuid, integer, text),
  public.update_trade_in_status(uuid, text),
  public.set_trade_in_admin_note(uuid, text)
from public, anon, authenticated;

-- Заявки — для всех (клиентам вход не нужен).
grant execute on function
  public.create_order(uuid, integer, text, text, text, text, double precision, double precision, date, time, text, text),
  public.create_trade_in(text, text, jsonb, text[], uuid, text)
to anon, authenticated, service_role;

-- Остальное — только вошедшим; внутри ещё проверка private.require_admin().
grant execute on function
  public.cancel_order(uuid),
  public.update_order_status(uuid, text),
  public.set_order_admin_note(uuid, text),
  public.adjust_stock(uuid, integer),
  public.evaluate_trade_in(uuid, integer, text),
  public.update_trade_in_status(uuid, text),
  public.set_trade_in_admin_note(uuid, text)
to authenticated, service_role;

-- Хелперы private.* вызываются из функций выше (владелец — postgres), наружу не нужны.
-- is_admin нужен ролям напрямую: его вызывают RLS-политики.

-- Realtime: админка получает новые заказы, заявки и сообщения без перезагрузки.
alter publication supabase_realtime add table
  public.orders, public.trade_ins, public.products, public.bot_chats, public.bot_messages;
