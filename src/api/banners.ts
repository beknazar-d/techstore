import type { PromoBanner, PromoBannerInput } from '../types'
import { emit, supabase, unwrap } from './client'
import { ApiError } from './errors'
import { getLang, msg } from '../i18n'

const COLUMNS =
  'id, title, subtitle, title_ky, subtitle_ky, button_label, button_label_ky, link, image, is_active, sort_order, starts_at, ends_at, created_at, updated_at'

/** Размер сжатого фото в data URL (как у trade-in). Совпадает с проверкой в базе. */
const MAX_IMAGE_LENGTH = 900_000

interface BannerRow {
  id: string
  title: string
  subtitle: string
  title_ky: string
  subtitle_ky: string
  button_label: string
  button_label_ky: string
  link: string
  image: string | null
  is_active: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

function fromRow(row: BannerRow): PromoBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    titleKy: row.title_ky,
    subtitleKy: row.subtitle_ky,
    buttonLabel: row.button_label,
    buttonLabelKy: row.button_label_ky,
    link: row.link,
    image: row.image,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(input: PromoBannerInput): Record<string, unknown> {
  const e = msg().errorsMore
  const title = input.title.trim()
  // Фото-слайд (текст уже на картинке) может быть без заголовка.
  if (!title && !input.image) throw new ApiError('validation', e.bannerTitle)
  const link = input.link.trim()
  if (link && !/^(\/\S*|https:\/\/\S+)$/.test(link)) throw new ApiError('validation', e.bannerLink)
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new ApiError('validation', e.bannerPeriod)
  }
  if (input.image && input.image.startsWith('data:') && input.image.length > MAX_IMAGE_LENGTH) {
    throw new ApiError('validation', e.bannerImage)
  }
  return {
    title,
    subtitle: input.subtitle.trim(),
    title_ky: input.titleKy.trim(),
    subtitle_ky: input.subtitleKy.trim(),
    button_label: input.buttonLabel.trim(),
    button_label_ky: input.buttonLabelKy.trim(),
    link,
    image: input.image || null,
    is_active: input.isActive,
    sort_order: Number.isInteger(input.sortOrder) ? input.sortOrder : 0,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
  }
}

/** Тексты баннера на текущем языке: кыргызский перевод, если он есть, иначе русский. */
export function bannerText(banner: PromoBanner): { title: string; subtitle: string; buttonLabel: string } {
  const ky = getLang() === 'ky'
  return {
    title: (ky && banner.titleKy) || banner.title,
    subtitle: (ky && banner.subtitleKy) || banner.subtitle,
    buttonLabel: (ky && banner.buttonLabelKy) || banner.buttonLabel,
  }
}

/**
 * Для главной: включённые баннеры в период показа (период проверяет RLS).
 * Админ видит через RLS все баннеры, поэтому фильтр повторяем здесь.
 */
export async function listActiveBanners(): Promise<PromoBanner[]> {
  const rows = unwrap(
    await supabase
      .from('promo_banners')
      .select(COLUMNS)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at', { ascending: false }),
    msg().errorsMore.bannersLoad,
  ) as BannerRow[]
  const now = Date.now()
  return rows
    .filter((row) => (!row.starts_at || Date.parse(row.starts_at) <= now) && (!row.ends_at || Date.parse(row.ends_at) > now))
    .map(fromRow)
}

/** Для админки: все баннеры. */
export async function listBanners(): Promise<PromoBanner[]> {
  const rows = unwrap(
    await supabase.from('promo_banners').select(COLUMNS).order('sort_order').order('created_at', { ascending: false }),
    msg().errorsMore.bannersLoad,
  ) as BannerRow[]
  return rows.map(fromRow)
}

export async function createBanner(input: PromoBannerInput): Promise<PromoBanner> {
  const row = unwrap(
    await supabase.from('promo_banners').insert(toRow(input)).select(COLUMNS).single(),
    msg().errorsMore.bannerSave,
  ) as BannerRow
  emit(['banners'])
  return fromRow(row)
}

/** Несколько фото-слайдов за раз: каждый файл — отдельный баннер, по порядку. */
export async function createBanners(inputs: PromoBannerInput[]): Promise<PromoBanner[]> {
  if (inputs.length === 0) return []
  const rows = unwrap(
    await supabase.from('promo_banners').insert(inputs.map(toRow)).select(COLUMNS),
    msg().errorsMore.bannerSave,
  ) as BannerRow[]
  emit(['banners'])
  return rows.map(fromRow)
}

export async function updateBanner(id: string, input: PromoBannerInput): Promise<PromoBanner> {
  const row = unwrap(
    await supabase.from('promo_banners').update(toRow(input)).eq('id', id).select(COLUMNS).maybeSingle(),
    msg().errorsMore.bannerSave,
  ) as BannerRow | null
  if (!row) throw new ApiError('not_found', msg().errorsMore.bannerNotFound)
  emit(['banners'])
  return fromRow(row)
}

export async function deleteBanner(id: string): Promise<void> {
  const rows = unwrap(await supabase.from('promo_banners').delete().eq('id', id).select('id')) as { id: string }[]
  if (rows.length === 0) throw new ApiError('not_found', msg().errorsMore.bannerNotFound)
  emit(['banners'])
}
