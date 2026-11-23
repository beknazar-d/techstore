// ИИ-ответы бота клиентам в Telegram и WhatsApp. Вызывается из telegram-webhook и whatsapp-webhook в фоне.
// Модель — та, что админ выбрал для бота (Claude, ChatGPT или Gemini).
// Данные о товарах и магазине модель берёт только из базы (каталог в подсказке + инструменты), а не выдумывает.
// Торг — не ниже min_price товара; заявку создаёт тот же RPC create_order, что и сайт.
// Отвечает на языке клиента (русский или кыргызский); на голосовое — голосом.

import { adminDb } from './telegram.ts'
import type { AiSettingsRow } from './ai.ts'
import type { Channel } from './channels.ts'
import { chatStep, type ChatMessage, type ToolDef, type ToolResult } from './llm.ts'
import { synthesize } from './voice.ts'

export interface BotBehavior {
  ai_instructions: string
  allow_bargaining: boolean
  allow_orders: boolean
  handoff_to_manager: boolean
}

export interface ChatInfo {
  id: string
  customer_name: string
}

export interface BotAi {
  settings: AiSettingsRow
  key: string
}

type Lang = 'ru' | 'ky'

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://techstore.sadyrbekov981-ae2.workers.dev').replace(/\/$/, '')
const CURRENCY = '₽' // как на сайте (src/config/shop.ts)
const HISTORY_LIMIT = 40
const MAX_STEPS = 6
const CATALOG_LIMIT = 80
/** Пометка ответа, отправленного голосом, — видна менеджеру в «Чатах», модели не показывается. */
export const VOICE_MARK = '[Голосом] '
const FALLBACK_REPLY: Record<Lang, string> = {
  ru: 'Минутку, уточню у менеджера — он скоро напишет вам здесь.',
  ky: 'Бир мүнөт, менеджерден тактап берейин — ал жакында ушул жерге жазат.',
}

/** Буквы, которых нет в русском: ң, ө, ү. */
export function looksKyrgyz(text: string): boolean {
  return /[ңөүҢӨҮ]/.test(text)
}

