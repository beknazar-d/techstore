// Поиск товара в интернете для ИИ-ассистента: описание, характеристики, фото.
//
// research — отдельный запрос к выбранному провайдеру с его встроенным веб-поиском
//   (OpenAI web_search, Claude web_search, Gemini google_search). Модель ассистента сама
//   в интернет не ходит: она вызывает инструмент research_product, браузер — это действие.
// images — кандидаты фото: og:image и крупные картинки со страниц-источников + Wikimedia Commons.
// fetch_image — скачать одну картинку (браузер сожмёт её compressImage и прикрепит к товару).

import { LlmError, postJson, type Provider } from '../_shared/llm.ts'

type Json = Record<string, unknown>

export interface ResearchResult {
  /** Ответ модели: JSON с описанием и характеристиками (как просили в подсказке). */
  found: unknown
  /** Страницы, на которые опирался поиск. */
  sources: string[]
}

const RESEARCH_PROMPT = (query: string, specHint: string) => `Найди в интернете точные данные о товаре для карточки интернет-магазина электроники: «${query}».

Ищи на официальном сайте производителя и в крупных каталогах (gsmarena.com, официальные пресс-релизы, крупные магазины).
Не выдумывай: если модель не найдена или ещё не вышла — так и напиши в поле notFound. Характеристики — только подтверждённые источниками.
${specHint ? `\nНужные характеристики (ключи категории магазина):\n${specHint}\n` : ''}
Ответь ТОЛЬКО JSON без пояснений вокруг:
{
  "notFound": "пусто или почему не нашёл",
  "name": "точное название модели, например «Apple iPhone 17 Pro Max 256 ГБ»",
  "brand": "бренд",
  "variants": "какие бывают объём памяти и цвета, коротко",
  "description": "описание для покупателя по-русски, 3–5 предложений, без рекламных штампов и без цен",
  "specs": { "ключ или название характеристики": "значение с единицами" },
  "priceRub": "ориентировочная рыночная цена в рублях числом, если нашёл, иначе null",
  "sources": ["адреса страниц, откуда взяты данные"],
  "imagePages": ["адреса страниц с хорошими фото этой модели: официальный сайт, пресс-релиз, обзор"]
}`

/** Вытащить первый JSON-объект из ответа модели (с ```json или без). */
function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return { raw: text.slice(0, 4000) }
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return { raw: text.slice(0, 4000) }
  }
}

function urlsIn(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    if (/^https?:\/\//.test(value)) out.add(value)
  } else if (Array.isArray(value)) value.forEach((v) => urlsIn(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => urlsIn(v, out))
}

async function researchOpenAi(key: string, model: string, prompt: string) {
  const data = await postJson('openai', 'https://api.openai.com/v1/responses', { authorization: `Bearer ${key}` }, {
    model,
    tools: [{ type: 'web_search' }],
    input: prompt,
  })
  const texts: string[] = []
  const sources = new Set<string>()
  for (const item of (data.output ?? []) as Json[]) {
    if (item.type !== 'message') continue
    for (const part of (item.content ?? []) as Json[]) {
      if (typeof part.text === 'string') texts.push(part.text)
      for (const a of (part.annotations ?? []) as Json[]) if (typeof a.url === 'string') sources.add(a.url)
    }
  }
  return { text: texts.join('\n'), sources }
}

async function researchAnthropic(key: string, model: string, prompt: string) {
  const data = await postJson(
    'anthropic',
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model,
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      messages: [{ role: 'user', content: prompt }],
    },
  )
  const texts: string[] = []
  const sources = new Set<string>()
  for (const block of (data.content ?? []) as Json[]) {
    if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text)
    if (block.type === 'web_search_tool_result') urlsIn(block.content, sources)
  }
  return { text: texts.join(''), sources }
}

async function researchGoogle(key: string, model: string, prompt: string) {
  const data = await postJson(
    'google',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': key },
    { contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }] },
  )
  const candidate = ((data.candidates ?? []) as Json[])[0] ?? {}
  const parts = (((candidate.content ?? {}) as Json).parts ?? []) as Json[]
  const sources = new Set<string>()
  const chunks = (((candidate.groundingMetadata ?? {}) as Json).groundingChunks ?? []) as Json[]
  for (const chunk of chunks) {
    const uri = ((chunk.web ?? {}) as Json).uri
    if (typeof uri === 'string') sources.add(uri)
  }
  return { text: parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join(''), sources }
}

