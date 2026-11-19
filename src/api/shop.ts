// Название, адрес и контакты магазина — таблица shop_settings (одна строка).
// Читают все (сайт), меняет только админ («Настройки» → «Магазин и контакты»).

import type { ShopInfo, ShopInfoInput } from '../types'
import { emit, supabase, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

const COLUMNS =
  'name, city, city_ky, address, address_ky, working_hours, working_hours_ky, phones, whatsapp, telegram, instagram, email, map_url'

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
  email: string
  map_url: string
}

/** Пока данные не загрузились (или база недоступна) — показываем это. */
export const DEFAULT_SHOP_INFO: ShopInfo = {
  name: 'Phone Market',
  city: '',
  cityKy: '',
  address: '',
  addressKy: '',
  workingHours: '',
  workingHoursKy: '',
  phones: [],
  whatsapp: '',
  telegram: '',
  instagram: '',
  email: '',
  mapUrl: '',
}

function fromRow(row: ShopRow): ShopInfo {
  return {
    name: row.name,
    city: row.city,
    cityKy: row.city_ky,
    address: row.address,
    addressKy: row.address_ky,
    workingHours: row.working_hours,
    workingHoursKy: row.working_hours_ky,
    phones: row.phones ?? [],
    whatsapp: row.whatsapp,
    telegram: row.telegram,
    instagram: row.instagram,
    email: row.email,
    mapUrl: row.map_url,
  }
}

let cache: Promise<ShopInfo> | null = null

/** Контакты магазина. Запрос один на всё приложение; после сохранения кэш сбрасывается. */
export function getShopInfo(): Promise<ShopInfo> {
  if (!cache) {
    cache = (async () => {
      const row = unwrap(await supabase.from('shop_settings').select(COLUMNS).maybeSingle()) as ShopRow | null
      return row ? fromRow(row) : DEFAULT_SHOP_INFO
    })()
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

/** Телефон: оставляем цифры и «+» в начале. */
function cleanPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

export async function updateShopInfo(input: ShopInfoInput): Promise<ShopInfo> {
  const e = msg().adminSettings
  const name = input.name.trim()
  if (!name) throw new ApiError('validation', e.shopNameRequired)
  const phones = input.phones.map(cleanPhone).filter(Boolean)
  if (phones.some((phone) => !/^\+[0-9]{9,15}$/.test(phone))) throw new ApiError('validation', e.shopPhoneInvalid)
  const whatsapp = input.whatsapp.replace(/\D/g, '')
  if (whatsapp && !/^[0-9]{9,15}$/.test(whatsapp)) throw new ApiError('validation', e.shopWhatsappInvalid)
  const telegram = input.telegram.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')
  if (telegram && !/^[A-Za-z0-9_]{4,32}$/.test(telegram)) throw new ApiError('validation', e.shopTelegramInvalid)
  const instagram = input.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  if (instagram && !/^[A-Za-z0-9_.]{1,30}$/.test(instagram)) throw new ApiError('validation', e.shopInstagramInvalid)
  const email = input.email.trim()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('validation', e.shopEmailInvalid)
  const mapUrl = input.mapUrl.trim()
  if (mapUrl && !/^https:\/\/\S+$/.test(mapUrl)) throw new ApiError('validation', e.shopMapInvalid)

  const row = unwrap(
    await supabase
      .from('shop_settings')
      .update({
        name,
        city: input.city.trim(),
        city_ky: input.cityKy.trim(),
        address: input.address.trim(),
        address_ky: input.addressKy.trim(),
        working_hours: input.workingHours.trim(),
        working_hours_ky: input.workingHoursKy.trim(),
        phones: phones.slice(0, 3),
        whatsapp,
        telegram,
        instagram,
        email,
        map_url: mapUrl,
      })
      .eq('id', true)
      .select(COLUMNS)
      .maybeSingle(),
    e.shopSaveError,
  ) as ShopRow | null
  if (!row) throw new ApiError('auth', e.shopSaveError)
  cache = null
  emit(['shopSettings'])
  return fromRow(row)
}
