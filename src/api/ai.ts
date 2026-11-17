// Искусственный интеллект (Claude, Anthropic): настройки и ИИ-ассистент админки.
//
//   - API-ключ Anthropic админ вставляет в «Настройках». connectAi → Edge Function `ai-admin`:
//     проверяет ключ и хранит его зашифрованным в Supabase Vault. Обратно — только 4 символа.
//   - Ассистент: `ai-admin` (action 'chat') отправляет переписку в Claude и возвращает ответ.
//     Если модель вызывает инструменты (создать категорию, товар…), их выполняет этот файл —
//     через те же функции слоя api, что и формы админки (проверки, RLS, обновление экранов).

import { FunctionsHttpError } from '@supabase/supabase-js'
import type {
  AiModel,
  AiSettings,
  AiSettingsInput,
  AssistantAction,
  AssistantChatItem,
  CategoryInput,
  DeviceGrade,
  OrderStatus,
  ProductCondition,
  ProductInput,
  ProductSpecs,
  SpecField,
  StatsPeriod,
  TradeInStatus,
  UsedInfo,
} from '../types'
import { emit, supabase, unwrap } from './client'
import { ApiError, getErrorMessage, type ApiErrorCode } from './errors'
import { createCategory, listCategories, updateCategory } from './categories'
import { adjustStock, createProduct, listProducts, updateProduct } from './products'
import { listOrders, updateOrderStatus } from './orders'
import { listTradeIns } from './tradeIns'
import { getShopStats } from './stats'

export const AI_MODEL_OPTIONS: { value: AiModel; label: string }[] = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — самый умный' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — быстрее и дешевле' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — самый быстрый и дешёвый' },
]

const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/
const MAX_INSTRUCTIONS = 4000
const MAX_STEPS = 15
const SETTINGS_COLUMNS = 'connected, key_hint, assistant_model, bot_model, assistant_instructions, updated_at'

interface SettingsRow {
  connected: boolean
  key_hint: string
  assistant_model: AiModel
  bot_model: AiModel
  assistant_instructions: string
  updated_at: string
}

function settingsFromRow(row: SettingsRow): AiSettings {
  return {
    connected: row.connected,
    keyHint: row.key_hint,
    assistantModel: row.assistant_model,
    botModel: row.bot_model,
    assistantInstructions: row.assistant_instructions,
    updatedAt: row.updated_at,
  }
}

async function callAiFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-admin', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string; code?: string } | null
      if (payload?.error) throw new ApiError((payload.code as ApiErrorCode) ?? 'storage', payload.error)
    }
    throw new ApiError('storage', 'Сервер ИИ не ответил. Проверьте интернет и повторите.')
  }
  return data as T
}

// ---------- Настройки ----------

export async function getAiSettings(): Promise<AiSettings> {
  const row = unwrap(
    await supabase.from('ai_settings').select(SETTINGS_COLUMNS).eq('id', true).single(),
    'Не удалось загрузить настройки ИИ',
  ) as SettingsRow
  return settingsFromRow(row)
}

export async function updateAiSettings(input: AiSettingsInput): Promise<AiSettings> {
  const changes: Record<string, unknown> = {}
  if (input.assistantModel !== undefined) changes.assistant_model = input.assistantModel
  if (input.botModel !== undefined) changes.bot_model = input.botModel
  if (input.assistantInstructions !== undefined) {
    const text = input.assistantInstructions.trim()
    if (text.length > MAX_INSTRUCTIONS) {
      throw new ApiError('validation', `Указания ассистенту — не длиннее ${MAX_INSTRUCTIONS} символов`)
    }
    changes.assistant_instructions = text
  }
  const row = unwrap(
    await supabase.from('ai_settings').update(changes).eq('id', true).select(SETTINGS_COLUMNS).single(),
    'Не удалось сохранить настройки ИИ',
  ) as SettingsRow
  emit(['aiSettings'])
  return settingsFromRow(row)
}

/** Сохраняет API-ключ Anthropic на сервере (сначала сервер проверяет его в Anthropic). */
export async function connectAi(key: string): Promise<AiSettings> {
  const clean = key.trim()
  if (!KEY_RE.test(clean)) {
    throw new ApiError('validation', 'Ключ не похож на API-ключ Anthropic. Он начинается с sk-ant-…')
  }
  await callAiFunction({ action: 'connect', key: clean })
  emit(['aiSettings'])
  return getAiSettings()
}