export async function researchProduct(
  provider: Provider,
  key: string,
  model: string,
  query: string,
  specHint: string,
): Promise<ResearchResult> {
  const prompt = RESEARCH_PROMPT(query, specHint)
  const run = provider === 'openai' ? researchOpenAi : provider === 'anthropic' ? researchAnthropic : researchGoogle
  const { text, sources } = await run(key, model, prompt)
  if (!text.trim()) throw new LlmError('Поиск в интернете не дал ответа. Повторите или уточните модель.', 502)
  const found = parseJson(text) as Json
  for (const field of ['sources', 'imagePages']) {
    const list = found[field]
    if (Array.isArray(list)) list.forEach((u) => typeof u === 'string' && /^https?:\/\//.test(u) && sources.add(u))
  }
  return { found, sources: [...sources].slice(0, 20) }
}

// ---------------------------------------------------------------------------
// Фото
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (compatible; A7StoreAdminBot/1.0)'
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MIN_IMAGE_BYTES = 12 * 1024

/** Только внешние http(s)-адреса: не даём ходить во внутреннюю сеть. */
export function safeUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host.includes(':') // IPv6-литералы
  ) {
    return null
  }
  return url
}

async function fetchText(url: URL): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok || !/html/i.test(response.headers.get('content-type') ?? '')) return ''
  return (await response.text()).slice(0, 1_500_000)
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? (m[2] ?? m[3] ?? '') : ''
}

/** Картинки со страницы: сначала og:image / twitter:image, затем крупные <img> (по srcset/размеру/имени). */
function imagesFromHtml(html: string, base: URL, words: string[]): { url: string; score: number }[] {
  const found: { url: string; score: number }[] = []
  const add = (raw: string, score: number) => {
    if (!raw || raw.startsWith('data:')) return
    try {
      const url = new URL(raw.replace(/&amp;/g, '&'), base).toString()
      if (/\.(svg|gif)(\?|$)|sprite|logo|icon|favicon|avatar|badge|banner-ad/i.test(url)) return
      found.push({ url, score })
    } catch {
      // битый адрес — пропускаем
    }
  }
  for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
    const prop = (attr(tag, 'property') || attr(tag, 'name')).toLowerCase()
    if (prop === 'og:image' || prop === 'og:image:secure_url' || prop === 'twitter:image') add(attr(tag, 'content'), 100)
  }
  for (const tag of html.match(/<img[^>]+>/gi) ?? []) {
    const srcset = attr(tag, 'srcset') || attr(tag, 'data-srcset')
    // Из srcset берём самый крупный вариант.
    const biggest = srcset
      .split(',')
      .map((s) => s.trim().split(/\s+/))
      .filter((p) => p[0])
      .sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'))[0]?.[0]
    const src = biggest || attr(tag, 'data-src') || attr(tag, 'src')
    const text = `${attr(tag, 'alt')} ${src}`.toLowerCase()
    const width = parseInt(attr(tag, 'width') || '0')
    let score = 10
    if (width >= 600) score += 30
    if (srcset) score += 15
    score += words.filter((w) => text.includes(w)).length * 10
    if (width > 0 && width < 200) score -= 40
    add(src, score)
  }
  return found.sort((a, b) => b.score - a.score)
}

/** Фото с Wikimedia Commons по названию модели (без ключа). */
async function commonsImages(query: string): Promise<string[]> {
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  api.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '1600',
  }).toString()
  try {
    const response = await fetch(api, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) })
    const data = (await response.json()) as { query?: { pages?: Record<string, Json> } }
    return Object.values(data.query?.pages ?? {})
      .map((p) => ((p.imageinfo as Json[] | undefined)?.[0] ?? {}) as Json)
      .filter((i) => /image\/(jpeg|png|webp)/.test(String(i.mime ?? '')))
      .map((i) => String(i.thumburl ?? i.url ?? ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Проверить, что по адресу правда картинка нормального размера (HEAD, а если сервер его не умеет — GET). */
async function looksLikeImage(url: string): Promise<boolean> {
  const target = safeUrl(url)
  if (!target) return false
  try {
    let response = await fetch(target, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8_000) })
    if (!response.ok) {
      response = await fetch(target, { headers: { 'user-agent': UA, range: 'bytes=0-1023' }, signal: AbortSignal.timeout(8_000) })
      await response.body?.cancel()
    }
    const type = response.headers.get('content-type') ?? ''
    const size = Number(response.headers.get('content-length') ?? '0')
    if (!/image\/(jpeg|jpg|png|webp|avif)/i.test(type)) return false
    return size === 0 || (size >= MIN_IMAGE_BYTES && size <= MAX_IMAGE_BYTES) || response.status === 206
  } catch {
    return false
  }
}

