// Заявки на trade-in: клиент описывает старое устройство, магазин оценивает и перезванивает.
// Денег на сайте нет: сумма выкупа и доплата обсуждаются по телефону или в магазине.

import { TRADE_IN_STATUS_LABELS } from '../config/labels'
import { shop } from '../config/shop'
import type {
  CreateTradeInInput,
  TradeInDevice,
  TradeInEvent,
  TradeInEventType,
  TradeInFilters,
  TradeInRequest,
  TradeInStatus,
} from '../types'
import { formatPrice } from '../utils/format'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { requireAdmin } from './auth'
import { clone, createId, delay, mutate, nowISO, readDb, type Db } from './db'
import { ApiError } from './errors'
import { notify } from './notify'

/**
 * Допустимые переходы: new → evaluated → accepted | rejected → completed.
 * В `evaluated` заявку переводит только `evaluateTradeIn` (нужна сумма оценки).
 * Отказаться можно на любом шаге до завершения. `rejected` и `completed` — конечные.
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

function addEvent(
  db: Db,
  tradeIn: TradeInRequest,
  type: TradeInEventType,
  message: string,
  fromStatus: TradeInStatus | null = null,
  toStatus: TradeInStatus | null = null,
): void {
  const event: TradeInEvent = {
    id: createId(),
    tradeInId: tradeIn.id,
    type,
    fromStatus,
    toStatus,
    message,
    createdAt: tradeIn.updatedAt,
  }
  db.tradeInEvents.push(event)
}

function findTradeIn(db: Db, id: string): TradeInRequest {
  const tradeIn = db.tradeIns.find((t) => t.id === id)
  if (!tradeIn) throw new ApiError('not_found', 'Заявка не найдена')
  return tradeIn
}

function cleanDevice(device: TradeInDevice): TradeInDevice {
  const brand = device.brand.trim()
  const model = device.model.trim()
  if (!brand) throw new ApiError('validation', 'Укажите марку устройства')
  if (!model) throw new ApiError('validation', 'Укажите модель устройства')

  const clean: TradeInDevice = { category: device.category, brand, model, grade: device.grade }
  if (device.memory?.trim()) clean.memory = device.memory.trim()
  if (device.batteryHealth !== undefined) {
    const value = device.batteryHealth
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new ApiError('validation', 'Ёмкость аккумулятора — целое число от 1 до 100')
    }
    clean.batteryHealth = value
  }
  if (device.defects?.trim()) clean.defects = device.defects.trim()
  if (device.kit?.trim()) clean.kit = device.kit.trim()
  return clean
}

/**
 * Создаёт заявку на trade-in (доступно без входа). Склад не трогает.
 * Если указан `desiredProductId`, в заявке сохраняются название и цена этого товара.
 */
export async function createTradeIn(input: CreateTradeInInput): Promise<TradeInRequest> {
  await delay(400)

  const customerName = input.customerName.trim()
  const customerPhone = normalizePhone(input.customerPhone)
  if (!customerName) throw new ApiError('validation', 'Укажите ваше имя')
  if (!isValidPhone(customerPhone)) throw new ApiError('validation', 'Укажите корректный номер телефона')
  const device = cleanDevice(input.device)
  const photos = input.photos ?? []
  if (photos.length > shop.maxTradeInPhotos) {
    throw new ApiError('validation', `Не больше ${shop.maxTradeInPhotos} фото`)
  }

  const tradeIn = mutate(['tradeIns'], (db) => {
    // Желаемый товар могли удалить или скрыть, пока клиент заполнял форму — тогда заявка идёт без него.
    const desired = input.desiredProductId
      ? db.products.find((p) => p.id === input.desiredProductId && p.isActive)
      : undefined
    const now = nowISO()
    const created: TradeInRequest = {
      id: createId(),
      number: db.nextTradeInNumber,
      status: 'new',
      customerName,
      customerPhone,
      device,
      photos,
      desiredProductId: desired?.id ?? null,
      desiredProductName: desired?.name ?? '',
      desiredProductPrice: desired?.price ?? null,
      comment: input.comment?.trim() ?? '',
      adminEstimate: null,
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    }
    db.nextTradeInNumber += 1
    db.tradeIns.push(created)
    addEvent(db, created, 'created', 'Заявка создана', null, 'new')
    return clone(created)
  })

  void notify({ type: 'trade_in_created', tradeIn })
  return tradeIn
}

