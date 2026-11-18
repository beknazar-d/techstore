-- Несколько провайдеров ИИ (Claude, ChatGPT, Gemini) и голос бота (ElevenLabs или ChatGPT).
--
-- Ключи провайдеров — в Supabase Vault под именами <provider>_api_key (RPC ai_secret_*,
-- только service_role). В ai_settings — только последние 4 символа каждого ключа (key_hints)
-- и список моделей, которые провайдер отдал при подключении ключа (models).

-- ---------------------------------------------------------------------------
-- ai_settings: провайдер и модель отдельно для ассистента и для бота
-- ---------------------------------------------------------------------------
alter table public.ai_settings
  add column assistant_provider text not null default 'anthropic'
    check (assistant_provider in ('anthropic', 'openai', 'google')),
  add column bot_provider text not null default 'anthropic'
    check (bot_provider in ('anthropic', 'openai', 'google')),
  -- { "anthropic": "ab12", "openai": "cd34", ... } — у кого есть ключ.
  add column key_hints jsonb not null default '{}'::jsonb check (jsonb_typeof(key_hints) = 'object'),
  -- { "openai": ["gpt-…", …], … } — модели, доступные по ключу.
  add column models jsonb not null default '{}'::jsonb check (jsonb_typeof(models) = 'object'),
  -- Голос бота: на голосовое сообщение клиента бот отвечает голосом.
  add column voice_replies boolean not null default true,
  add column voice_provider text not null default 'elevenlabs' check (voice_provider in ('elevenlabs', 'openai')),
  add column elevenlabs_voice_id text not null default ''
    check (elevenlabs_voice_id = '' or elevenlabs_voice_id ~ '^[A-Za-z0-9_-]{5,64}$'),
  add column elevenlabs_model text not null default 'eleven_v3' check (length(elevenlabs_model) between 1 and 64),
  add column openai_voice text not null default 'alloy' check (openai_voice ~ '^[a-z]{2,20}$');

-- Уже подключённый ключ Claude переносим в новую схему.
update public.ai_settings
  set key_hints = case when connected and key_hint <> '' then jsonb_build_object('anthropic', key_hint) else '{}'::jsonb end;

alter table public.ai_settings
  drop constraint ai_settings_assistant_model_check,
  drop constraint ai_settings_bot_model_check,
  add constraint ai_settings_assistant_model_check check (assistant_model ~ '^[A-Za-z0-9._:/-]{1,100}$'),
  add constraint ai_settings_bot_model_check check (bot_model ~ '^[A-Za-z0-9._:/-]{1,100}$'),
  drop column connected,
  drop column key_hint;

-- key_hints и models меняет только Edge Function ai-admin.
revoke update on public.ai_settings from authenticated;
grant update (
  assistant_provider, assistant_model, bot_provider, bot_model, assistant_instructions,
  voice_replies, voice_provider, elevenlabs_voice_id, elevenlabs_model, openai_voice
) on public.ai_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Ключи провайдеров в Vault
-- ---------------------------------------------------------------------------
drop function public.ai_key_set(text);
drop function public.ai_key_get();
drop function public.ai_key_clear();

create or replace function private.ai_secret_name(p_provider text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_provider not in ('anthropic', 'openai', 'google', 'elevenlabs') then
    perform private.fail('validation', 'Неизвестный провайдер ИИ');
  end if;
  return p_provider || '_api_key';
end;
$$;

create or replace function public.ai_secret_set(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.ai_secret_name(p_provider);
  v_id uuid;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_.:-]{20,255}$' then
    perform private.fail('validation', 'Ключ не похож на API-ключ');
  end if;

  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(p_key, v_name, 'API-ключ ' || p_provider);
  else
    perform vault.update_secret(v_id, p_key);
  end if;
end;
$$;

create or replace function public.ai_secret_get(p_provider text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = private.ai_secret_name(p_provider) limit 1;
$$;

create or replace function public.ai_secret_clear(p_provider text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where name = private.ai_secret_name(p_provider);
$$;

revoke all on function private.ai_secret_name(text) from public;
grant execute on function private.ai_secret_name(text) to service_role;
revoke all on function public.ai_secret_set(text, text), public.ai_secret_get(text), public.ai_secret_clear(text)
  from public, anon, authenticated;
grant execute on function public.ai_secret_set(text, text), public.ai_secret_get(text), public.ai_secret_clear(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Приветствие бота на кыргызском (для клиентов с Telegram на кыргызском)
-- ---------------------------------------------------------------------------
alter table public.bot_settings
  add column greeting_ky text not null default '' check (length(greeting_ky) <= 1000);

update public.bot_settings set greeting_ky =
  'Саламатсызбы! Мен дүкөндүн жардамчысымын. Товарлардын бар-жогу жана баалары боюнча айтып берем, заявка калтырууга жардам берем. Төлөм — алганда.'
  where id;

grant update (greeting_ky) on public.bot_settings to authenticated;