export async function findImages(query: string, pages: string[], limit = 8): Promise<string[]> {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
  /** Адрес → бонус источника: картинка-обложка страницы (og:image) — обычно лучшее фото товара. */
  const candidates = new Map<string, number>()
  const add = (url: string, bonus: number) => candidates.set(url, Math.max(candidates.get(url) ?? -Infinity, bonus))
  const htmlPages = pages.map(safeUrl).filter((u): u is URL => u !== null).slice(0, 6)
  const fromPages = await Promise.all(
    htmlPages.map(async (url) => {
      // Ссылка может вести сразу на картинку.
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(url.pathname)) return [{ url: url.toString(), score: 100 }]
      const html = await fetchText(url).catch(() => '')
      return html ? imagesFromHtml(html, url, words).slice(0, 6) : []
    }),
  )
  fromPages.forEach((list) => list.forEach((c) => add(c.url, c.score >= 100 ? 25 : 0)))
  ;(await commonsImages(query)).forEach((url) => add(url, 5))

  // Порядок — по тому, насколько адрес похож на фото именно этой модели.
  const ranked = [...candidates]
    .map(([url, bonus], index) => ({ url, score: relevance(url, words) + bonus - index * 0.1 }))
    .filter((c) => c.score > -30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
  const checks = await Promise.all(ranked.map(async ({ url }) => ((await looksLikeImage(url)) ? url : null)))
  return checks.filter((u): u is string => u !== null).slice(0, limit)
}

/** Промо, баннеры, фото витрин и мероприятий — не фото товара. */
const NOT_PRODUCT = /incentive|upgrade|trade.?in|banner|promo|hero|family|compare|launch|store|event|keynote|people|hand|_ad[_.]|lifestyle|aperture|sample|shot.?on|max.?light|max.?depth|portrait|night|selfie|zoom|display.?for.?sale|mall/i

/**
 * Совпадение модели в имени файла. Слова с цифрами («17», «s25», «1tb») — обязательные:
 * фото iPhone 18 на запрос «iPhone 17» уходит в конец.
 */
function relevance(url: string, words: string[]): number {
  let name: string
  try {
    const u = new URL(url)
    name = decodeURIComponent(u.pathname).toLowerCase()
  } catch {
    return -100
  }
  const tokens = new Set(name.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
  let score = 0
  for (const word of words) {
    const hit = tokens.has(word) || name.includes(word)
    if (hit) score += 20
    else if (/\d/.test(word)) return -100 // нет номера модели — фото другой модели
  }
  // Другая цифра модели в имени (iphone_18 при запросе 17) — точно не то.
  const queryNumbers = new Set(words.filter((w) => /^\d+$/.test(w)))
  if (queryNumbers.size > 0 && [...tokens].some((t) => /^\d{1,2}$/.test(t) && !queryNumbers.has(t))) return -100
  if (NOT_PRODUCT.test(name)) return -100
  return score
}

/** Скачать картинку для браузера (он сожмёт и прикрепит). base64, чтобы обойти CORS чужого сайта. */
export async function fetchImage(raw: string): Promise<{ base64: string; contentType: string }> {
  const url = safeUrl(raw)
  if (!url) throw new LlmError('Недопустимый адрес картинки', 400)
  const response = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5' },
    signal: AbortSignal.timeout(20_000),
  })
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]
  if (!response.ok || !/^image\/(jpeg|png|webp|avif)$/i.test(contentType)) {
    throw new LlmError('По ссылке не картинка или сайт её не отдал', 400)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < MIN_IMAGE_BYTES) throw new LlmError('Картинка слишком маленькая', 400)
  if (bytes.length > MAX_IMAGE_BYTES) throw new LlmError('Картинка слишком большая', 400)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { base64: btoa(binary), contentType }
}