/** Удаляет ключ с сервера: ассистент и ИИ-ответы бота перестают работать. */
export async function disconnectAi(): Promise<AiSettings> {
  await callAiFunction({ action: 'disconnect' })
  emit(['aiSettings'])
  return getAiSettings()
}

// ---------- Ассистент ----------

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[] | Record<string, unknown>[]
}

/**
 * Разговор с ассистентом. `messages` — переписка в формате Claude (с блоками размышлений
 * и вызовами инструментов, передаётся обратно без изменений), `items` — то, что видит админ.
 */
export interface AssistantConversation {
  messages: ApiMessage[]
  items: AssistantChatItem[]
}

export const EMPTY_CONVERSATION: AssistantConversation = { messages: [], items: [] }

type Input = Record<string, unknown>

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const int = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined
const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined)

function need(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new ApiError('validation', `Не указано поле ${field}`)
  return value
}

function specFields(value: unknown): SpecField[] | undefined {
  return Array.isArray(value) ? (value as SpecField[]) : undefined
}

function usedInfo(value: unknown): UsedInfo | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const v = value as Input
  return {
    grade: (str(v.grade) ?? 'good') as DeviceGrade,
    batteryHealth: int(v.batteryHealth),
    warrantyMonths: int(v.warrantyMonths),
    defects: str(v.defects),
    kit: str(v.kit),
  }
}

function productPatch(input: Input): Partial<ProductInput> {
  const patch: Partial<ProductInput> = {
    categoryId: str(input.categoryId),
    name: str(input.name),
    brand: str(input.brand),
    description: str(input.description),
    condition: str(input.condition) as ProductCondition | undefined,
    usedInfo: usedInfo(input.usedInfo),
    price: int(input.price),
    minPrice: input.minPrice === null ? null : int(input.minPrice),
    costPrice: input.costPrice === null ? null : int(input.costPrice),
    stock: int(input.stock),
    isActive: bool(input.isActive),
    specs:
      input.specs && typeof input.specs === 'object' && !Array.isArray(input.specs)
        ? (input.specs as ProductSpecs)
        : undefined,
  }
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<ProductInput>
}

/** Выполняет один инструмент. Возвращает данные для модели и строку для админа. */
async function runTool(name: string, input: Input): Promise<{ data: unknown; summary: string }> {
  switch (name) {
    case 'list_categories': {
      const categories = await listCategories()
      return {
        data: categories.map(({ id, name, isActive, specFields }) => ({ id, name, isActive, specFields })),
        summary: `Просмотрены категории (${categories.length})`,
      }
    }
    case 'create_category': {
      const input2: CategoryInput = {
        name: need(str(input.name), 'name'),
        isActive: bool(input.isActive),
        specFields: specFields(input.specFields) ?? [],
      }
      const category = await createCategory(input2)
      return { data: { id: category.id, name: category.name }, summary: `Создана категория «${category.name}»` }
    }
    case 'update_category': {
      const category = await updateCategory(need(str(input.id), 'id'), {
        name: str(input.name),
        isActive: bool(input.isActive),
        sortOrder: int(input.sortOrder),
        specFields: specFields(input.specFields),
      })
      return { data: category, summary: `Изменена категория «${category.name}»` }
    }
    case 'list_products': {
      const products = await listProducts({
        search: str(input.search),
        categoryId: str(input.categoryId),
        condition: str(input.condition) as ProductCondition | undefined,
        limit: 50,
      })
      return {
        data: products.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          categoryId: p.categoryId,
          condition: p.condition,
          price: p.price,
          minPrice: p.minPrice,
          costPrice: p.costPrice,
          stock: p.stock,
          isActive: p.isActive,
          specs: p.specs,
          photos: p.images.length,
        })),
        summary: `Найдено товаров: ${products.length}`,
      }
    }
    case 'create_product': {
      const patch = productPatch(input)
      const product = await createProduct({
        brand: '',
        description: '',
        isActive: true,
        images: [],
        specs: {},
        ...patch,
        categoryId: need(patch.categoryId, 'categoryId'),
        name: need(patch.name, 'name'),
        price: patch.price ?? Number.NaN,
        stock: patch.stock ?? 0,
      })
      return {
        data: { id: product.id, name: product.name, slug: product.slug },
        summary: `Добавлен товар «${product.name}»`,
      }
    }
    case 'update_product': {
      const product = await updateProduct(need(str(input.id), 'id'), productPatch(input))
      return { data: { id: product.id, name: product.name }, summary: `Изменён товар «${product.name}»` }
    }
    case 'adjust_stock': {
      const delta = int(input.delta) ?? Number.NaN
      const product = await adjustStock(need(str(input.productId), 'productId'), delta)
      const sign = delta > 0 ? `+${delta}` : String(delta)
      return {
        data: { id: product.id, stock: product.stock },
        summary: `Остаток «${product.name}»: ${sign}, теперь ${product.stock} шт.`,
      }
    }
    case 'list_orders': {
      const orders = await listOrders({ status: str(input.status) as OrderStatus | undefined })
      return {
        data: orders.slice(0, 50).map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          source: o.source,
          productName: o.productName,
          quantity: o.quantity,
          price: o.price,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          deliveryType: o.deliveryType,
          address: o.address,
          desiredDate: o.desiredDate,
          desiredTime: o.desiredTime,
          comment: o.comment,
          createdAt: o.createdAt,
        })),
        summary: `Просмотрены заказы (${orders.length})`,
      }
    }
    case 'update_order_status': {
      const order = await updateOrderStatus(
        need(str(input.orderId), 'orderId'),
        need(str(input.status), 'status') as OrderStatus,
      )
      return { data: { number: order.number, status: order.status }, summary: `Заказ №${order.number}: статус изменён` }
    }
    case 'list_trade_ins': {
      const tradeIns = await listTradeIns({ status: str(input.status) as TradeInStatus | undefined })
      return {
        // Фото не отправляем — это тяжёлые data URL.
        data: tradeIns.slice(0, 50).map(({ photos, ...rest }) => ({ ...rest, photos: photos.length })),
        summary: `Просмотрены заявки trade-in (${tradeIns.length})`,
      }
    }
    case 'get_stats': {
      const days = int(input.days)
      const period: StatsPeriod = days === 7 || days === 90 ? days : 30
      const stats = await getShopStats(period)
      return {
        data: Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'daily')),
        summary: `Просмотрена статистика за ${period} дней`,
      }
    }
    default:
      throw new ApiError('validation', `Неизвестный инструмент ${name}`)
  }
}