function money(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const digits = String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${digits} ${CURRENCY}`
}

// ---------- Данные магазина ----------

interface ProductRow {
  id: string
  name: string
  slug: string
  brand: string
  description: string | null
  condition: 'new' | 'used'
  used_info: Record<string, unknown> | null
  price: number
  old_price: number | null
  min_price?: number | null
  stock: number
  specs: Record<string, unknown> | null
  category: { name: string; is_active: boolean } | null
}

async function loadProducts(bargaining: boolean): Promise<ProductRow[]> {
  const columns = `id, name, slug, brand, description, condition, used_info, price, old_price, ${
    bargaining ? 'min_price, ' : ''
  }stock, specs, category:categories!inner(name, is_active)`
  const { data, error } = await adminDb()
    .from('products')
    .select(columns)
    .eq('is_active', true)
    .eq('category.is_active', true)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []) as unknown as ProductRow[]
}

function productCard(row: ProductRow, bargaining: boolean, full: boolean) {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name,
    condition: row.condition === 'used' ? 'Б/У' : 'новый',
    price: money(row.price),
    // Цена до скидки: можно сказать «сейчас со скидкой».
    oldPrice: money(row.old_price),
    minPrice: bargaining ? money(row.min_price) : undefined,
    stock: row.stock,
    inStock: row.stock > 0,
    ...(full
      ? {
          brand: row.brand,
          usedInfo: row.used_info ?? undefined,
          specs: row.specs ?? undefined,
          description: String(row.description ?? '').slice(0, 500),
        }
      : {}),
    url: `${SITE_URL}/product/${row.slug}`,
  }
}

interface ShopRow {
  name: string
  city: string
  city_ky: string
  address: string
  address_ky: string
  working_hours: string
  working_hours_ky: string
  phones: string[]
  whatsapp: string
  telegram: string
  instagram: string
  map_url: string
}

async function shopInfo(lang: Lang): Promise<string> {
  const { data } = await adminDb()
    .from('shop_settings')
    .select('name, city, city_ky, address, address_ky, working_hours, working_hours_ky, phones, whatsapp, telegram, instagram, map_url')
    .eq('id', true)
    .maybeSingle()
  const s = data as ShopRow | null
  if (!s) return 'Нет данных — адрес и часы уточнит менеджер.'
  const pick = (ru: string, ky: string) => (lang === 'ky' && ky.trim() ? ky : ru).trim()
  const lines = [
    `Название: ${s.name}`,
    pick(s.city, s.city_ky) && `Город: ${pick(s.city, s.city_ky)}`,
    pick(s.address, s.address_ky) && `Адрес: ${pick(s.address, s.address_ky)}`,
    pick(s.working_hours, s.working_hours_ky) && `Часы работы: ${pick(s.working_hours, s.working_hours_ky)}`,
    s.phones?.length && `Телефоны: ${s.phones.join(', ')}`,
    s.whatsapp && `WhatsApp: +${s.whatsapp}`,
    s.instagram && `Instagram: @${s.instagram}`,
    s.map_url && `На карте: ${s.map_url}`,
  ].filter(Boolean)
  return lines.join('\n')
}

// ---------- Поиск ----------

/** Разговорные и русские названия → как в каталоге. */
const ALIASES: [RegExp, string][] = [
  [/^(айфон|айфан|iphon)/, 'iphone'],
  [/^(самсунг|самсун|samsun)/, 'samsung'],
  [/^галакси/, 'galaxy'],
  [/^(сяоми|ксиоми|шаоми|ксяоми|xiaom)/, 'xiaomi'],
  [/^редми/, 'redmi'],
  [/^поко/, 'poco'],
  [/^макбук/, 'macbook'],
  [/^айпад/, 'ipad'],
  [/^(эйрподс|аирподс|эирподс|airpod)/, 'airpods'],
  [/^(дайсон|дисон)/, 'dyson'],
  [/^(эпл|эппл|апл|эпол)/, 'apple'],
  [/^(хуавей|хуавэй)/, 'huawei'],
  [/^хонор/, 'honor'],
  [/^пиксел/, 'pixel'],
  [/^гармин/, 'garmin'],
  [/^(вотч|воч)/, 'watch'],
  [/^ультра/, 'ultra'],
  [/^(телефон|смартфон|телефондор)/, 'смартфон'],
  [/^(наушник|кулакчын)/, 'наушник'],
  [/^(часы|саат)/, 'час'],
  [/^ноутбук/, 'ноутбук'],
  [/^фен/, 'фен'],
  [/^(чехол|чехл)/, 'чехл'],
  [/^(зарядк|зарядн)/, 'заряд'],
]

function normalizeWord(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е')
  for (const [pattern, replacement] of ALIASES) if (pattern.test(w)) return replacement
  // «гигов», «гб» → «гб»; «128гб» → «128» + «гб» разбирается выше
  if (/^(гиг|gb|гб)/.test(w)) return 'гб'
  // Русские окончания: «наушники», «наушниками» → основа.
  return w.length > 6 ? w.slice(0, w.length - 2) : w
}

function searchIn(products: ProductRow[], query: string, condition?: string): ProductRow[] {
  let list = products
  if (condition === 'new' || condition === 'used') list = list.filter((p) => p.condition === condition)
  const words = query
    .toLowerCase()
    .replace(/(\d)(гб|gb|tb|тб)/g, '$1 $2')
    .split(/[^\p{L}\p{N}+]+/u)
    .filter((w) => w.length > 1 || /\d/.test(w))
    .map(normalizeWord)
    .slice(0, 8)
  if (words.length === 0) return list.slice(0, 15)

  const scored = list.map((p) => {
    const name = `${p.name} ${p.brand}`.toLowerCase().replace(/ё/g, 'е')
    const extra = `${p.category?.name ?? ''} ${p.description ?? ''} ${JSON.stringify(p.specs ?? {})}`.toLowerCase()
    let score = 0
    for (const w of words) {
      if (name.includes(w)) score += /\d/.test(w) ? 3 : 2
      else if (extra.includes(w)) score += 1
    }
    if (p.stock > 0) score += 0.5
    return { p, score }
  })
  const best = scored.filter((s) => s.score >= 1).sort((a, b) => b.score - a.score)
  return best.slice(0, 12).map((s) => s.p)
}

/** Товар по ID, а если модель дала название вместо ID — по названию. */
function resolveProduct(products: ProductRow[], idOrName: string): ProductRow | null {
  const value = String(idOrName ?? '').trim()
  if (!value) return null
  const byId = products.find((p) => p.id === value)
  if (byId) return byId
  const lower = value.toLowerCase()
  const exact = products.find((p) => p.name.toLowerCase() === lower)
  if (exact) return exact
  const found = searchIn(products, value)
  return found[0] ?? null
}

// ---------- Инструменты и подсказка ----------

function tools(behavior: BotBehavior): ToolDef[] {
  const list: ToolDef[] = [
    {
      name: 'search_products',
      description:
        'Подробности о товарах: характеристики, состояние Б/У, описание. Список всех товаров с ценами уже есть в подсказке — вызывай, когда нужны детали или сравнение.',
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
        'Оформить заявку на один товар. Оплата при получении. Нужны имя и телефон клиента и способ получения; для доставки — адрес (или геолокация из чата). Вызывай, когда клиент согласился и дал данные.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID товара из каталога в подсказке' },
          quantity: { type: 'integer', minimum: 1 },
          customerName: { type: 'string' },
          customerPhone: { type: 'string', description: 'Телефон, например +996555123456' },
          deliveryType: { type: 'string', enum: ['pickup', 'delivery'] },
          address: { type: 'string', description: 'Адрес доставки или ссылка на геолокацию из чата' },
          desiredDate: { type: 'string', description: 'YYYY-MM-DD, если клиент назвал' },
          desiredTime: { type: 'string', description: 'HH:MM, если клиент назвал' },
          agreedPrice: { type: 'integer', description: 'Цена за штуку числом, если договорились о скидке' },
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
        'Передать разговор живому менеджеру. ТОЛЬКО в случаях из списка category. НЕЛЬЗЯ передавать, если товара нет в каталоге, клиент спрашивает цену, наличие, совет, подбор по бюджету, хочет скидку или оформить заявку — это твоя работа: предложи альтернативы из каталога.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['customer_asked_human', 'complaint', 'warranty_or_return', 'trade_in_evaluation', 'order_problem'],
            description:
              'customer_asked_human — клиент сам попросил человека/менеджера/позвонить; complaint — жалоба, конфликт; warranty_or_return — гарантия, ремонт, возврат; trade_in_evaluation — клиент хочет оценку своего устройства; order_problem — проблема с уже оформленной заявкой или create_order не сработал дважды.',
          },
          reason: { type: 'string', description: 'Коротко по-русски, что нужно клиенту' },
        },
        required: ['category', 'reason'],
      },
    })
  }
  return list
}

function catalogLines(products: ProductRow[]): string {
  if (products.length === 0) return 'Каталог пуст — товаров сейчас нет.'
  return products
    .slice(0, CATALOG_LIMIT)
    .map((p) => {
      const parts = [
        `id=${p.id}`,
        p.name,
        p.category?.name ?? '',
        p.condition === 'used' ? 'Б/У' : 'новый',
        money(p.price) + (p.old_price ? ` (было ${money(p.old_price)})` : ''),
        p.stock > 0 ? `в наличии ${p.stock} шт.` : 'нет в наличии',
      ]
      return `- ${parts.filter(Boolean).join(' | ')}`
    })
    .join('\n')
}

interface PromptContext {
  behavior: BotBehavior
  customerName: string
  /** «Telegram» или «WhatsApp» — где идёт переписка. */
  channelName: string
  lang: Lang
  voice: boolean
  shop: string
  catalog: string
}

function system(c: PromptContext): string {
  const today = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Bishkek', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rules = [
    `Ты — продавец-консультант магазина электроники и переписываешься с клиентом в ${c.channelName}. Веди себя как живой, опытный и доброжелательный продавец, а не как справочная.`,
    '',
    'Как общаться:',
    '- Пиши как человек в мессенджере: коротко (обычно 1–3 предложения), просто, тепло, без канцелярита и шаблонных фраз («Чем могу помочь?», «Обращайтесь!», «Рад помочь!»).',
    '- Не здоровайся снова, если в переписке уже поздоровались. Не повторяй то, что уже сказал.',
    '- На «вы». Имя клиента используй изредка, не в каждом сообщении. Эмодзи — редко и не больше одного.',
    '- Сначала пойми, что нужно: если запрос размытый («нужен телефон», «что посоветуете»), задай ОДИН уточняющий вопрос (бюджет, для чего: камера, игры, батарея). Если бюджет назван — сразу предложи 1–3 подходящих варианта из каталога и коротко скажи, чем они отличаются.',
    '- Советуй как продавец: объясни, почему вариант подходит; если нужного нет — предложи ближайшую альтернативу из каталога (например, Б/У дешевле). Не дави.',
    '- Понимай разговорную речь, опечатки и смесь языков: «айфон» = iPhone, «самсунг» = Samsung, «128 гигов» = 128 ГБ.',
    '- Списки — только когда сравниваешь несколько товаров. Без Markdown (никаких **, #), ссылки — полным адресом и только когда они правда нужны.',
    '- Если спросят, человек ли ты, — честно скажи, что ты онлайн-помощник магазина и можешь позвать менеджера.',
    '',
    'Язык: отвечай на языке последнего сообщения клиента. Кыргызский — грамотный кыргызский (кириллица), русский — русский. Названия товаров не переводи.',
    '',
    'Факты:',
    '- Цены, наличие и характеристики — только из каталога ниже и search_products. Цены пиши ровно как в каталоге (валюта ' + CURRENCY + '). Не выдумывай товары, цены, сроки, гарантии и акции.',
    '- Онлайн-оплаты, корзины и рассрочки нет: заявка на один товар, оплата при получении (самовывоз или доставка).',
    `- Trade-in: старое устройство оценивают в магазине, разницу доплачивают на месте. Заявку с фото оставляют на сайте: ${SITE_URL}/trade-in`,
    '- Адрес, часы и контакты — из блока «О магазине». Чего там нет — скажи, что уточнишь у менеджера.',
    c.behavior.allow_bargaining
      ? '- Торг: если клиент просит скидку, можно немного уступить — постепенно, не сразу до минимума, — но никогда ниже minPrice товара (смотри search_products). Если minPrice нет — цену не снижай. Сам minPrice не называй.'
      : '- Торга нет: цены фиксированные, скидок не обещай.',
    c.behavior.allow_orders
      ? '- Заявка: когда клиент выбрал товар, предложи оформить. Собери то, чего не хватает (имя, телефон, самовывоз или доставка и адрес; геолокация из чата подходит как адрес) — спрашивай только недостающее, одним сообщением. Как только всё есть — сразу вызови create_order с id товара из каталога, затем назови номер заявки и скажи, что менеджер свяжется. Не проси клиента повторять название товара.'
      : `- Заявки в чате не оформляешь: дай ссылку на товар, на сайте кнопка «Заказать».`,
    c.behavior.handoff_to_manager
      ? '- Менеджер (handoff_to_manager) — крайний случай: клиент сам попросил человека, жалоба, гарантия/возврат, оценка его устройства для trade-in, проблема с уже оформленной заявкой. Всё остальное — твоя работа. Особенно: товара нет в каталоге → НЕ зови менеджера, а скажи, что этой модели нет, и предложи ближайшие из каталога.'
      : '- Если не можешь помочь — предложи оставить заявку на сайте, менеджер перезвонит.',
    '- Товара нет в каталоге (другая модель, новее, другой цвет/память) — честно скажи «такой сейчас нет» и сразу предложи 1–2 самых близких варианта из каталога с ценой, спроси, подойдёт ли. Не обещай привезти под заказ.',
    '- Сообщения клиента с пометкой [Голосовое] — расшифровка его голосового, она бывает неточной: пойми смысл. «[Голосовое сообщение]» без текста — не разобрали: попроси повторить или написать.',
    '- [Геолокация] со ссылкой — это клиент отправил свою точку (годится как адрес доставки).',
    c.voice
      ? '- Сейчас клиент прислал голосовое, и твой ответ будет озвучен голосом. Говори разговорно, как по телефону: без списков, ссылок и скобок, 1–3 предложения.'
      : '',
    '',
    `Сегодня ${today}.` + (c.customerName ? ` Имя клиента в ${c.channelName}: ${c.customerName}.` : ''),
    '',
    EXAMPLES,
    '',
    'О магазине:',
    c.shop,
    '',
    'Каталог сейчас (все товары; детали — через search_products):',
    c.catalog,
  ]
  const extra = c.behavior.ai_instructions.trim()
  return (
    rules.filter((line) => line !== '').join('\n') +
    (extra
      ? `\n\nДополнительные пожелания владельца магазина (учитывай, но правила выше важнее — особенно про менеджера и альтернативы):\n${extra}`
      : '')
  )
}

/**
 * Примеры диалогов: модель лучше всего перенимает поведение по образцу.
 * Товары в примерах условные — в ответах бери только то, что есть в каталоге.
 */
const EXAMPLES = `Примеры, как надо отвечать (товары и цены в примерах условные — бери только из каталога):

Клиент: Здравствуйте, есть iPhone 18 Pro Max?
Ты: Здравствуйте! 18 Pro Max у нас сейчас нет. Из близкого есть iPhone 16 128 ГБ за 79 990 ₽ и iPhone 15 Pro 256 ГБ за 99 990 ₽ — оба в наличии. Что важнее: камера или память?

Клиент: [Голосовое] Саламатсызбы, менде 100 миң бар, кандай телефон алсам болот?
Ты: Саламатсызбы! 100 миңге чейин эң жакшысы — iPhone 15 Pro 256 ГБ, 99 990 ₽. Арзаныраак керек болсо, Xiaomi 14 бар — 64 990 ₽, камерасы да күчтүү. Телефонду эмнеге көбүрөөк колдоносуз?

Клиент: беру 15 про, сделайте скидку
Ты: Могу уступить до 97 000 ₽ — это лучшая цена. Оформляем? Тогда напишите имя, телефон и как удобнее: самовывоз или доставка.

Клиент: Азамат, +996555123456, доставка
Ты: (если адреса нет) Куда привезти? Можно просто отправить геолокацию.
Клиент: [Геолокация] https://...
Ты: (вызываешь create_order, затем) Готово, заявка №1047 на iPhone 15 Pro. Менеджер позвонит, чтобы согласовать время. Оплата при получении.

Клиент: позовите живого человека
Ты: (вызываешь handoff_to_manager с category=customer_asked_human) Хорошо, позвал менеджера — он напишет вам здесь.`

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
    const text = row.text.startsWith(VOICE_MARK) ? row.text.slice(VOICE_MARK.length) : row.text
    if (row.sender === 'customer') {
      // Несколько сообщений клиента подряд — одним блоком (так пишут в мессенджерах).
      const last = messages[messages.length - 1]
      if (last?.role === 'user') last.text += `\n${text}`
      else messages.push({ role: 'user', text })
    } else {
      if (messages.length === 0) continue // первым должен быть клиент
      const content = row.sender === 'manager' ? `[Менеджер] ${text}` : text
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant') last.text += `\n${content}`
      else messages.push({ role: 'assistant', text: content })
    }
  }
  return messages
}

// ---------- Действия ----------

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

async function createOrder(
  input: OrderInput,
  chat: ChatInfo,
  products: ProductRow[],
  bargaining: boolean,
  source: Channel['kind'],
) {
  const db = adminDb()
  const found = resolveProduct(products, input.productId)
  if (!found) return { error: 'Товар не найден. Возьми id из каталога в подсказке.' }
  const { data: product } = await db.from('products').select('id, price, min_price').eq('id', found.id).maybeSingle()
  if (!product) return { error: 'Товар не найден. Возьми id из каталога в подсказке.' }

  const notes: string[] = []
  const agreed = input.agreedPrice === undefined ? undefined : Math.round(Number(input.agreedPrice))
  if (agreed !== undefined && Number.isFinite(agreed) && agreed !== product.price) {
    const floor = product.min_price ?? product.price
    if (!bargaining || agreed < floor) {
      return { error: 'Такую цену дать нельзя. Предложите клиенту цену не ниже допустимой.' }
    }
    notes.push(`Цена по договорённости в ${source === 'whatsapp' ? 'WhatsApp' : 'Telegram'}: ${money(agreed)} за шт. (на сайте ${money(product.price)})`)
  }
  if (input.comment?.trim()) notes.push(input.comment.trim())

  const phone = String(input.customerPhone ?? '').replace(/[^\d+]/g, '')
  if (phone.replace(/\D/g, '').length < 9) return { error: 'Нужен полный номер телефона клиента.' }
  if (input.deliveryType === 'delivery' && !input.address?.trim()) {
    return { error: 'Для доставки нужен адрес или геолокация.' }
  }
  const { data, error } = await db.rpc('create_order', {
    p_product_id: product.id,
    p_quantity: Math.max(1, Math.round(Number(input.quantity) || 1)),
    p_customer_name: String(input.customerName ?? '').trim(),
    p_customer_phone: phone,
    p_delivery_type: input.deliveryType === 'delivery' ? 'delivery' : 'pickup',
    p_address: input.address?.trim() ?? '',
    p_desired_date: /^\d{4}-\d{2}-\d{2}$/.test(input.desiredDate ?? '') ? input.desiredDate : null,
    p_desired_time: /^\d{2}:\d{2}$/.test(input.desiredTime ?? '') ? input.desiredTime : null,
    p_comment: notes.join('\n').slice(0, 1000),
    p_source: source,
  })
  if (error) return { error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: number }
  await db.from('bot_chats').update({ order_id: row.order_id, customer_phone: phone }).eq('id', chat.id)
  return { ok: true, orderNumber: row.order_number, product: found.name, payment: 'при получении' }
}

const HANDOFF_CATEGORIES = ['customer_asked_human', 'complaint', 'warranty_or_return', 'trade_in_evaluation', 'order_problem']
/** Причины, с которыми бот справляется сам: товара нет, подбор, совет, скидка. */
const SELF_SERVE_REASON = /нет в (каталоге|наличии)|отсутств|не найден|нет такого|такого товара|подбор|подобрать|бюджет|посовет|скидк|торг/i

/**
 * Проверка перед передачей менеджеру: модели любят «звать человека» при любом затруднении.
 * null — передавать можно; строка — почему нельзя (уходит модели как ошибка инструмента).
 */
/** Клиент просит живого человека (ru/ky). */
const ASKS_HUMAN = /человек|менеджер|оператор|консультант|живо[йм]|позвон|звонок|перезвон|адам|кызматкер|чалып|чалыңыз/i

function handoffBlocked(category: string, reason: string, lastCustomerText: string): string | null {
  if (!HANDOFF_CATEGORIES.includes(category)) {
    return 'Передача менеджеру не нужна: такой причины нет в списке. Помоги клиенту сам.'
  }
  // Клиент сам попросил человека — передаём (если он правда об этом просил).
  if (category === 'customer_asked_human' && ASKS_HUMAN.test(lastCustomerText)) return null
  // Остальные категории модель иногда ставит «для вида», а по сути товара просто нет — проверяем причину.
  if (SELF_SERVE_REASON.test(reason)) {
    return 'Не передавай менеджеру. Это твоя работа: если товара нет — скажи об этом и предложи 1–3 ближайших варианта из каталога с ценами; если нужен подбор — спроси бюджет или предложи варианты; заявку оформи сам через create_order.'
  }
  return null
}

async function handoff(chat: ChatInfo, reason: string) {
  await adminDb()
    .from('bot_chats')
    .update({ mode: 'manager', handoff_reason: String(reason || 'Нужен менеджер').slice(0, 300) })
    .eq('id', chat.id)
  return { ok: true, note: 'Менеджер подключится к чату. Коротко и по-человечески скажи клиенту, что позвал менеджера.' }
}

// ---------- Отправка ----------

const URL_RE = /https?:\/\/\S+/g

/** Убрать Markdown, если модель всё же его написала. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Текст для озвучки: без ссылок и эмодзи, «₽», «ГБ» — словами на языке ответа (не русские слова в кыргызской речи). */
function speakable(text: string, lang: Lang): string {
  return text
    .replace(URL_RE, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    // «79 990 ₽» → «79990 рубль»: цельное число озвучивается одним числом, а не «79» и «990».
    .replace(/(\d{1,3}(?:[  ]\d{3})*)\s*₽/g, (_m, num: string) => `${num.replace(/[  ]/g, '')} ${lang === 'ky' ? 'рубль' : 'рублей'}`)
    .replace(/(\d)\s*(ГБ|Гб|GB)(?![\p{L}])/gu, '$1 гигабайт')
    .replace(/(\d)\s*(ТБ|Тб|TB)(?![\p{L}])/gu, '$1 терабайт')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Пауза «как у человека»: чем длиннее ответ, тем дольше печатает (но не слишком). */
function typingDelay(text: string, elapsedMs: number): number {
  const wanted = Math.min(4000, 600 + text.length * 25)
  return Math.max(0, wanted - elapsedMs)
}

export interface ReplyOptions {
  /** Клиент прислал голосовое — ответить голосом. */
  voice?: boolean
}

/**
 * Генерирует и отправляет ответ клиенту. Любая ошибка ИИ → чат уходит менеджеру,
 * клиент не остаётся без ответа.
 */
export async function replyWithAi(
  channel: Channel,
  chat: ChatInfo,
  behavior: BotBehavior,
  ai: BotAi,
  options: ReplyOptions = {},
): Promise<void> {
  const db = adminDb()
  const startedAt = Date.now()
  const wantVoice = Boolean(options.voice && ai.settings.voice_replies)
  const stopTyping = channel.typing(wantVoice)
  let lang: Lang = 'ru'
  try {
    const messages = await history(chat.id)
    if (messages.length === 0) return
    const lastCustomer = [...messages].reverse().find((m) => m.role === 'user')
    lang = lastCustomer && looksKyrgyz(lastCustomer.text) ? 'ky' : 'ru'
    const [products, shop] = await Promise.all([loadProducts(behavior.allow_bargaining), shopInfo(lang)])
    const systemPrompt = system({
      behavior,
      customerName: chat.customer_name,
      channelName: channel.kind === 'whatsapp' ? 'WhatsApp' : 'Telegram',
      lang,
      voice: wantVoice,
      shop,
      catalog: catalogLines(products),
    })
    const toolList = tools(behavior)
    let reply = ''
    let handedOff = false

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await chatStep({
        provider: ai.settings.bot_provider,
        apiKey: ai.key,
        model: ai.settings.bot_model,
        system: systemPrompt,
        tools: toolList,
        messages,
        effort: 'medium',
        verbosity: 'low',
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
            const found = searchIn(products, String(input.query ?? ''), input.condition as string | undefined)
            result = found.length
              ? found.map((p) => productCard(p, behavior.allow_bargaining, true))
              : { found: 0, note: 'По запросу ничего нет. Предложи похожее из каталога в подсказке.' }
          } else if (call.name === 'create_order' && behavior.allow_orders) {
            result = await createOrder(input as unknown as OrderInput, chat, products, behavior.allow_bargaining, channel.kind)
          } else if (call.name === 'handoff_to_manager' && behavior.handoff_to_manager) {
            const reason = String(input.reason ?? '')
            const blocked = handoffBlocked(String(input.category ?? ''), reason, lastCustomer?.text ?? '')
            if (blocked) {
              console.warn('bot handoff blocked', input.category, reason)
              result = { error: blocked }
            } else {
              result = await handoff(chat, reason)
              handedOff = true
            }
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

    reply = plain(reply)
    if (!reply) {
      if (!handedOff) await handoff(chat, 'Бот не смог ответить — ответьте клиенту')
      reply = FALLBACK_REPLY[lang]
    }

    await sleep(typingDelay(reply, Date.now() - startedAt))

    // На голосовое — только голос. Ссылки озвучить нельзя — они в подписи к голосовому.
    if (wantVoice) {
      try {
        // Язык озвучки — язык ответа (бот отвечает на языке клиента).
        const voiceLang: Lang = looksKyrgyz(reply) ? 'ky' : lang
        const audio = await synthesize(ai.settings, speakable(reply, voiceLang), voiceLang)
        if (audio) {
          const links = [...new Set(reply.match(URL_RE) ?? [])].join('\n').slice(0, 1000)
          await channel.sendVoice(audio, links || undefined)
          await db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: VOICE_MARK + reply })
          return
        }
      } catch (voiceError) {
        console.error('bot voice reply failed', voiceError) // ответим текстом
      }
    }
    await channel.sendText(reply)
    await db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: reply })
  } catch (error) {
    console.error('bot ai reply failed', error)
    await handoff(chat, 'ИИ не ответил — ответьте клиенту').catch(() => undefined)
    // Клиент не должен остаться в тишине.
    await channel
      .sendText(FALLBACK_REPLY[lang])
      .then(() => db.rpc('bot_record_outgoing', { p_chat_id: chat.id, p_sender: 'bot', p_text: FALLBACK_REPLY[lang] }))
      .catch(() => undefined)
  } finally {
    stopTyping()
  }
}
