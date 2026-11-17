-- Токен Telegram-бота хранится в Supabase Vault (зашифровано), а не в секретах Edge Functions:
-- админ вставляет токен в «Настройках», Edge Function telegram-admin проверяет его и сохраняет сюда.
-- Читать и менять токен может только service_role (Edge Functions). Во фронтенд он не попадает —
-- в bot_settings лишь последние 4 символа (token_hint).

create or replace function public.bot_token_set(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9]{5,15}:[A-Za-z0-9_-]{30,}$' then
    perform private.fail('validation', 'Токен не похож на токен от @BotFather');
  end if;

  select id into v_id from vault.secrets where name = 'telegram_bot_token';
  if v_id is null then
    perform vault.create_secret(p_token, 'telegram_bot_token', 'Токен Telegram-бота магазина');
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end;
$$;

create or replace function public.bot_token_get()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
$$;

create or replace function public.bot_token_clear()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where name = 'telegram_bot_token';
$$;

revoke all on function public.bot_token_set(text), public.bot_token_get(), public.bot_token_clear()
  from public, anon, authenticated;
grant execute on function public.bot_token_set(text), public.bot_token_get(), public.bot_token_clear()
  to service_role;

comment on column public.bot_settings.token_hint is
  'Последние 4 символа токена бота. Сам токен — в Vault (bot_token_set/get), доступ только у service_role.';
