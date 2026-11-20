// Один шаг разговора с моделью ИИ — для любого провайдера: Claude (Anthropic), ChatGPT (OpenAI),
// Gemini (Google). Переписка хранится в общем формате (ChatMessage). Ответ модели дополнительно
// сохраняется «как есть» (raw): Claude и Gemini требуют вернуть свои служебные блоки
// (размышления, подписи вызовов) без изменений, иначе продолжение с инструментами ломается.

import Anthropic from 'npm:@anthropic-ai/sdk@1'

export type Provider = 'anthropic' | 'openai' | 'google'
export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google']

export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  google: 'Gemini',
}

type Json = Record<string, unknown>

export interface ToolDef {
  name: string
  description: string
  /** JSON Schema объекта параметров. */
  parameters: Json
}

export interface ToolCall {
  id: string
  name: string
  input: Json
}

export interface ToolResult {
  id: string
  name: string
  content: string
  isError?: boolean
}

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[]; raw?: { provider: Provider; data: unknown } }
  | { role: 'tool'; results: ToolResult[] }

export interface StepResult {
  text: string
  toolCalls: ToolCall[]
  /** Ответ провайдера как есть — кладётся в ChatMessage.raw. */
  raw: { provider: Provider; data: unknown }
  stop: 'end' | 'tool_use' | 'refusal' | 'max_tokens'
}

export interface StepOptions {
  provider: Provider
  apiKey: string
  model: string
  system: string
  tools: ToolDef[]
  messages: ChatMessage[]
  effort: 'low' | 'medium' | 'high'
  /** Длина ответа (OpenAI gpt-5+). Не задано — по умолчанию модели. */
  verbosity?: 'low' | 'medium' | 'high'
  maxTokens?: number
}

/** Ошибка провайдера с понятным текстом для админки. */
export class LlmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function friendly(provider: Provider, status: number, detail: string): LlmError {
  const name = PROVIDER_NAMES[provider]
  const text = detail.toLowerCase()
  if (status === 401 || (status === 400 && text.includes('api key'))) {
    return new LlmError(`${name} не принял API-ключ. Проверьте ключ в «Настройках» → «Искусственный интеллект».`, 401)
  }
  if (status === 403) return new LlmError(`У ключа ${name} нет доступа к этой модели. Выберите другую модель.`, 403)
  if (status === 404) return new LlmError(`Модель не найдена у ${name}. Выберите другую модель в «Настройках».`, 404)
  if (status === 429) {
    if (text.includes('quota') || text.includes('billing') || text.includes('credit')) {
      return new LlmError(`На счёте ${name} закончились средства или лимит. Пополните баланс у провайдера.`, 429)
    }
    return new LlmError(`Слишком много запросов к ${name}. Подождите минуту и повторите.`, 429)
  }
  if (text.includes('credit') || text.includes('balance') || text.includes('billing')) {
    return new LlmError(`На счёте ${name} закончились средства. Пополните баланс у провайдера.`, 402)
  }
  if (status >= 500) return new LlmError(`${name} временно недоступен. Повторите через минуту.`, 502)
  return new LlmError(`${name} не принял запрос: ${detail.slice(0, 300)}`, 400)
}

async function postJson(provider: Provider, url: string, headers: Record<string, string>, body: unknown): Promise<Json> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    throw new LlmError(`Не удалось связаться с ${PROVIDER_NAMES[provider]}. Повторите через минуту.`, 502)
  }
  const text = await response.text()
  if (!response.ok) throw friendly(provider, response.status, text)
  return JSON.parse(text) as Json
}

async function getJson(provider: Provider | 'elevenlabs', url: string, headers: Record<string, string>): Promise<Json> {
  let response: Response
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new LlmError('Не удалось связаться с сервисом. Повторите через минуту.', 502)
  }
  const text = await response.text()
  if (!response.ok) {
    if (provider === 'elevenlabs') {
      throw new LlmError(
        response.status === 401 ? 'ElevenLabs не принял API-ключ.' : `ElevenLabs ответил ошибкой ${response.status}.`,
        response.status,
      )
    }
    throw friendly(provider, response.status, text)
  }
  return JSON.parse(text) as Json
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

function toAnthropic(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m): Anthropic.Beta.BetaMessageParam => {
    if (m.role === 'user') return { role: 'user', content: m.text }
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: m.results.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.id,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      }
    }
    if (m.raw?.provider === 'anthropic') {
      return { role: 'assistant', content: m.raw.data as Anthropic.Beta.BetaContentBlockParam[] }
    }
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    if (m.text) content.push({ type: 'text', text: m.text })
    for (const call of m.toolCalls ?? []) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
    return { role: 'assistant', content: content.length ? content : m.text || '…' }
  })
}