/** Заявки, новые сверху. Только для администратора. */
export async function listTradeIns(filters: TradeInFilters = {}): Promise<TradeInRequest[]> {
  await delay()
  requireAdmin()
  const { tradeIns } = readDb()
  const result = filters.status ? tradeIns.filter((t) => t.status === filters.status) : tradeIns
  return clone(result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

export async function getTradeIn(id: string): Promise<TradeInRequest | null> {
  await delay()
  requireAdmin()
  return clone(readDb().tradeIns.find((t) => t.id === id) ?? null)
}

/** История заявки, старые события сверху. */
export async function listTradeInEvents(tradeInId: string): Promise<TradeInEvent[]> {
  await delay()
  requireAdmin()
  const events = readDb().tradeInEvents.filter((e) => e.tradeInId === tradeInId)
  return clone(events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
}

/**
 * Ставит оценку (цену выкупа, ₽) и переводит заявку в `evaluated`.
 * Оценку можно менять, пока клиент не ответил (статусы `new` и `evaluated`).
 * `note`, если передана, заменяет заметку администратора.
 */
export async function evaluateTradeIn(id: string, estimate: number, note?: string): Promise<TradeInRequest> {
  await delay()
  requireAdmin()
  if (!Number.isInteger(estimate) || estimate <= 0) {
    throw new ApiError('validation', 'Оценка — целое число больше нуля')
  }
  const { tradeIn, fromStatus } = mutate(['tradeIns'], (db) => {
    const found = findTradeIn(db, id)
    if (!canEvaluateTradeIn(found.status)) {
      throw new ApiError(
        'invalid_transition',
        `Оценку нельзя изменить: заявка в статусе «${TRADE_IN_STATUS_LABELS[found.status]}»`,
      )
    }
    const fromStatus = found.status
    found.status = 'evaluated'
    found.adminEstimate = estimate
    if (note !== undefined) found.adminNote = note.trim()
    found.updatedAt = nowISO()
    addEvent(db, found, 'evaluated', `Оценка: ${formatPrice(estimate)}`, fromStatus, 'evaluated')
    return { tradeIn: clone(found), fromStatus }
  })
  void notify({ type: 'trade_in_status_changed', tradeIn, fromStatus })
  return tradeIn
}

/**
 * Меняет статус: evaluated → accepted → completed, либо rejected на любом шаге до завершения.
 * Недопустимый переход → `ApiError('invalid_transition')`. Для оценки — `evaluateTradeIn`.
 */
export async function updateTradeInStatus(id: string, status: TradeInStatus): Promise<TradeInRequest> {
  await delay()
  requireAdmin()
  const { tradeIn, fromStatus } = mutate(['tradeIns'], (db) => {
    const found = findTradeIn(db, id)
    if (!TRADE_IN_TRANSITIONS[found.status].includes(status)) {
      throw new ApiError(
        'invalid_transition',
        status === 'evaluated'
          ? 'Чтобы оценить заявку, укажите сумму оценки'
          : `Нельзя перевести заявку из статуса «${TRADE_IN_STATUS_LABELS[found.status]}» в «${TRADE_IN_STATUS_LABELS[status]}»`,
      )
    }
    const fromStatus = found.status
    found.status = status
    found.updatedAt = nowISO()
    addEvent(
      db,
      found,
      'status_changed',
      `Статус: ${TRADE_IN_STATUS_LABELS[fromStatus]} → ${TRADE_IN_STATUS_LABELS[status]}`,
      fromStatus,
      status,
    )
    return { tradeIn: clone(found), fromStatus }
  })
  void notify({ type: 'trade_in_status_changed', tradeIn, fromStatus })
  return tradeIn
}

/** Сохраняет заметку администратора (клиент её не видит). */
export async function setTradeInAdminNote(id: string, note: string): Promise<TradeInRequest> {
  await delay()
  requireAdmin()
  return mutate(['tradeIns'], (db) => {
    const found = findTradeIn(db, id)
    const adminNote = note.trim()
    if (found.adminNote === adminNote) return clone(found)
    found.adminNote = adminNote
    found.updatedAt = nowISO()
    addEvent(db, found, 'note_updated', adminNote ? 'Заметка администратора изменена' : 'Заметка администратора удалена')
    return clone(found)
  })
}
