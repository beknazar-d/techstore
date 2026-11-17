-- Статистика для админки: одна функция → jsonb в формате типа ShopStats (src/types).
-- Правила как в локальной версии (src/api/stats.ts):
--   - заказ относится к дню заявки (created_at), дни — по московскому времени;
--   - выручка и прибыль — только по выполненным заказам;
--   - прибыль — по себестоимости, сохранённой в заказе (orders.cost_price).

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
      count(*) filter (where source = 'telegram') as telegram
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
    'ordersBySource', jsonb_build_object('site', c.site, 'telegram', c.telegram),
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

revoke all on function public.admin_stats(integer) from public, anon, authenticated;
grant execute on function public.admin_stats(integer) to authenticated, service_role;
