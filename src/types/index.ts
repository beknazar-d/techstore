// Типы данных. Поля в camelCase; в Supabase-версии слой src/api/ сопоставит их
// со snake_case колонками (category_id, is_active, spec_fields, ...).

// ---------- Категории ----------

export type SpecFieldType = 'text' | 'number' | 'select' | 'boolean'

/** Одно поле шаблона характеристик категории. */
export interface SpecField {
  /** Ключ в `Product.specs`, латиница: `screen`, `battery_life`. */
  key: string
  /** Подпись для людей: «Экран». */
  label: string
  /** Единица измерения: «дюйм», «Вт». */
  unit?: string
  type: SpecFieldType
  /** Варианты для `type: 'select'`. */
  options?: string[]
}

export interface Category {
  id: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  specFields: SpecField[]
}

export interface CategoryInput {
  name: string
  /** Если не задан — строится из названия. */
  slug?: string
  sortOrder?: number
  isActive?: boolean
  specFields: SpecField[]
}

export interface CategoryFilters {
  /** Только активные (для клиентской части). */
  onlyActive?: boolean
}

// ---------- Товары ----------

export type SpecValue = string | number | boolean
export type ProductSpecs = Record<string, SpecValue>

export type ProductCondition = 'new' | 'used'

/** Состояние Б/У устройства: Отличное / Хорошее / Удовлетворительное. */
export type DeviceGrade = 'excellent' | 'good' | 'fair'

/** Сведения о Б/У товаре (только при `condition: 'used'`). */
export interface UsedInfo {
  grade: DeviceGrade
  /** Ёмкость аккумулятора, %, 1–100. */
  batteryHealth?: number
  /** Гарантия магазина, месяцев. */
  warrantyMonths?: number
  /** Дефекты: царапины, сколы и т.п. */
  defects?: string
  /** Комплект: коробка, кабель, чехол. */
  kit?: string
}

export interface Product {
  id: string
  categoryId: string
  name: string
  slug: string
  brand: string
  description: string
  condition: ProductCondition
  /** Заполнено только у Б/У товаров, иначе null. */
  usedInfo: UsedInfo | null
  /** Цена, целое число в рублях. */
  price: number
  /** Нижняя граница торга для Telegram-бота. Видит только админ. */
  minPrice: number | null
  /** Остаток на складе, >= 0. */
  stock: number
  isActive: boolean
  /** Фото (сейчас data URL, позже URL в R2). Первое — главное. */
  images: string[]
  /** Значения характеристик по ключам из `Category.specFields`. */
  specs: ProductSpecs
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  categoryId: string
  name: string
  /** Если не задан — строится из названия. */
  slug?: string
  brand: string
  description: string
  /** По умолчанию `new`. */
  condition?: ProductCondition
  /** Обязательно для `condition: 'used'`. */
  usedInfo?: UsedInfo | null
  price: number
  minPrice?: number | null
  stock: number
  isActive: boolean
  images: string[]
  specs: ProductSpecs
}

export interface ProductFilters {
  categoryId?: string
  categorySlug?: string
  /** Поиск по названию и бренду. */
  search?: string
  /** Новые или Б/У. Не задано — все. */
  condition?: ProductCondition
  /** Только активные товары из активных категорий (для клиентской части). */
  onlyActive?: boolean
  limit?: number
}

// ---------- Заказы ----------

/** new → confirmed → completed, либо cancelled */
export type OrderStatus = 'new' | 'confirmed' | 'completed' | 'cancelled'
export type OrderSource = 'site' | 'telegram'
export type DeliveryType = 'pickup' | 'delivery'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface Order {
  id: string
  /** Короткий номер для клиента: 1001, 1002, ... */
  number: number
  status: OrderStatus
  source: OrderSource
  /** null, если товар позже удалили. Название и цена сохранены в заказе. */
  productId: string | null
  productName: string
  /** Цена за штуку на момент заказа. */
  price: number
  quantity: number
  customerName: string
  customerPhone: string
  deliveryType: DeliveryType
  address: string
  location: GeoPoint | null
  /** `YYYY-MM-DD` или пустая строка. */
  desiredDate: string
  /** `HH:MM` или пустая строка. */
  desiredTime: string
  comment: string
  adminNote: string
  createdAt: string
  updatedAt: string
}

export interface CreateOrderInput {
  productId: string
  quantity: number
  customerName: string
  customerPhone: string
  deliveryType: DeliveryType
  address?: string
  location?: GeoPoint | null
  desiredDate?: string
  desiredTime?: string
  comment?: string
  /** По умолчанию `site`. */
  source?: OrderSource
}

export interface OrderFilters {
  status?: OrderStatus
}

export type OrderEventType = 'created' | 'status_changed' | 'cancelled' | 'note_updated'

/** Запись истории заказа (таблица order_events). */
export interface OrderEvent {
  id: string
  orderId: string
  type: OrderEventType
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  /** Готовый текст на русском для показа в истории. */
  message: string
  createdAt: string
}

// ---------- Trade-in ----------

/** new → evaluated → accepted | rejected → completed */
export type TradeInStatus = 'new' | 'evaluated' | 'accepted' | 'rejected' | 'completed'
export type TradeInDeviceCategory = 'smartphone' | 'laptop' | 'watch' | 'other'

/** Устройство, которое клиент сдаёт. */
export interface TradeInDevice {
  category: TradeInDeviceCategory
  brand: string
  model: string
  /** Память, например «128 ГБ». */
  memory?: string
  grade: DeviceGrade
  /** Ёмкость аккумулятора, %, 1–100. */
  batteryHealth?: number
  defects?: string
  kit?: string
}

export interface TradeInRequest {
  id: string
  /** Короткий номер заявки: 501, 502, ... */
  number: number
  status: TradeInStatus
  customerName: string
  customerPhone: string
  device: TradeInDevice
  /** Фото устройства (сжатые data URL, позже URL в R2). */
  photos: string[]
  /** Товар, на который клиент хочет обменять. null — не выбран или удалён. */
  desiredProductId: string | null
  /** Копия названия и цены желаемого товара на момент заявки. */
  desiredProductName: string
  desiredProductPrice: number | null
  comment: string
  /** Предложенная магазином цена выкупа, ₽. */
  adminEstimate: number | null
  adminNote: string
  createdAt: string
  updatedAt: string
}

export interface CreateTradeInInput {
  customerName: string
  customerPhone: string
  device: TradeInDevice
  photos?: string[]
  desiredProductId?: string | null
  comment?: string
}

export interface TradeInFilters {
  status?: TradeInStatus
}

export type TradeInEventType = 'created' | 'evaluated' | 'status_changed' | 'note_updated'

/** Запись истории заявки на trade-in (таблица trade_in_events). */
export interface TradeInEvent {
  id: string
  tradeInId: string
  type: TradeInEventType
  fromStatus: TradeInStatus | null
  toStatus: TradeInStatus | null
  message: string
  createdAt: string
}

// ---------- Админ ----------

export interface AdminSession {
  email: string
  loggedInAt: string
}
