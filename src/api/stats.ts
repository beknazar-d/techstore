// Статистика магазина — только для администратора.
// В Supabase-версии это один вызов RPC `admin_stats(p_days)`; здесь считаем то же самое
// по локальным данным. Правила расчёта одинаковые:
//   - заказ относится к дню заявки (createdAt), дни — по локальному времени;
//   - выручка и прибыль — только по выполненным заказам (их клиент оплатил);
//   - прибыль считается по себестоимости, сохранённой в заказе в момент заявки.

import { shop } from '../config/shop'
import type { Order, ShopStats, StatsDay, StatsPeriod, StatsTopProduct } from '../types'
import { requireAdmin } from './auth'
import { clone, delay, readDb } from './db'
import { ApiError } from './errors'

const PERIODS: StatsPeriod[] = [7, 30, 90]

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null
}

function orderRevenue(order: Order): number {
  return order.price * order.quantity
}

/** Прибыль заказа или null, если себестоимость не была указана. */
function orderProfit(order: Order): number | null {
  const cost = order.costPrice ?? null
  return cost === null ? null : (order.price - cost) * order.quantity
}

export async function getShopStats(period: StatsPeriod): Promise<ShopStats> {
  requireAdmin()
  if (!PERIODS.includes(period)) throw new ApiError('validation', 'Период — 7, 30 или 90 дней')
  await delay()
  const db = readDb()

  // Дни периода: от (сегодня − period + 1) до сегодня включительно.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - (period - 1))

  const days = new Map<string, StatsDay>()
  for (let i = 0; i < period; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = dayKey(date)
    days.set(key, { date: key, revenue: 0, profit: 0, orders: 0 })
  }

  const inPeriod = db.orders.filter((order) => days.has(dayKey(new Date(order.createdAt))))
  const completed = inPeriod.filter((order) => order.status === 'completed')
  const cancelled = inPeriod.filter((order) => order.status === 'cancelled')
  const inProgress = inPeriod.filter((order) => order.status === 'new' || order.status === 'confirmed')

  let revenue = 0
  let profit = 0
  let revenueWithCost = 0
  let revenueWithoutCost = 0
  const top = new Map<string, StatsTopProduct>()

  for (const order of inPeriod) {
    const day = days.get(dayKey(new Date(order.createdAt)))
    if (day && order.status !== 'cancelled') day.orders += 1
  }

  for (const order of completed) {
    const orderSum = orderRevenue(order)
    const orderGain = orderProfit(order)
    revenue += orderSum
    if (orderGain === null) {
      revenueWithoutCost += orderSum
    } else {
      profit += orderGain
      revenueWithCost += orderSum
    }

    const day = days.get(dayKey(new Date(order.createdAt)))
    if (day) {
      day.revenue += orderSum
      day.profit += orderGain ?? 0
    }

    // Товар могли удалить — тогда группируем по названию из заказа.
    const key = order.productId ?? `name:${order.productName}`
    const item = top.get(key) ?? { productId: order.productId, name: order.productName, quantity: 0, revenue: 0, profit: 0 }
    item.quantity += order.quantity
    item.revenue += orderSum
    item.profit = item.profit === null || orderGain === null ? null : item.profit + orderGain
    top.set(key, item)
  }

  const activeProducts = db.products.filter((product) => product.isActive)
  const tradeIns = db.tradeIns.filter((tradeIn) => days.has(dayKey(new Date(tradeIn.createdAt))))

  const stats: ShopStats = {
    period,
    from: dayKey(start),
    to: dayKey(today),
    revenue,
    profit,
    marginPercent: percent(profit, revenueWithCost),
    revenueWithoutCost,
    ordersTotal: inPeriod.length,
    ordersCompleted: completed.length,
    ordersCancelled: cancelled.length,
    ordersInProgress: inProgress.length,
    inProgressValue: inProgress.reduce((sum, order) => sum + orderRevenue(order), 0),
    averageCheck: completed.length > 0 ? Math.round(revenue / completed.length) : null,
    cancelRatePercent: percent(cancelled.length, inPeriod.length),
    ordersBySource: {
      site: inPeriod.filter((order) => order.source === 'site').length,
      telegram: inPeriod.filter((order) => order.source === 'telegram').length,
    },
    tradeInsTotal: tradeIns.length,
    tradeInsAccepted: tradeIns.filter((t) => t.status === 'accepted' || t.status === 'completed').length,
    daily: [...days.values()],
    topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    inventory: {
      units: activeProducts.reduce((sum, product) => sum + product.stock, 0),
      costValue: activeProducts.reduce((sum, product) => sum + (product.costPrice ?? 0) * product.stock, 0),
      retailValue: activeProducts.reduce((sum, product) => sum + product.price * product.stock, 0),
      lowStock: activeProducts.filter((p) => p.stock > 0 && p.stock <= shop.lowStockThreshold).length,
      outOfStock: activeProducts.filter((p) => p.stock === 0).length,
      missingCost: activeProducts.filter((p) => (p.costPrice ?? null) === null).length,
    },
  }
  return clone(stats)
}
