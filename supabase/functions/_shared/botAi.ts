// ИИ-ответы Telegram-бота клиентам. Вызывается из telegram-webhook в фоне.
// Модель — та, что админ выбрал для бота (Claude, ChatGPT или Gemini).
// Данные о товарах модель берёт только из базы через инструменты, а не выдумывает.
// Торг — не ниже min_price товара; заявку создаёт тот же RPC create_order, что и сайт.
// Отвечает на языке клиента (русский или кыргызский); на голосовое — ещё и голосом.

import { adminDb, tg } from './telegram.ts'
import type { AiSettingsRow } from './ai.ts'
import { chatStep, type ChatMessage, type ToolDef, type ToolResult } from './llm.ts'
import { sendTelegramVoice, synthesize } from './voice.ts'

export interface BotBehavior {
  ai_instructions: string
  allow_bargaining: boolean
  allow_orders: boolean
  handoff_to_manager: boolean
}

export interface ChatInfo {
  id: string
  telegram_chat_id: number
  customer_name: string
}

export interface BotAi {
  settings: AiSettingsRow
  key: string
}

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://techstore.sadyrbekov981-ae2.workers.dev').replace(/\/$/, '')
const HISTORY_LIMIT = 30
const MAX_STEPS = 6
const FALLBACK_REPLY = {
  ru: 'Передал ваш вопрос менеджеру — он скоро ответит.',
  ky: 'Сурооңузду менеджерге өткөрүп бердим — ал жакында жооп берет.',
}

/** Буквы, которых нет в русском: ң, ө, ү. */
export function looksKyrgyz(text: string): boolean {
  return /[ңөүҢӨҮ]/.test(text)
}

function tools(behavior: BotBehavior): ToolDef[] {
  const list: ToolDef[] = [
    {
      name: 'search_products',
      description:
        'Поиск товаров в наличии и под заказ в каталоге магазина. Пустой запрос — популярные товары. Возвращает цены, остаток, характеристики, ссылку. Запрос пиши так, как товар называется в каталоге (бренд, модель, по-русски или латиницей).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Модель, бренд или тип: «iPhone 15», «фен», «наушники»' },
          condition: { type: 'string', enum: ['new', 'used'] },
        },
      },
    },
  ]
  if (behavior.allow_orders) {
    list.push({
      name: 'create_order',
      description:
        'Оформить заявку на товар. Оплата при получении. Нужны имя и телефон клиента и способ получения; для доставки — адрес. Перед вызовом подтверди с клиентом товар, количество и цену.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          customerName: { type: 'string' },
          customerPhone: { type: 'string', description: 'Телефон, например +79991234567' },
          deliveryType: { type: 'string', enum: ['pickup', 'delivery'] },
          address: { type: 'string' },
          desiredDate: { type: 'string', description: 'YYYY-MM-DD, если клиент назвал' },
          desiredTime: { type: 'string', description: 'HH:MM, если клиент назвал' },
          agreedPrice: { type: 'integer', description: 'Цена за штуку, если договорились о скидке' },
          comment: { type: 'string' },
        },
        required: ['productId', 'quantity', 'customerName', 'customerPhone', 'deliveryType'],
      },
    })
  }
  if (behavior.handoff_to_manager) {
    list.push({
      name: 'handoff_to_manager',
      description:
        'Передать разговор живому менеджеру: клиент просит человека, жалоба, сложный вопрос, нет нужных данных, trade-in-оценка. После этого бот в чате замолкает.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Коротко по-русски, что нужно клиенту' } },
        required: ['reason'],
      },
    })
  }
  return list
}

