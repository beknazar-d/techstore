-- Telegram-бот: запись переписки. Вызывают только Edge Functions (service_role):
--   telegram-webhook — входящие сообщения клиентов;
--   telegram-admin   — ответы менеджера из админки.
-- Всё в одной транзакции: чат, сообщение, счётчик непрочитанных, последнее сообщение.

-- Входящее сообщение клиента. Создаёт чат при первом сообщении.
-- p_handoff_reason не null → разговор переходит к менеджеру (бот в этом чате молчит).
create or replace function public.bot_receive_message(
  p_telegram_chat_id bigint,
  p_customer_name text,
  p_telegram_username text,
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
  v_chat public.bot_chats%rowtype;
begin
  if p_telegram_chat_id is null then perform private.fail('validation', 'Нет chat_id'); end if;
  if v_text = '' then perform private.fail('validation', 'Пустое сообщение'); end if;

  insert into public.bot_chats (telegram_chat_id, customer_name, telegram_username)
  values (
    p_telegram_chat_id,
    left(btrim(coalesce(p_customer_name, '')), 200),
    left(btrim(coalesce(p_telegram_username, '')), 64)
  )
  on conflict (telegram_chat_id) do update set
    customer_name = case when excluded.customer_name <> '' then excluded.customer_name else public.bot_chats.customer_name end,
    telegram_username = case when excluded.telegram_username <> '' then excluded.telegram_username else public.bot_chats.telegram_username end
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

-- Исходящее сообщение (уже отправленное в Telegram): ответ бота или менеджера.
-- Ответ менеджера забирает разговор у бота и сбрасывает непрочитанные.
create or replace function public.bot_record_outgoing(
  p_chat_id uuid,
  p_sender text,
  p_text text
)
returns public.bot_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := left(btrim(coalesce(p_text, '')), 4096);
  v_message public.bot_messages%rowtype;
begin
  if p_sender not in ('bot', 'manager') then perform private.fail('validation', 'Неверный отправитель'); end if;
  if v_text = '' then perform private.fail('validation', 'Введите сообщение'); end if;

  insert into public.bot_messages (chat_id, sender, text)
  values (p_chat_id, p_sender, v_text)
  returning * into v_message;

  update public.bot_chats set
    last_message_text = v_text,
    last_message_at = now(),
    mode = case when p_sender = 'manager' then 'manager' else mode end,
    unread_count = case when p_sender = 'manager' then 0 else unread_count end
  where id = p_chat_id;

  if not found then perform private.fail('not_found', 'Чат не найден'); end if;
  return v_message;
end;
$$;

revoke all on function
  public.bot_receive_message(bigint, text, text, text, text),
  public.bot_record_outgoing(uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.bot_receive_message(bigint, text, text, text, text),
  public.bot_record_outgoing(uuid, text, text)
to service_role;
