// Заказы. Здесь живёт логика склада: заявка списывает остаток, отмена возвращает.
// В Supabase-версии: createOrder → Edge Function `create-order` + RPC `create_order`,
// cancelOrder → RPC `cancel_order`, остальное — обычные запросы админа.

import { ORDER_STATUS_LABELS } from '../config/labels'
import type {
  CreateOrderInput,
  Order,
  OrderEvent,
  OrderEventType,
  OrderFilters,
  OrderStatus,
} from '../types'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { requireAdmin } from './auth'
import { clone, createId, delay, mutate, nowISO, readDb, type Db } from './db'
import { ApiError } from './errors'
import { notify } from './notify'
import { notifyStock } from './products'

/** Допустимые переходы статусов. Из «Выполнен» и «Отменён» пути назад нет. */
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

function addEvent(
  db: Db,
  order: Order,
  type: OrderEventType,
  message: string,
  fromStatus: OrderStatus | null = null,
  toStatus: OrderStatus | null = null,
): void {
  const event: OrderEvent = {
    id: createId(),
    orderId: order.id,
    type,
    fromStatus,
    toStatus,
    message,
    createdAt: order.updatedAt,
  }
  db.orderEvents.push(event)
}

function findOrder(db: Db, id: string): Order {
  const order = db.orders.find((o) => o.id === id)
  if (!order) throw new ApiError('not_found', 'Заказ не найден')
  return order
}

/**
 * Создаёт заявку (доступно без входа). В одной «транзакции»:
 * проверяет товар и остаток → списывает со склада → сохраняет цену в заказе →
 * пишет событие в историю. После — уведомляет менеджеров.
 * Ошибки: `validation`, `not_found`, `product_unavailable`, `out_of_stock`.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  await delay(400)

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

  const { order, product, stockBefore } = mutate(['orders', 'products'], (db) => {
    const product = db.products.find((p) => p.id === input.productId)
    if (!product) throw new ApiError('not_found', 'Товар не найден')
    const category = db.categories.find((c) => c.id === product.categoryId)
    if (!product.isActive || !category?.isActive) {
      throw new ApiError('product_unavailable', 'Товар сейчас недоступен для заказа')
    }
    if (product.stock < input.quantity) {
      throw new ApiError(
        'out_of_stock',
        product.stock === 0
          ? 'Недостаточно товара на складе: товар закончился'
          : `Недостаточно товара на складе: осталось ${product.stock} шт.`,
      )
    }

    const now = nowISO()
    const stockBefore = product.stock
    product.stock -= input.quantity
    product.updatedAt = now

    const created: Order = {
      id: createId(),
      number: db.nextOrderNumber,
      status: 'new',
      source: input.source ?? 'site',
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: input.quantity,
      customerName,
      customerPhone,
      deliveryType: input.deliveryType,
      address: input.deliveryType === 'delivery' ? address : '',
      location: input.deliveryType === 'delivery' ? location : null,
      desiredDate: input.desiredDate?.trim() ?? '',
      desiredTime: input.desiredTime?.trim() ?? '',
      comment: input.comment?.trim() ?? '',
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    }
    db.nextOrderNumber += 1
    db.orders.push(created)
    addEvent(db, created, 'created', `Заявка создана, со склада списано ${created.quantity} шт.`, null, 'new')
    return { order: clone(created), product: clone(product), stockBefore }
  })

  void notify({ type: 'order_created', order })
  notifyStock(product, stockBefore)
  return order
}

/** Заказы, новые сверху. Только для администратора. */
export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  await delay()
  requireAdmin()
  const { orders } = readDb()
  const result = filters.status ? orders.filter((o) => o.status === filters.status) : orders
  return clone(result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

export async function getOrder(id: string): Promise<Order | null> {
  await delay()
  requireAdmin()
  return clone(readDb().orders.find((o) => o.id === id) ?? null)
}

/** История заказа, старые события сверху. */
export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  await delay()
  requireAdmin()
  const events = readDb().orderEvents.filter((e) => e.orderId === orderId)
  return clone(events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
}

/**
 * Отменяет заказ и возвращает товар на склад — ровно один раз:
 * повторная отмена ничего не делает и просто возвращает заказ.
 * Выполненный заказ отменить нельзя → `ApiError('invalid_transition')`.
 */
export async function cancelOrder(id: string): Promise<Order> {
  await delay()
  requireAdmin()
  const { order, changed } = mutate(['orders', 'products'], (db) => {
    const found = findOrder(db, id)
    if (found.status === 'cancelled') return { order: clone(found), changed: false }
    if (!ORDER_TRANSITIONS[found.status].includes('cancelled')) {
      throw new ApiError('invalid_transition', 'Выполненный заказ отменить нельзя')
    }

    const fromStatus = found.status
    found.status = 'cancelled'
    found.updatedAt = nowISO()

    const product = db.products.find((p) => p.id === found.productId)
    if (product) {
      product.stock += found.quantity
      product.updatedAt = found.updatedAt
    }
    const message = product
      ? `Заказ отменён, на склад возвращено ${found.quantity} шт.`
      : 'Заказ отменён (товар удалён из каталога, на склад ничего не возвращено)'
    addEvent(db, found, 'cancelled', message, fromStatus, 'cancelled')
    return { order: clone(found), changed: true }
  })
  if (changed) void notify({ type: 'order_cancelled', order })
  return order
}

/**
 * Меняет статус: new → confirmed → completed (можно и сразу new → completed). Статус `cancelled` работает как `cancelOrder`.
 * Недопустимый переход → `ApiError('invalid_transition')`.
 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  if (status === 'cancelled') return cancelOrder(id)
  await delay()
  requireAdmin()
  const { order, fromStatus } = mutate(['orders'], (db) => {
    const found = findOrder(db, id)
    if (!ORDER_TRANSITIONS[found.status].includes(status)) {
      throw new ApiError(
        'invalid_transition',
        `Нельзя перевести заказ из статуса «${ORDER_STATUS_LABELS[found.status]}» в «${ORDER_STATUS_LABELS[status]}»`,
      )
    }
    const fromStatus = found.status
    found.status = status
    found.updatedAt = nowISO()
    addEvent(
      db,
      found,
      'status_changed',
      `Статус: ${ORDER_STATUS_LABELS[fromStatus]} → ${ORDER_STATUS_LABELS[status]}`,
      fromStatus,
      status,
    )
    return { order: clone(found), fromStatus }
  })
  void notify({ type: 'order_status_changed', order, fromStatus })
  return order
}

/** Сохраняет заметку администратора (клиент её не видит). */
export async function setOrderAdminNote(id: string, note: string): Promise<Order> {
  await delay()
  requireAdmin()
  return mutate(['orders'], (db) => {
    const found = findOrder(db, id)
    const adminNote = note.trim()
    if (found.adminNote === adminNote) return clone(found)
    found.adminNote = adminNote
    found.updatedAt = nowISO()
    addEvent(db, found, 'note_updated', adminNote ? 'Заметка администратора изменена' : 'Заметка администратора удалена')
    return clone(found)
  })
}
