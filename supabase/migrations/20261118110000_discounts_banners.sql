-- Скидки на товары и баннеры акций на главной.
--
-- Скидка = «цена до скидки» (old_price) выше текущей цены. Заказ, склад и торг считают по price,
-- как и раньше, — старая цена нужна только для показа (зачёркнутая цена и бейдж «−15%»).

alter table public.products
  add column old_price integer,
  add constraint products_old_price_gt_price check (old_price is null or old_price > price);

comment on column public.products.old_price is 'Цена до скидки, ₽. null — скидки нет. Всегда больше price.';

-- Анониму колонка тоже нужна (показ скидки на сайте).
grant select (old_price) on public.products to anon;

-- ---------- Баннеры акций ----------

create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  subtitle text not null default '' check (length(subtitle) <= 300),
  -- Переводы на кыргызский. Пусто — показываем русский текст.
  title_ky text not null default '' check (length(title_ky) <= 120),
  subtitle_ky text not null default '' check (length(subtitle_ky) <= 300),
  button_label text not null default '' check (length(button_label) <= 40),
  button_label_ky text not null default '' check (length(button_label_ky) <= 40),
  -- Куда ведёт баннер: путь на сайте (/catalog/smartfony, /product/...) или https-ссылка.
  link text not null default '' check (link = '' or link ~ '^(/[^\s]*|https://[^\s]+)$'),
  -- ВРЕМЕННО, как фото trade-in: сжатый data URL (WebP/JPEG). Дальше — URL в R2.
  image text check (
    image is null
    or (image ~ '^data:image/(webp|jpeg);base64,' and length(image) <= 900000)
    or image ~ '^https://'
  ),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  -- Период показа (необязательно). Вне периода баннер на сайте не виден.
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_banners_period check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index promo_banners_sort_idx on public.promo_banners (sort_order, created_at desc);

create trigger promo_banners_updated_at
  before update on public.promo_banners
  for each row execute function private.set_updated_at();

alter table public.promo_banners enable row level security;

-- Сайт видит только включённые баннеры в их период показа.
create policy "promo_banners: anon read active" on public.promo_banners
  for select to anon
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- Вошедший: админ видит все, остальные — как аноним.
create policy "promo_banners: read" on public.promo_banners
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );
create policy "promo_banners: admin insert" on public.promo_banners
  for insert to authenticated with check ((select private.is_admin()));
create policy "promo_banners: admin update" on public.promo_banners
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "promo_banners: admin delete" on public.promo_banners
  for delete to authenticated using ((select private.is_admin()));

grant select on public.promo_banners to anon;
grant select, insert, update, delete on public.promo_banners to authenticated;
grant all on public.promo_banners to service_role;
