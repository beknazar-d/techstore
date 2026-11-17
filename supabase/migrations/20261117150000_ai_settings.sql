-- Искусственный интеллект: ИИ-ассистент админки и ИИ-ответы Telegram-бота (Claude, Anthropic).
--
-- API-ключ Anthropic админ вставляет в «Настройках». Edge Function ai-admin проверяет его
-- и сохраняет в Supabase Vault (RPC ai_key_*, только service_role). Во фронтенд ключ
-- не возвращается — в ai_settings лишь последние 4 символа (key_hint).

create table public.ai_settings (
  -- Всегда одна строка: id = true.
  id boolean primary key default true check (id),
  -- connected и key_hint меняет только Edge Function ai-admin (service_role).
  connected boolean not null default false,
  key_hint text not null default '' check (length(key_hint) <= 4),
  assistant_model text not null default 'claude-opus-5-5'
    check (assistant_model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  bot_model text not null default 'claude-opus-5-5'
    check (bot_model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  -- Дополнительные указания ассистенту админки (тон, правила наполнения каталога).
  assistant_instructions text not null default '' check (length(assistant_instructions) <= 4000),
  updated_at timestamptz not null default now()
);

create trigger ai_settings_updated_at
  before update on public.ai_settings
  for each row execute function private.set_updated_at();

insert into public.ai_settings default values;

alter table public.ai_settings enable row level security;

create policy "ai_settings: admin read" on public.ai_settings
  for select to authenticated using ((select private.is_admin()));
create policy "ai_settings: admin update" on public.ai_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.ai_settings from anon, authenticated;
grant select on public.ai_settings to authenticated;
-- connected / key_hint админ напрямую не меняет — только через ai-admin.
grant update (assistant_model, bot_model, assistant_instructions) on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;

-- ---------------------------------------------------------------------------
-- Ключ Anthropic в Vault
-- ---------------------------------------------------------------------------
create or replace function public.ai_key_set(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_key is null or p_key !~ '^sk-ant-[A-Za-z0-9_-]{20,}$' then
    perform private.fail('validation', 'Ключ не похож на API-ключ Anthropic (sk-ant-…)');
  end if;

  select id into v_id from vault.secrets where name = 'anthropic_api_key';
  if v_id is null then
    perform vault.create_secret(p_key, 'anthropic_api_key', 'API-ключ Anthropic (Claude) магазина');
  else
    perform vault.update_secret(v_id, p_key);
  end if;
end;
$$;

create or replace function public.ai_key_get()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'anthropic_api_key' limit 1;
$$;

create or replace function public.ai_key_clear()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where name = 'anthropic_api_key';
$$;

revoke all on function public.ai_key_set(text), public.ai_key_get(), public.ai_key_clear()
  from public, anon, authenticated;
grant execute on function public.ai_key_set(text), public.ai_key_get(), public.ai_key_clear()
  to service_role;
