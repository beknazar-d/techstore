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
import { live } from '../i18n'

// Подписи переводятся сами: значения берутся из словаря текущего языка (src/i18n/*/labels.ts).

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = live((m) => m.labels.orderStatus)

/** Порядок статусов для фильтров и списков. */
export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'completed', 'cancelled']

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = live((m) => m.labels.deliveryType)

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = live((m) => m.labels.orderSource)

export const SPEC_FIELD_TYPE_LABELS: Record<SpecFieldType, string> = live((m) => m.labels.specFieldType)

export const CONDITION_LABELS: Record<ProductCondition, string> = live((m) => m.labels.condition)

export const DEVICE_GRADE_LABELS: Record<DeviceGrade, string> = live((m) => m.labels.deviceGrade)

export const DEVICE_GRADES: DeviceGrade[] = ['excellent', 'good', 'fair']

export const TRADE_IN_STATUS_LABELS: Record<TradeInStatus, string> = live((m) => m.labels.tradeInStatus)

export const TRADE_IN_STATUSES: TradeInStatus[] = ['new', 'evaluated', 'accepted', 'rejected', 'completed']

export const TRADE_IN_DEVICE_CATEGORY_LABELS: Record<TradeInDeviceCategory, string> = live((m) => m.labels.tradeInDeviceCategory)

export const TRADE_IN_DEVICE_CATEGORIES: TradeInDeviceCategory[] = ['smartphone', 'laptop', 'watch', 'other']

export const CHAT_MODE_LABELS: Record<ChatMode, string> = live((m) => m.labels.chatMode)

export const CHAT_MODES: ChatMode[] = ['manager', 'bot', 'closed']

export const CHAT_SENDER_LABELS: Record<ChatSender, string> = live((m) => m.labels.chatSender)