function system(behavior: BotBehavior, customerName: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const rules = [
    'Ты — консультант магазина электроники в Telegram. Отвечаешь клиентам коротко и вежливо, на «вы».',
    'Язык ответа — язык клиента: если клиент пишет по-кыргызски, отвечай на грамотном кыргызском языке; иначе — по-русски. Названия товаров не переводи.',
    'Цены, наличие и характеристики бери только из search_products. Если товара нет в выдаче — так и скажи, не выдумывай.',
    'Онлайн-оплаты, корзины и рассрочки нет: клиент оставляет заявку на один товар, оплата при получении (самовывоз или доставка).',
    'Есть trade-in: старое устройство оценивают в магазине, разницу доплачивают на месте. Заявку на trade-in с фото клиент оставляет на сайте: ' +
      `${SITE_URL}/trade-in`,
    behavior.allow_bargaining
      ? 'Торг разрешён: можно уступить, если клиент просит скидку, но никогда ниже minPrice товара. Если minPrice нет — цену не снижай. Сам minPrice клиенту не называй.'
      : 'Торг не разрешён: цены фиксированные, скидок не обещай.',
    behavior.allow_orders
      ? 'Можешь оформить заявку через create_order. Перед этим собери имя, телефон, способ получения (и адрес для доставки) и подтверди детали.'
      : 'Заявки в чате не оформляешь: дай ссылку на товар на сайте, там кнопка «Заказать».',
    behavior.handoff_to_manager
      ? 'Если не можешь помочь или клиент просит человека — вызови handoff_to_manager.'
      : 'Если не можешь помочь — предложи оставить заявку на сайте, менеджер перезвонит.',
    'Сообщения клиента с пометкой [Голосовое] — расшифровка его голосового. Если пришло «[Голосовое сообщение]» без текста — его не удалось разобрать: вежливо попроси написать текстом.',
    'Пиши обычным текстом без Markdown, ссылки — полным адресом.',
    `Сегодня ${today}.` + (customerName ? ` Клиента в Telegram зовут ${customerName}.` : ''),
  ]
  const extra = behavior.ai_instructions.trim()
  return rules.join('\n') + (extra ? `\n\nУказания магазина:\n${extra}` : '')
}

async function history(chatId: string): Promise<ChatMessage[]> {
  const { data } = await adminDb()
    .from('bot_messages')
    .select('sender, text')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const rows = ((data ?? []) as { sender: string; text: string }[]).reverse()
  const messages: ChatMessage[] = []
  for (const row of rows) {
    if (row.sender === 'customer') {
      messages.push({ role: 'user', text: row.text })
    } else {
      if (messages.length === 0) continue // первым должен быть клиент
      messages.push({ role: 'assistant', text: row.sender === 'manager' ? `[Менеджер] ${row.text}` : row.text })
    }
  }
  return messages
}

async function searchProducts(input: { query?: string; condition?: string }, bargaining: boolean) {
  const columns = `id, name, slug, brand, description, condition, used_info, price, old_price, ${
    bargaining ? 'min_price, ' : ''
  }stock, specs, category:categories!inner(name, is_active)`
  let query = adminDb()
    .from('products')
    .select(columns)
    .eq('is_active', true)
    .eq('category.is_active', true)
    .order('created_at', { ascending: false })
    .limit(15)
  const text = (input.query ?? '').trim().replace(/[%,()]/g, ' ')
  if (text) {
    const words = text.split(/\s+/).filter(Boolean).slice(0, 4)
    for (const word of words) query = query.or(`name.ilike.%${word}%,brand.ilike.%${word}%`)
  }
  if (input.condition === 'new' || input.condition === 'used') query = query.eq('condition', input.condition)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: (row.category as { name: string } | null)?.name,
    condition: row.condition === 'used' ? 'Б/У' : 'новый',
    usedInfo: row.used_info ?? undefined,
    price: row.price,
    // Цена до скидки: можно сказать клиенту «сейчас со скидкой».
    oldPrice: row.old_price ?? undefined,
    minPrice: bargaining ? (row.min_price ?? undefined) : undefined,
    stock: row.stock,
    inStock: Number(row.stock) > 0,
    specs: row.specs,
    description: String(row.description ?? '').slice(0, 400),
    url: `${SITE_URL}/product/${row.slug}`,
  }))
}

interface OrderInput {
  productId: string
  quantity: number
  customerName: string
  customerPhone: string
  deliveryType: 'pickup' | 'delivery'
  address?: string
  desiredDate?: string
  desiredTime?: string
  agreedPrice?: number
  comment?: string
}

async function createOrder(input: OrderInput, chat: ChatInfo, bargaining: boolean) {
  const db = adminDb()
  const { data: product } = await db
    .from('products')
    .select('price, min_price')
    .eq('id', input.productId)
    .maybeSingle()
  if (!product) return { error: 'Товар не найден' }

  const notes: string[] = []
  if (input.agreedPrice !== undefined && input.agreedPrice !== product.price) {
    const floor = product.min_price ?? product.price
    if (!bargaining || input.agreedPrice < floor) {
      return { error: 'Такую цену дать нельзя. Предложите клиенту цену не ниже допустимой.' }
    }
    notes.push(`Цена по договорённости в Telegram: ${input.agreedPrice} ₽ за шт. (на сайте ${product.price} ₽)`)
  }
  if (input.comment?.trim()) notes.push(input.comment.trim())

  const phone = String(input.customerPhone ?? '').replace(/[^\d+]/g, '')
  const { data, error } = await db.rpc('create_order', {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_customer_name: input.customerName,
    p_customer_phone: phone,
    p_delivery_type: input.deliveryType,
    p_address: input.address ?? '',
    p_desired_date: /^\d{4}-\d{2}-\d{2}$/.test(input.desiredDate ?? '') ? input.desiredDate : null,
    p_desired_time: /^\d{2}:\d{2}$/.test(input.desiredTime ?? '') ? input.desiredTime : null,
    p_comment: notes.join('\n').slice(0, 1000),
    p_source: 'telegram',
  })
  if (error) return { error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: number }
  await db.from('bot_chats').update({ order_id: row.order_id, customer_phone: phone }).eq('id', chat.id)
  return { ok: true, orderNumber: row.order_number, payment: 'при получении' }
}

