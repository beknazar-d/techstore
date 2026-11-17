-- ВРЕМЕННО, до подключения Cloudflare R2: trade-in принимает сжатые фото как data URL
-- (WebP/JPEG, не больше ~450 КБ каждое). Когда появится загрузка в R2 (Edge Function upload-url),
-- вернуть проверку '^https://' следующей миграцией.

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
  if exists (
    select 1 from unnest(v_photos) u
    where not (
      u ~ '^https://'
      or (u ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$' and length(u) <= 600000)
    )
  ) then
    perform private.fail('validation', 'Фото не подходит: загрузите JPEG или WebP поменьше');
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
