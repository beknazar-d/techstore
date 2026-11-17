import type {
  ChatMode,
  ChatSender,
  DeliveryType,
  DeviceGrade,
  OrderSource,
  OrderStatus,
  ProductCondition,
  SpecFieldType,
  TradeInDeviceCategory,
  TradeInStatus,
} from '../types'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

/** Порядок статусов для фильтров и списков. */
export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'completed', 'cancelled']

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  pickup: 'Самовывоз',
  delivery: 'Доставка',
}

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  site: 'Сайт',
  telegram: 'Telegram',
}

export const SPEC_FIELD_TYPE_LABELS: Record<SpecFieldType, string> = {
  text: 'Текст',
  number: 'Число',
  select: 'Выбор из списка',
  boolean: 'Да / Нет',
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: 'Новый',
  used: 'Б/У',
}

export const DEVICE_GRADE_LABELS: Record<DeviceGrade, string> = {
  excellent: 'Отличное',
  good: 'Хорошее',
  fair: 'Удовлетворительное',
}

export const DEVICE_GRADES: DeviceGrade[] = ['excellent', 'good', 'fair']

export const TRADE_IN_STATUS_LABELS: Record<TradeInStatus, string> = {
  new: 'Новая',
  evaluated: 'Оценена',
  accepted: 'Клиент согласен',
  rejected: 'Отказ',
  completed: 'Завершена',
}

export const TRADE_IN_STATUSES: TradeInStatus[] = ['new', 'evaluated', 'accepted', 'rejected', 'completed']

export const TRADE_IN_DEVICE_CATEGORY_LABELS: Record<TradeInDeviceCategory, string> = {
  smartphone: 'Смартфон',
  laptop: 'Ноутбук',
  watch: 'Смарт-часы',
  other: 'Другое',
}

export const TRADE_IN_DEVICE_CATEGORIES: TradeInDeviceCategory[] = ['smartphone', 'laptop', 'watch', 'other']

export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  bot: 'Отвечает бот',
  manager: 'Нужен менеджер',
  closed: 'Закрыт',
}

export const CHAT_MODES: ChatMode[] = ['manager', 'bot', 'closed']

export const CHAT_SENDER_LABELS: Record<ChatSender, string> = {
  customer: 'Клиент',
  bot: 'Бот',
  manager: 'Менеджер',
}
