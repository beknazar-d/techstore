import { DEFAULT_SHOP_INFO, getShopInfo } from '../api'
import { getLang } from '../i18n'
import type { ShopInfo } from '../types'
import { useApiQuery } from './useApiQuery'

export interface LocalizedShopInfo extends ShopInfo {
  /** Город, адрес и часы на текущем языке (кыргызский — если заполнен, иначе русский). */
  cityText: string
  addressText: string
  hoursText: string
  /** Основной телефон или пустая строка. */
  mainPhone: string
}

/** Контакты магазина из базы (меняются в «Настройках»). До загрузки — значения по умолчанию. */
export function useShopInfo(): LocalizedShopInfo {
  const { data } = useApiQuery(getShopInfo, [], ['shopSettings'])
  const info = data ?? DEFAULT_SHOP_INFO
  const ky = getLang() === 'ky'
  return {
    ...info,
    cityText: (ky && info.cityKy) || info.city,
    addressText: (ky && info.addressKy) || info.address,
    hoursText: (ky && info.workingHoursKy) || info.workingHours,
    mainPhone: info.phones[0] ?? '',
  }
}