async function stepAnthropic(o: StepOptions): Promise<StepResult> {
  const client = new Anthropic({ apiKey: o.apiKey, maxRetries: 2, timeout: 120_000 })
  // Серверный fallback при отказе модели поддерживают Opus и Sonnet.
  const withFallback = /opus|sonnet|fable/.test(o.model)
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      model: o.model,
      max_tokens: o.maxTokens ?? 16000,
      cache_control: { type: 'ephemeral' },
      output_config: { effort: o.effort },
      system: o.system,
      tools: o.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
      })),
      messages: toAnthropic(o.messages),
    })
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw friendly('anthropic', error.status ?? 500, error.message)
    if (error instanceof Anthropic.APIConnectionError) {
      throw new LlmError('Не удалось связаться с Claude. Повторите через минуту.', 502)
    }
    throw error
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  const toolCalls = response.content
    .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Json }))
  const stop =
    response.stop_reason === 'refusal'
      ? 'refusal'
      : toolCalls.length
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end'
  return { text, toolCalls, raw: { provider: 'anthropic', data: response.content }, stop }
}

// ---------------------------------------------------------------------------
// ChatGPT (OpenAI Chat Completions)
// ---------------------------------------------------------------------------

function toOpenAi(system: string, messages: ChatMessage[]): Json[] {
  const out: Json[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.text })
    else if (m.role === 'tool') {
      for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.id, content: r.content })
    } else {
      const calls = m.toolCalls ?? []
      out.push({
        role: 'assistant',
        content: m.text || (calls.length ? null : '…'),
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.input) },
              })),
            }
          : {}),
      })
    }
  }
  return out
}

async function stepOpenAi(o: StepOptions): Promise<StepResult> {
  const body: Json = {
    model: o.model,
    messages: toOpenAi(o.system, o.messages),
    tools: o.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    max_completion_tokens: o.maxTokens ?? 16000,
  }
  // Рассуждающие модели (gpt-5+, o-серия): глубина размышления и длина ответа.
  // Без reasoning_effort модель думает «по умолчанию» и в боте отвечает поверхностно.
  const reasoning = /^(gpt-([5-9]|\d{2})|o\d)/.test(o.model) && !/-chat/.test(o.model)
  const tuned: Json = reasoning
    ? { ...body, reasoning_effort: o.effort, ...(o.verbosity ? { verbosity: o.verbosity } : {}) }
    : body
  let data: Json
  try {
    data = await postJson('openai', 'https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${o.apiKey}` }, tuned)
  } catch (error) {
    // Модель не знает этих параметров — повторяем без них, а не роняем ответ.
    if (!reasoning || !(error instanceof LlmError) || error.status !== 400) throw error
    data = await postJson('openai', 'https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${o.apiKey}` }, body)
  }
  const choice = (data.choices as Json[] | undefined)?.[0] ?? {}
  const message = (choice.message ?? {}) as Json
  const toolCalls = ((message.tool_calls as Json[] | undefined) ?? []).map((c) => {
    const fn = (c.function ?? {}) as Json
    let input: Json = {}
    try {
      input = JSON.parse(String(fn.arguments ?? '{}')) as Json
    } catch {
      input = {}
    }
    return { id: String(c.id), name: String(fn.name), input }
  })
  const finish = String(choice.finish_reason ?? '')
  const refused = typeof message.refusal === 'string' && message.refusal
  const text = String(message.content ?? (refused ? message.refusal : '') ?? '').trim()
  const stop = refused || finish === 'content_filter' ? 'refusal' : toolCalls.length ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end'
  return { text, toolCalls, raw: { provider: 'openai', data: message }, stop }
}

// ---------------------------------------------------------------------------
// Gemini (Google Generative Language API)
// ---------------------------------------------------------------------------

/** Gemini понимает только часть JSON Schema: без additionalProperties, enum — только строки. */
function geminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(geminiSchema)
  if (!schema || typeof schema !== 'object') return schema
  const out: Json = {}
  for (const [key, value] of Object.entries(schema as Json)) {
    if (key === 'additionalProperties') continue
    if (key === 'type' && Array.isArray(value)) {
      // ['integer', 'null'] → integer + nullable; смесь типов Gemini не понимает — строка.
      const types = value.filter((v) => v !== 'null')
      out.type = types.length === 1 ? types[0] : 'string'
      if (types.length < value.length) out.nullable = true
      continue
    }
    if (key === 'enum' && Array.isArray(value) && value.some((v) => typeof v !== 'string')) {
      out.description = `${String((schema as Json).description ?? '')} Допустимые значения: ${value.join(', ')}`.trim()
      continue
    }
    out[key] = key === 'properties' ? Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, geminiSchema(v)])) : geminiSchema(value)
  }
  return out
}