interface ChatResponse {
  content: ContentBlock[]
  stopReason: string | null
}

/**
 * Отправляет поручение ассистенту и ведёт разговор, пока модель вызывает инструменты.
 * `onProgress` получает промежуточное состояние — окно показывает ход работы.
 */
export async function askAssistant(
  conversation: AssistantConversation,
  text: string,
  onProgress?: (conversation: AssistantConversation) => void,
): Promise<AssistantConversation> {
  const clean = text.trim()
  if (!clean) throw new ApiError('validation', 'Напишите поручение')

  const messages: ApiMessage[] = [...conversation.messages, { role: 'user', content: clean }]
  const items: AssistantChatItem[] = [...conversation.items, { role: 'user', text: clean }]
  const actions: AssistantAction[] = []
  const texts: string[] = []
  const reply = (): AssistantChatItem => ({ role: 'assistant', text: texts.join('\n\n'), actions: [...actions] })

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await callAiFunction<ChatResponse>({ action: 'chat', messages })
      messages.push({ role: 'assistant', content: response.content })

      const said = response.content
        .filter((block) => block.type === 'text' && block.text?.trim())
        .map((block) => block.text!.trim())
      texts.push(...said)

      if (response.stopReason === 'refusal') {
        texts.push('ИИ отказался выполнять это поручение.')
        break
      }
      const calls = response.content.filter((block) => block.type === 'tool_use')
      if (calls.length === 0) break

      const results: Record<string, unknown>[] = []
      for (const call of calls) {
        try {
          const { data, summary } = await runTool(call.name ?? '', (call.input ?? {}) as Input)
          actions.push({ tool: call.name ?? '', summary, ok: true })
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(data) })
        } catch (error) {
          const message = getErrorMessage(error)
          actions.push({ tool: call.name ?? '', summary: `Ошибка: ${message}`, ok: false })
          results.push({ type: 'tool_result', tool_use_id: call.id, content: message, is_error: true })
        }
      }
      messages.push({ role: 'user', content: results })
      onProgress?.({ messages, items: [...items, reply()] })

      if (step === MAX_STEPS - 1) texts.push('Остановился: слишком много шагов. Напишите, продолжить ли.')
    }
  } catch (error) {
    // Сбой может быть только на запросе к серверу, когда последнее сообщение — от админа
    // (текст или результаты инструментов). Переписку сохраняем: её можно продолжить.
    return {
      messages,
      items: [...items, { role: 'assistant', text: getErrorMessage(error), actions, error: true }],
    }
  }

  return { messages, items: [...items, reply()] }
}
