// Искусственный интеллект: настройки, ключи провайдеров и ИИ-ассистент админки.
//
//   - Ключи Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google) и ElevenLabs админ вставляет
//     в «Настройках». connectAiKey → Edge Function `ai-admin`: проверяет ключ у провайдера
//     и хранит его зашифрованным в Supabase Vault. Обратно — только 4 символа и список моделей.
//   - Ассистент: `ai-admin` (action 'chat') отправляет переписку выбранной модели и возвращает
//     ответ. Если модель вызывает инструменты (создать категорию, товар…), их выполняет этот файл —
//     через те же функции слоя api, что и формы админки (проверки, RLS, обновление экранов).

import { FunctionsHttpError } from '@supabase/supabase-js'
import type {
  AiProvider,
  AiSecretProvider,
  AiSettings,
  AiSettingsInput,
  AssistantAction,
  AssistantChatItem,
  CategoryInput,
  DeviceGrade,
  ElevenLabsVoice,
  OrderStatus,
  ProductCondition,
  ProductInput,
  ProductSpecs,
  SpecField,
  StatsPeriod,
  TradeInStatus,
  UsedInfo,
  VoiceProvider,
} from '../types'
import { msg } from '../i18n'
import { emit, supabase, unwrap } from './client'
import { ApiError, getErrorMessage, type ApiErrorCode } from './errors'
import { createCategory, listCategories, updateCategory } from './categories'
import { adjustStock, createProduct, listProducts, updateProduct } from './products'
import { listOrders, updateOrderStatus } from './orders'
import { listTradeIns } from './tradeIns'
import { getShopStats } from './stats'

export const AI_PROVIDERS: AiProvider[] = ['anthropic', 'openai', 'google']
export const AI_SECRET_PROVIDERS: AiSecretProvider[] = ['anthropic', 'openai', 'google', 'elevenlabs']

export const AI_PROVIDER_NAMES: Record<AiSecretProvider, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  google: 'Gemini',
  elevenlabs: 'ElevenLabs',
}

export const AI_KEY_PLACEHOLDERS: Record<AiSecretProvider, string> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  google: 'AIza…',
  elevenlabs: 'sk_…',
}

const KEY_PATTERNS: Record<AiSecretProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[A-Za-z0-9_-]{30,}$/,
  elevenlabs: /^[A-Za-z0-9_]{20,}$/,
}

export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']
export const ELEVENLABS_MODELS = ['eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5']

const VOICE_ID_RE = /^[A-Za-z0-9_-]{5,64}$/
const MAX_INSTRUCTIONS = 4000
const MAX_STEPS = 15
const SETTINGS_COLUMNS =
  'assistant_provider, assistant_model, bot_provider, bot_model, assistant_instructions, key_hints, models, ' +
  'voice_replies, voice_provider, elevenlabs_voice_id, elevenlabs_model, openai_voice, updated_at'

interface SettingsRow {
  assistant_provider: AiProvider
  assistant_model: string
  bot_provider: AiProvider
  bot_model: string
  assistant_instructions: string
  key_hints: AiSettings['keyHints'] | null
  models: AiSettings['models'] | null
  voice_replies: boolean
  voice_provider: VoiceProvider
  elevenlabs_voice_id: string
  elevenlabs_model: string
  openai_voice: string
  updated_at: string
}

function settingsFromRow(row: SettingsRow): AiSettings {
  return {
    assistantProvider: row.assistant_provider,
    assistantModel: row.assistant_model,
    botProvider: row.bot_provider,
    botModel: row.bot_model,
    assistantInstructions: row.assistant_instructions,
    keyHints: row.key_hints ?? {},
    models: row.models ?? {},
    voiceReplies: row.voice_replies,
    voiceProvider: row.voice_provider,
    elevenlabsVoiceId: row.elevenlabs_voice_id,
    elevenlabsModel: row.elevenlabs_model,
    openaiVoice: row.openai_voice,
    updatedAt: row.updated_at,
  }
}

/** Подключён ли ИИ, выбранный для ассистента. */
export function isAssistantReady(settings: AiSettings | null | undefined): boolean {
  return Boolean(settings && settings.keyHints[settings.assistantProvider])
}

async function callAiFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-admin', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string; code?: string } | null
      if (payload?.error) throw new ApiError((payload.code as ApiErrorCode) ?? 'storage', payload.error)
    }
    throw new ApiError('storage', msg().assistant.serverDown)
  }
  return data as T
}

// ---------- Настройки ----------

