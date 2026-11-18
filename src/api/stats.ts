// Статистика магазина — только для администратора. Считает база: RPC admin_stats(p_days).
// Правила: заказ относится к дню заявки (по Москве); выручка и прибыль — только по выполненным
// заказам; прибыль — по себестоимости, сохранённой в заказе в момент заявки.

import type { ShopStats, StatsPeriod } from '../types'
import { supabase, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

const PERIODS: StatsPeriod[] = [7, 30, 90]

export async function getShopStats(period: StatsPeriod): Promise<ShopStats> {
  if (!PERIODS.includes(period)) throw new ApiError('validation', msg().errors.period)
  return unwrap(
    await supabase.rpc('admin_stats', { p_days: period }),
    msg().errors.statsLoad,
  ) as ShopStats
}
