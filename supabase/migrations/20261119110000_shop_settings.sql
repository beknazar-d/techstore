-- Название, адрес и контакты магазина — меняет админ в «Настройках», сайт показывает в шапке,
-- подвале и форме заказа. Одна строка (id = true). Читают все, меняет только админ.

create table public.shop_settings (
  id boolean primary key default true check (id),
  name text not null default 'Phone Market' check (length(btrim(name)) between 1 and 80),
  city text not null default '' check (length(city) <= 80),
  city_ky text not null default '' check (length(city_ky) <= 80),
  address text not null default '' check (length(address) <= 300),
  address_ky text not null default '' check (length(address_ky) <= 300),
  working_hours text not null default '' check (length(working_hours) <= 120),
  working_hours_ky text not null default '' check (length(working_hours_ky) <= 120),
  -- До трёх телефонов в формате +79991234567, первый — основной (шапка, кнопка «Позвонить»).
  phones text[] not null default '{}' check (
    cardinality(phones) <= 3
    and array_to_string(phones, ',') ~ '^(\+?[0-9]{9,15}(,\+?[0-9]{9,15})*)?$'
  ),
  -- WhatsApp — только цифры; Telegram и Instagram — имя без «@».
  whatsapp text not null default '' check (whatsapp ~ '^([0-9]{9,15})?$'),
  telegram text not null default '' check (telegram ~ '^([A-Za-z0-9_]{4,32})?$'),
  instagram text not null default '' check (instagram ~ '^([A-Za-z0-9_.]{1,30})?$'),
  email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Ссылка на точку на карте (Google / Яндекс / 2ГИС).
  map_url text not null default '' check (map_url = '' or map_url ~ '^https://\S+$'),
  updated_at timestamptz not null default now()
);

create trigger shop_settings_updated_at
  before update on public.shop_settings
  for each row execute function private.set_updated_at();

alter table public.shop_settings enable row level security;

create policy "shop_settings: read" on public.shop_settings
  for select to anon, authenticated using (true);
create policy "shop_settings: admin update" on public.shop_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.shop_settings from anon, authenticated;
grant select on public.shop_settings to anon, authenticated;
grant update (
  name, city, city_ky, address, address_ky, working_hours, working_hours_ky,
  phones, whatsapp, telegram, instagram, email, map_url
) on public.shop_settings to authenticated;
grant all on public.shop_settings to service_role;

-- Стартовые значения — те же заглушки, что были в коде; владелец заменит их в «Настройках».
insert into public.shop_settings (
  name, city, city_ky, address, address_ky, working_hours, working_hours_ky, phones, whatsapp, telegram
) values (
  'Phone Market', 'Москва', 'Москва',
  'Москва, ул. Тверская, 1 (адрес-заглушка)', 'Москва, Тверская көч., 1 (убактылуу дарек)',
  'Ежедневно с 10:00 до 20:00', 'Күн сайын 10:00дөн 20:00гө чейин',
  array['+70000000000'], '70000000000', 'phone_market_demo'
)
on conflict (id) do nothing;
