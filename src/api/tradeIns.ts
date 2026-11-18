// Заявки на trade-in: клиент описывает старое устройство, магазин оценивает и перезванивает.
// Денег на сайте нет: сумма выкупа и доплата обсуждаются по телефону или в магазине.
// Переходы статусов и история — в базе (RPC), здесь те же правила для кнопок.

import { shop } from '../config/shop'
import type {
  CreateTradeInInput,
  TradeInDevice,
  TradeInEvent,
  TradeInFilters,
  TradeInRequest,
  TradeInStatus,
} from '../types'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { emit, supabase, unwrap } from './client'
import { ApiError } from './errors'
import { msg } from '../i18n'

const COLUMNS =
  'id, number, status, customer_name, customer_phone, device, photos, desired_product_id, desired_product_name, desired_product_price, comment, admin_estimate, admin_note, created_at, updated_at'

interface TradeInRow {
  id: string
  number: number
  status: TradeInStatus
  customer_name: string
  customer_phone: string
  device: TradeInDevice
  photos: string[]
  desired_product_id: string | null
  desired_product_name: string
  desired_product_price: number | null
  comment: string
  admin_estimate: number | null
  admin_note: string
  created_at: string
  updated_at: string
}

interface TradeInEventRow {
  id: string
  trade_in_id: string
  type: TradeInEvent['type']
  from_status: TradeInStatus | null
  to_status: TradeInStatus | null
  message: string
  created_at: string
}

function fromRow(row: TradeInRow): TradeInRequest {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    device: row.device,
    photos: row.photos ?? [],
    desiredProductId: row.desired_product_id,
    desiredProductName: row.desired_product_name,
    desiredProductPrice: row.desired_product_price,
    comment: row.comment,
    adminEstimate: row.admin_estimate,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Допустимые переходы: new → evaluated → accepted | rejected → completed.
 * В `evaluated` заявку переводит только `evaluateTradeIn` (нужна сумма оценки).
 */
const TRADE_IN_TRANSITIONS: Record<TradeInStatus, TradeInStatus[]> = {
  new: ['rejected'],
  evaluated: ['accepted', 'rejected'],
  accepted: ['completed', 'rejected'],
  rejected: [],
  completed: [],
}

/** В какие статусы можно перевести заявку кнопкой (оценка — отдельно, через `evaluateTradeIn`). */
export function getAllowedTradeInStatuses(status: TradeInStatus): TradeInStatus[] {
  return TRADE_IN_TRANSITIONS[status]
}

/** Можно ли сейчас поставить или изменить оценку. */
export function canEvaluateTradeIn(status: TradeInStatus): boolean {
  return status === 'new' || status === 'evaluated'
}

function cleanDevice(device: TradeInDevice): TradeInDevice {
  const brand = device.brand.trim()
  const model = device.model.trim()
  if (!brand) throw new ApiError('validation', msg().errors.brand)
  if (!model) throw new ApiError('validation', msg().errors.model)

  const clean: TradeInDevice = { category: device.category, brand, model, grade: device.grade }
  if (device.memory?.trim()) clean.memory = device.memory.trim()
  if (device.batteryHealth !== undefined) {
    const value = device.batteryHealth
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new ApiError('validation', msg().errors.battery)
    }
    clean.batteryHealth = value
  }
  if (device.defects?.trim()) clean.defects = device.defects.trim()
  if (device.kit?.trim()) clean.kit = device.kit.trim()
  return clean
}

/**
 * Создаёт заявку на trade-in (доступно без входа). Склад не трогает.
 * Если указан `desiredProductId`, база сохраняет в заявке название и цену этого товара.
 */
