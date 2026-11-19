-- Фото-слайды: баннер может быть просто картинкой (текст уже на фото), тогда заголовок не нужен.
-- Без фото заголовок по-прежнему обязателен.

alter table public.promo_banners drop constraint promo_banners_title_check;
alter table public.promo_banners add constraint promo_banners_title_check check (
  length(btrim(title)) <= 120
  and (length(btrim(title)) >= 1 or image is not null)
);