function toGemini(messages: ChatMessage[]): Json[] {
  const out: Json[] = []
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', parts: [{ text: m.text }] })
    else if (m.role === 'tool') {
      out.push({
        role: 'user',
        parts: m.results.map((r) => {
          let result: unknown = r.content
          try {
            result = JSON.parse(r.content)
          } catch {
            result = r.content
          }
          return {
            functionResponse: {
              ...(r.id.startsWith('gcall_') ? {} : { id: r.id }),
              name: r.name,
              response: r.isError ? { error: r.content } : { result },
            },
          }
        }),
      })
    } else if (m.raw?.provider === 'google') {
      out.push({ role: 'model', parts: m.raw.data })
    } else {
      const parts: Json[] = []
      if (m.text) parts.push({ text: m.text })
      for (const c of m.toolCalls ?? []) parts.push({ functionCall: { name: c.name, args: c.input } })
      out.push({ role: 'model', parts: parts.length ? parts : [{ text: '…' }] })
    }
  }
  return out
}

async function stepGoogle(o: StepOptions): Promise<StepResult> {
  const model = o.model.replace(/^models\//, '')
  const data = await postJson(
    'google',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': o.apiKey },
    {
      systemInstruction: { parts: [{ text: o.system }] },
      contents: toGemini(o.messages),
      tools: [
        {
          functionDeclarations: o.tools.map((t) => ({
            name: t.name,
            description: t.description,
            // Gemini не принимает объект без полей — такие инструменты объявляем без parameters.
            ...(Object.keys((t.parameters.properties as Json | undefined) ?? {}).length
              ? { parameters: geminiSchema(t.parameters) }
              : {}),
          })),
        },
      ],
      generationConfig: { maxOutputTokens: o.maxTokens ?? 16000 },
    },
  )
  if ((data.promptFeedback as Json | undefined)?.blockReason) {
    return { text: '', toolCalls: [], raw: { provider: 'google', data: [] }, stop: 'refusal' }
  }
  const candidate = (data.candidates as Json[] | undefined)?.[0] ?? {}
  const parts = (((candidate.content as Json | undefined)?.parts as Json[] | undefined) ?? []) as Json[]
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => String(p.text))
    .join('\n')
    .trim()
  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => {
      const call = p.functionCall as Json
      return { id: String(call.id ?? `gcall_${Date.now()}_${i}`), name: String(call.name), input: (call.args ?? {}) as Json }
    })
  const finish = String(candidate.finishReason ?? '')
  const stop = /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(finish)
    ? 'refusal'
    : toolCalls.length
      ? 'tool_use'
      : finish === 'MAX_TOKENS'
        ? 'max_tokens'
        : 'end'
  return { text, toolCalls, raw: { provider: 'google', data: parts }, stop }
}

// ---------------------------------------------------------------------------

export function chatStep(options: StepOptions): Promise<StepResult> {
  if (options.provider === 'openai') return stepOpenAi(options)
  if (options.provider === 'google') return stepGoogle(options)
  return stepAnthropic(options)
}

/** Модели, доступные по ключу (проверяет и сам ключ). Первая — модель по умолчанию. */
export async function listModels(provider: Provider, apiKey: string): Promise<string[]> {
  if (provider === 'anthropic') {
    const data = await getJson('anthropic', 'https://api.anthropic.com/v1/models?limit=100', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    })
    const ids = ((data.data as Json[] | undefined) ?? []).map((m) => String(m.id))
    return rank(ids, ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'])
  }
  if (provider === 'openai') {
    const data = await getJson('openai', 'https://api.openai.com/v1/models', { authorization: `Bearer ${apiKey}` })
    const models = ((data.data as Json[] | undefined) ?? [])
      .filter((m) => /^(gpt-|o\d|chatgpt-)/.test(String(m.id)))
      .filter(
        (m) =>
          !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|codex|moderation|dall|whisper|vision|preview)/.test(
            String(m.id),
          ),
      )
      .sort((a, b) => Number(b.created ?? 0) - Number(a.created ?? 0))
      .map((m) => String(m.id))
    const main = models.find((id) => /^gpt-/.test(id) && !/(mini|nano)/.test(id))
    return main ? [main, ...models.filter((id) => id !== main)] : models
  }
  const data = await getJson('google', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    'x-goog-api-key': apiKey,
  })
  const models = ((data.models as Json[] | undefined) ?? [])
    .filter((m) => ((m.supportedGenerationMethods as string[] | undefined) ?? []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini') && !/(embedding|tts|image|live|audio|aqa|learnlm|exp)/.test(id))
    .sort()
    .reverse()
  const main = models.find((id) => /pro/.test(id) && !/preview/.test(id)) ?? models.find((id) => /pro/.test(id))
  return main ? [main, ...models.filter((id) => id !== main)] : models
}

function rank(ids: string[], preferred: string[]): string[] {
  const top = preferred.filter((id) => ids.includes(id))
  return [...top, ...ids.filter((id) => !top.includes(id))]
}

/** Голоса ElevenLabs по ключу (проверяет и ключ). */
export async function listElevenLabsVoices(apiKey: string): Promise<{ id: string; name: string }[]> {
  const data = await getJson('elevenlabs', 'https://api.elevenlabs.io/v1/voices', { 'xi-api-key': apiKey })
  return ((data.voices as Json[] | undefined) ?? []).map((v) => ({ id: String(v.voice_id), name: String(v.name) }))
}