export async function getAiSettings(): Promise<AiSettings> {
  const row = unwrap(
    await supabase.from('ai_settings').select(SETTINGS_COLUMNS).eq('id', true).single(),
    msg().adminSettings.errAiLoad,
  ) as unknown as SettingsRow
  return settingsFromRow(row)
}

export async function updateAiSettings(input: AiSettingsInput): Promise<AiSettings> {
  const t = msg().adminSettings
  const changes: Record<string, unknown> = {}
  if (input.assistantProvider !== undefined) changes.assistant_provider = input.assistantProvider
  if (input.assistantModel !== undefined) changes.assistant_model = input.assistantModel
  if (input.botProvider !== undefined) changes.bot_provider = input.botProvider
  if (input.botModel !== undefined) changes.bot_model = input.botModel
  if (input.assistantInstructions !== undefined) {
    const text = input.assistantInstructions.trim()
    if (text.length > MAX_INSTRUCTIONS) throw new ApiError('validation', t.errAssistantInstructions(MAX_INSTRUCTIONS))
    changes.assistant_instructions = text
  }
  if (input.voiceReplies !== undefined) changes.voice_replies = input.voiceReplies
  if (input.voiceProvider !== undefined) changes.voice_provider = input.voiceProvider
  if (input.elevenlabsVoiceId !== undefined) {
    const id = input.elevenlabsVoiceId.trim()
    if (id && !VOICE_ID_RE.test(id)) throw new ApiError('validation', t.voiceIdError)
    changes.elevenlabs_voice_id = id
  }
  if (input.elevenlabsModel !== undefined) changes.elevenlabs_model = input.elevenlabsModel
  if (input.openaiVoice !== undefined) changes.openai_voice = input.openaiVoice
  const row = unwrap(
    await supabase.from('ai_settings').update(changes).eq('id', true).select(SETTINGS_COLUMNS).single(),
    t.errAiSave,
  ) as unknown as SettingsRow
  emit(['aiSettings'])
  return settingsFromRow(row)
}

/** Сохраняет API-ключ на сервере (сначала сервер проверяет его у провайдера). */
export async function connectAiKey(provider: AiSecretProvider, key: string): Promise<{ voices: ElevenLabsVoice[] }> {
  const clean = key.trim()
  if (!KEY_PATTERNS[provider].test(clean)) {
    throw new ApiError('validation', msg().adminSettings.errKeyFormat(AI_PROVIDER_NAMES[provider]))
  }
  const result = await callAiFunction<{ voices?: ElevenLabsVoice[] }>({ action: 'connect', provider, key: clean })
  emit(['aiSettings'])
  return { voices: result.voices ?? [] }
}

/** Удаляет ключ с сервера. */
export async function disconnectAiKey(provider: AiSecretProvider): Promise<void> {
  await callAiFunction({ action: 'disconnect', provider })
  emit(['aiSettings'])
}

/** Голоса из аккаунта ElevenLabs (по сохранённому ключу). */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const result = await callAiFunction<{ voices?: ElevenLabsVoice[] }>({ action: 'voices' })
  return result.voices ?? []
}

// ---------- Ассистент ----------

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

/** Переписка в общем формате ai-admin (одинаковом для Claude, ChatGPT и Gemini). */
type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[]; raw?: unknown }
  | { role: 'tool'; results: { id: string; name: string; content: string; isError?: boolean }[] }

/**
 * Разговор с ассистентом. `messages` — переписка для сервера (служебные данные модели
 * передаются обратно без изменений), `items` — то, что видит админ.
 */
export interface AssistantConversation {
  messages: ChatMessage[]
  items: AssistantChatItem[]
}

export const EMPTY_CONVERSATION: AssistantConversation = { messages: [], items: [] }

/** Проверка сохранённого разговора (в старом формате его нельзя продолжить). */
export function isAssistantConversation(value: unknown): value is AssistantConversation {
  if (!value || typeof value !== 'object') return false
  const v = value as AssistantConversation
  if (!Array.isArray(v.items) || !Array.isArray(v.messages)) return false
  return v.messages.every((m) =>
    m?.role === 'user' || m?.role === 'assistant'
      ? typeof (m as { text?: unknown }).text === 'string'
      : m?.role === 'tool' && Array.isArray(m.results),
  )
}

type Input = Record<string, unknown>

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const int = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined
const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined)