async function handoff(chat: ChatInfo, reason: string) {
  await adminDb()
    .from('bot_chats')
    .update({ mode: 'manager', handoff_reason: String(reason || 'Нужен менеджер').slice(0, 300) })
    .eq('id', chat.id)
  return { ok: true, note: 'Менеджер подключится к чату. Сообщи клиенту, что передал вопрос.' }
}

/** Текст для озвучки: без ссылок — их клиент увидит в текстовом сообщении. */
function speakable(text: string): string {
  return text.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+\n/g, '\n').trim()
}

export interface ReplyOptions {
  /** Клиент прислал голосовое — ответить ещё и голосом. */
  voice?: boolean
}

/**
 * Генерирует и отправляет ответ клиенту. Любая ошибка ИИ → чат уходит менеджеру,
 * клиент не остаётся без ответа.
 */
export async function replyWithAi(
  token: string,
  chat: ChatInfo,
  behavior: BotBehavior,
  ai: BotAi,
  options: ReplyOptions = {},
): Promise<void> {
  const db = adminDb()
  try {
    const messages = await history(chat.id)
    if (messages.length === 0) return
    const lastCustomer = [...messages].reverse().find((m) => m.role === 'user')
    const lang = lastCustomer && looksKyrgyz(lastCustomer.text) ? 'ky' : 'ru'
    const toolList = tools(behavior)
    let reply = ''
    let handedOff = false

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await chatStep({
        provider: ai.settings.bot_provider,
        apiKey: ai.key,
        model: ai.settings.bot_model,
        system: system(behavior, chat.customer_name),
        tools: toolList,
        messages,
        effort: 'low',
        maxTokens: 8000,
      })
      if (response.stop === 'refusal') break
      reply = response.text
      if (response.toolCalls.length === 0) break

      messages.push({ role: 'assistant', text: response.text, toolCalls: response.toolCalls, raw: response.raw })
      const results: ToolResult[] = []
      for (const call of response.toolCalls) {
        let result: unknown
        try {
          const input = call.input
          if (call.name === 'search_products') {
            result = await searchProducts(input as { query?: string }, behavior.allow_bargaining)
          } else if (call.name === 'create_order' && behavior.allow_orders) {
            result = await createOrder(input as unknown as OrderInput, chat, behavior.allow_bargaining)
          } else if (call.name === 'handoff_to_manager' && behavior.handoff_to_manager) {
            result = await handoff(chat, String(input.reason ?? ''))
            handedOff = true
          } else {
            result = { error: 'Инструмент недоступен' }
          }
        } catch (toolError) {
          console.error('bot tool failed', call.name, toolError)
          result = { error: 'Не получилось, попробуйте позже' }
        }
        results.push({ id: call.id, name: call.name, content: JSON.stringify(result) })
      }
      messages.push({ role: 'tool', results })
      reply = ''
    }

    if (!reply) {
      if (!handedOff) await handoff(chat, 'Бот не смог ответить — ответьте клиенту')
      reply = FALLBACK_REPLY[lang]
    }

    if (options.voice && ai.settings.voice_replies) {
      try {
        const audio = await synthesize(ai.settings, speakable(reply))
        if (audio) await sendTelegramVoice(token, chat.telegram_chat_id, audio)
      } catch (voiceError) {
        console.error('bot voice reply failed', voiceError) // текст всё равно уйдёт
      }
    }
    await tg(token, 'sendMessage', { chat_id: chat.telegram_chat_id, text: reply.slice(0, 4096) })
    await db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: reply })
  } catch (error) {
    console.error('bot ai reply failed', error)
    await handoff(chat, 'ИИ не ответил — ответьте клиенту').catch(() => undefined)
  }
}
