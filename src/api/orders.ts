// Заказы. Логика склада — в базе (RPC): create_order блокирует строку товара, проверяет
// и списывает остаток в одной транзакции; cancel_order возвращает товар ровно один раз.
// Каждое изменение пишет событие в order_events. Уведомления в Telegram шлёт сервер.

import type { CreateOrderInput, Order, OrderEvent, OrderFilters, OrderStatus } from '../types'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { emit, supabase, unwrap } from './client'
import { ApiError } from './errors'

const COLUMNS =
  'id, number, status, source, product_id, product_name, price, cost_price, quantity, customer_name, customer_phone, delivery_type, address, location_lat, location_lng, desired_date, desired_time, comment, admin_note, created_at, updated_at'

export interface OrderRow {
  id: string
  number: number
  status: OrderStatus
  source: Order['source']
  product_id: string | null
  product_name: string
  price: number
  cost_price: number | null
  quantity: number
  customer_name: string
  customer_phone: string
  delivery_type: Order['deliveryType']
  address: string
  location_lat: number | null
  location_lng: number | null
  desired_date: string | null
  desired_time: string | null
  comment: string
  admin_note: string
  created_at: string
  updated_at: string
}

interface OrderEventRow {
  id: string
  order_id: string
  type: OrderEvent['type']
  from_status: OrderStatus | null
  to_status: OrderStatus | null
  message: string
  created_at: string
}

export function orderFromRow(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    source: row.source,
    productId: row.product_id,
    productName: row.product_name,
    price: row.price,
    costPrice: row.cost_price,
    quantity: row.quantity,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryType: row.delivery_type,
    address: row.address,
    location:
      row.location_lat !== null && row.location_lng !== null ? { lat: row.location_lat, lng: row.location_lng } : null,
    desiredDate: row.desired_date ?? '',
    // Postgres отдаёт время как 14:30:00 — в интерфейсе 14:30.
    desiredTime: row.desired_time ? row.desired_time.slice(0, 5) : '',
    comment: row.comment,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Допустимые переходы статусов. Из «Выполнен» и «Отменён» пути назад нет. Те же правила — в базе. */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'completed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** В какие статусы можно перевести заказ из текущего (для кнопок в админке). */
export function getAllowedOrderStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status]
}

/**
 * Создаёт заявку (доступно без входа). Склад списывает база в той же транзакции.
 * Ошибки: `validation`, `not_found`, `product_unavailable`, `out_of_stock`.
 * Аноним не читает таблицу заказов, поэтому заказ для экрана «Заявка принята»
 * собирается из ответа функции и данных формы.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const customerName = input.customerName.trim()
  const customerPhone = normalizePhone(input.customerPhone)
  const address = input.address?.trim() ?? ''
  const location = input.location ?? null

  if (!customerName) throw new ApiError('validation', 'Укажите ваше имя')
  if (!isValidPhone(customerPhone)) throw new ApiError('validation', 'Укажите корректный номер телефона')
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ApiError('validation', 'Количество должно быть не меньше 1')
  }
  if (input.deliveryType === 'delivery' && !address && !location) {
    throw new ApiError('validation', 'Укажите адрес доставки или отправьте геолокацию')
  }
  const isDelivery = input.deliveryType === 'delivery'

  const result = unwrap(
    await supabase.rpc('create_order', {
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_delivery_type: input.deliveryType,
      p_address: isDelivery ? address : '',
      p_location_lat: isDelivery ? (location?.lat ?? null) : null,
      p_location_lng: isDelivery ? (location?.lng ?? null) : null,
      p_desired_date: input.desiredDate?.trim() || null,
      p_desired_time: input.desiredTime?.trim() || null,
      p_comment: input.comment?.trim() ?? '',
    }),
    'Не удалось отправить заявку. Попробуйте ещё раз.',
  ) as { order_id: string; order_number: number }[]
  const created = result[0]
  if (!created) throw new ApiError('storage', 'Не удалось отправить заявку. Попробуйте ещё раз.')

  const product = unwrap(
    await supabase.from('products').select('name, price').eq('id', input.productId).maybeSingle(),
  ) as { name: string; price: number } | null

  emit(['orders', 'products'])
  const now = new Date().toISOString()
  return {
    id: created.order_id,
    number: created.order_number,
    status: 'new',
    source: 'site',
    productId: input.productId,
    productName: product?.name ?? '',
    price: product?.price ?? 0,
    costPrice: null,
    quantity: input.quantity,
    customerName,
    customerPhone,
    deliveryType: input.deliveryType,
    address: isDelivery ? address : '',
    location: isDelivery ? location : null,
    desiredDate: input.desiredDate?.trim() ?? '',
    desiredTime: input.desiredTime?.trim() ?? '',
    comment: input.comment?.trim() ?? '',
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** Заказы, новые сверху. Только для администратора (RLS). */
export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  let query = supabase.from('orders').select(COLUMNS).order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  const rows = unwrap(await query, 'Не удалось загрузить заказы') as OrderRow[]
  return rows.map(orderFromRow)
}

export async function getOrder(id: string): Promise<Order | null> {
  const row = unwrap(await supabase.from('orders').select(COLUMNS).eq('id', id).maybeSingle()) as OrderRow | null
  return row ? orderFromRow(row) : null
}

/** История заказа, старые события сверху. */
export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const rows = unwrap(
    await supabase
      .from('order_events')
      .select('id, order_id, type, from_status, to_status, message, created_at')
      .eq('order_id', orderId)
      .order('created_at'),
  ) as OrderEventRow[]
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    type: row.type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    message: row.message,
    createdAt: row.created_at,
  }))
}

/**
 * Отменяет заказ и возвращает товар на склад — ровно один раз:
 * повторная отмена ничего не делает. Выполненный заказ отменить нельзя → `invalid_transition`.
 */
export async function cancelOrder(id: string): Promise<Order> {
  const row = unwrap(await supabase.rpc('cancel_order', { p_order_id: id })) as OrderRow
  emit(['orders', 'products'])
  return orderFromRow(row)
}

/**
 * Меняет статус: new → confirmed → completed (можно и сразу new → completed).
 * Статус `cancelled` работает как `cancelOrder`. Недопустимый переход → `invalid_transition`.
 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  if (status === 'cancelled') return cancelOrder(id)
  const row = unwrap(await supabase.rpc('update_order_status', { p_order_id: id, p_status: status })) as OrderRow
  emit(['orders'])
  return orderFromRow(row)
}

/** Сохраняет заметку администратора (клиент её не видит). */
export async function setOrderAdminNote(id: string, note: string): Promise<Order> {
  const row = unwrap(await supabase.rpc('set_order_admin_note', { p_order_id: id, p_note: note })) as OrderRow
  emit(['orders'])
  return orderFromRow(row)
}