function need(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new ApiError('validation', msg().assistant.missingField(field))
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
    oldPrice: input.oldPrice === null ? null : int(input.oldPrice),
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
        summary: msg().assistant.viewedCategories(categories.length),
      }
    }
    case 'create_category': {
      const input2: CategoryInput = {
        name: need(str(input.name), 'name'),
        isActive: bool(input.isActive),
        specFields: specFields(input.specFields) ?? [],
      }
      const category = await createCategory(input2)
      return { data: { id: category.id, name: category.name }, summary: msg().assistant.createdCategory(category.name) }
    }
    case 'update_category': {
      const category = await updateCategory(need(str(input.id), 'id'), {
        name: str(input.name),
        isActive: bool(input.isActive),
        sortOrder: int(input.sortOrder),
        specFields: specFields(input.specFields),
      })
      return { data: category, summary: msg().assistant.updatedCategory(category.name) }
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
          oldPrice: p.oldPrice,
          minPrice: p.minPrice,
          costPrice: p.costPrice,
          stock: p.stock,
          isActive: p.isActive,
          specs: p.specs,
          photos: p.images.length,
        })),
        summary: msg().assistant.foundProducts(products.length),
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
        summary: msg().assistant.createdProduct(product.name),
      }
    }
    case 'update_product': {
      const product = await updateProduct(need(str(input.id), 'id'), productPatch(input))
      return { data: { id: product.id, name: product.name }, summary: msg().assistant.updatedProduct(product.name) }
    }
    case 'adjust_stock': {
      const delta = int(input.delta) ?? Number.NaN
      const product = await adjustStock(need(str(input.productId), 'productId'), delta)
      const sign = delta > 0 ? `+${delta}` : String(delta)
      return {
        data: { id: product.id, stock: product.stock },
        summary: msg().assistant.stockChanged(product.name, sign, product.stock),
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
        summary: msg().assistant.viewedOrders(orders.length),
      }
    }
    case 'update_order_status': {
      const order = await updateOrderStatus(
        need(str(input.orderId), 'orderId'),
        need(str(input.status), 'status') as OrderStatus,
      )
      return { data: { number: order.number, status: order.status }, summary: msg().assistant.orderStatus(order.number) }
    }
    case 'list_trade_ins': {
      const tradeIns = await listTradeIns({ status: str(input.status) as TradeInStatus | undefined })
      return {
        // Фото не отправляем — это тяжёлые data URL.
        data: tradeIns.slice(0, 50).map(({ photos, ...rest }) => ({ ...rest, photos: photos.length })),
        summary: msg().assistant.viewedTradeIns(tradeIns.length),
      }
    }
    case 'get_stats': {
      const days = int(input.days)
      const period: StatsPeriod = days === 7 || days === 90 ? days : 30
      const stats = await getShopStats(period)
      return {
        data: Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'daily')),
        summary: msg().assistant.viewedStats(period),
      }
    }
    default:
      throw new ApiError('validation', msg().assistant.unknownTool(name))
  }
}

interface StepResponse {
  text: string
  toolCalls: ToolCall[]
  raw: unknown
  stop: 'end' | 'tool_use' | 'refusal' | 'max_tokens'
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
  const t = msg().assistant
  const clean = text.trim()
  if (!clean) throw new ApiError('validation', t.emptyTask)

  const messages: ChatMessage[] = [...conversation.messages, { role: 'user', text: clean }]
  const items: AssistantChatItem[] = [...conversation.items, { role: 'user', text: clean }]
  const actions: AssistantAction[] = []
  const texts: string[] = []
  const reply = (): AssistantChatItem => ({ role: 'assistant', text: texts.join('\n\n'), actions: [...actions] })

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await callAiFunction<StepResponse>({ action: 'chat', messages })
      messages.push({ role: 'assistant', text: response.text, toolCalls: response.toolCalls, raw: response.raw })
      if (response.text.trim()) texts.push(response.text.trim())

      if (response.stop === 'refusal') {
        texts.push(t.refused)
        break
      }
      if (response.toolCalls.length === 0) break

      const results: { id: string; name: string; content: string; isError?: boolean }[] = []
      for (const call of response.toolCalls) {
        try {
          const { data, summary } = await runTool(call.name, call.input ?? {})
          actions.push({ tool: call.name, summary, ok: true })
          results.push({ id: call.id, name: call.name, content: JSON.stringify(data) })
        } catch (error) {
          const message = getErrorMessage(error)
          actions.push({ tool: call.name, summary: t.error(message), ok: false })
          results.push({ id: call.id, name: call.name, content: message, isError: true })
        }
      }
      messages.push({ role: 'tool', results })
      onProgress?.({ messages, items: [...items, reply()] })

      if (step === MAX_STEPS - 1) texts.push(t.tooManySteps)
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