export async function createTradeIn(input: CreateTradeInInput): Promise<TradeInRequest> {
  const customerName = input.customerName.trim()
  const customerPhone = normalizePhone(input.customerPhone)
  if (!customerName) throw new ApiError('validation', msg().errors.name)
  if (!isValidPhone(customerPhone)) throw new ApiError('validation', msg().errors.phone)
  const device = cleanDevice(input.device)
  const photos = input.photos ?? []
  if (photos.length > shop.maxTradeInPhotos) {
    throw new ApiError('validation', msg().errors.photosMax(shop.maxTradeInPhotos))
  }

  const result = unwrap(
    await supabase.rpc('create_trade_in', {
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_device: device,
      p_photos: photos,
      p_desired_product_id: input.desiredProductId ?? null,
      p_comment: input.comment?.trim() ?? '',
    }),
    msg().errors.sendFailed,
  ) as { trade_in_id: string; trade_in_number: number }[]
  const created = result[0]
  if (!created) throw new ApiError('storage', msg().errors.sendFailed)

  emit(['tradeIns'])
  const now = new Date().toISOString()
  return {
    id: created.trade_in_id,
    number: created.trade_in_number,
    status: 'new',
    customerName,
    customerPhone,
    device,
    photos,
    desiredProductId: input.desiredProductId ?? null,
    desiredProductName: '',
    desiredProductPrice: null,
    comment: input.comment?.trim() ?? '',
    adminEstimate: null,
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** Заявки, новые сверху. Только для администратора (RLS). */
export async function listTradeIns(filters: TradeInFilters = {}): Promise<TradeInRequest[]> {
  let query = supabase.from('trade_ins').select(COLUMNS).order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  const rows = unwrap(await query, msg().errors.tradeInsLoad) as TradeInRow[]
  return rows.map(fromRow)
}

export async function getTradeIn(id: string): Promise<TradeInRequest | null> {
  const row = unwrap(await supabase.from('trade_ins').select(COLUMNS).eq('id', id).maybeSingle()) as TradeInRow | null
  return row ? fromRow(row) : null
}

/** История заявки, старые события сверху. */
export async function listTradeInEvents(tradeInId: string): Promise<TradeInEvent[]> {
  const rows = unwrap(
    await supabase
      .from('trade_in_events')
      .select('id, trade_in_id, type, from_status, to_status, message, created_at')
      .eq('trade_in_id', tradeInId)
      .order('created_at'),
  ) as TradeInEventRow[]
  return rows.map((row) => ({
    id: row.id,
    tradeInId: row.trade_in_id,
    type: row.type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    message: row.message,
    createdAt: row.created_at,
  }))
}

/**
 * Ставит оценку (цену выкупа, ₽) и переводит заявку в `evaluated`.
 * Оценку можно менять, пока клиент не ответил (статусы `new` и `evaluated`).
 * `note`, если передана, заменяет заметку администратора.
 */
export async function evaluateTradeIn(id: string, estimate: number, note?: string): Promise<TradeInRequest> {
  if (!Number.isInteger(estimate) || estimate <= 0) {
    throw new ApiError('validation', msg().errors.estimate)
  }
  const row = unwrap(
    await supabase.rpc('evaluate_trade_in', { p_trade_in_id: id, p_estimate: estimate, p_note: note ?? null }),
  ) as TradeInRow
  emit(['tradeIns'])
  return fromRow(row)
}

/** Меняет статус: evaluated → accepted → completed, либо rejected до завершения. */
export async function updateTradeInStatus(id: string, status: TradeInStatus): Promise<TradeInRequest> {
  const row = unwrap(
    await supabase.rpc('update_trade_in_status', { p_trade_in_id: id, p_status: status }),
  ) as TradeInRow
  emit(['tradeIns'])
  return fromRow(row)
}

/** Сохраняет заметку администратора (клиент её не видит). */
export async function setTradeInAdminNote(id: string, note: string): Promise<TradeInRequest> {
  const row = unwrap(
    await supabase.rpc('set_trade_in_admin_note', { p_trade_in_id: id, p_note: note }),
  ) as TradeInRow
  emit(['tradeIns'])
  return fromRow(row)
}
