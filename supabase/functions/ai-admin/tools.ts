// Инструменты ИИ-ассистента админки. Выполняет их браузер (src/admin/components/AiAssistant),
// вызывая те же функции src/api, что и формы админки. Имена и поля должны совпадать
// с обработчиками в src/api/ai.ts.

import type { Anthropic } from '../_shared/ai.ts'

type Tool = Anthropic.Beta.BetaTool

const specField = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'Ключ латиницей: screen, memory, battery' },
    label: { type: 'string', description: 'Подпись по-русски: «Экран»' },
    unit: { type: 'string', description: 'Единица: «дюйм», «ГБ», «Вт»' },
    type: { type: 'string', enum: ['text', 'number', 'select', 'boolean'] },
    options: { type: 'array', items: { type: 'string' }, description: 'Варианты для type: select' },
  },
  required: ['key', 'label', 'type'],
}

const usedInfo = {
  type: 'object',
  description: 'Только для Б/У (condition: used)',
  properties: {
    grade: { type: 'string', enum: ['excellent', 'good', 'fair'], description: 'Отличное / Хорошее / Удовлетворительное' },
    batteryHealth: { type: 'integer', description: 'Здоровье аккумулятора, %' },
    warrantyMonths: { type: 'integer', description: 'Гарантия магазина, мес.' },
    defects: { type: 'string' },
    kit: { type: 'string', description: 'Комплект: коробка, кабель…' },
  },
  required: ['grade'],
}

const productFields = {
  categoryId: { type: 'string', description: 'id категории из list_categories' },
  name: { type: 'string', description: 'Название. У Б/У в конце «(Б/У)»' },
  brand: { type: 'string' },
  description: { type: 'string' },
  condition: { type: 'string', enum: ['new', 'used'] },
  usedInfo,
  price: { type: 'integer', description: 'Цена в рублях' },
  minPrice: { type: 'integer', description: 'Минимальная цена для торга бота, ₽ (необязательно)' },
  costPrice: { type: 'integer', description: 'Закупочная цена за штуку, ₽ (необязательно)' },
  stock: { type: 'integer', description: 'Остаток на складе, шт.' },
  isActive: { type: 'boolean', description: 'Показывать на сайте' },
  specs: {
    type: 'object',
    description: 'Характеристики по ключам spec_fields категории: { "screen": 6.1, "memory": "256 ГБ" }',
    additionalProperties: { type: ['string', 'number', 'boolean'] },
  },
}

export const ASSISTANT_TOOLS: Tool[] = [
  {
    name: 'list_categories',
    description: 'Все категории магазина с id и шаблоном характеристик (specFields).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_category',
    description: 'Создать категорию. Шаблон характеристик — поля, которые заполняются у товаров этой категории.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        isActive: { type: 'boolean' },
        specFields: { type: 'array', items: specField },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_category',
    description: 'Изменить категорию: название, видимость, порядок, шаблон характеристик (передавайте шаблон целиком).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'integer' },
        specFields: { type: 'array', items: specField },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_products',
    description: 'Найти товары (до 50). Возвращает id, название, цену, остаток, категорию, характеристики.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Часть названия или бренда' },
        categoryId: { type: 'string' },
        condition: { type: 'string', enum: ['new', 'used'] },
      },
    },
  },
  {
    name: 'create_product',
    description:
      'Создать товар. Фото так не добавить — их загружают в карточке товара. Обязательны категория, название, цена, остаток.',
    input_schema: {
      type: 'object',
      properties: productFields,
      required: ['categoryId', 'name', 'price', 'stock'],
    },
  },
  {
    name: 'update_product',
    description: 'Изменить поля товара. Передавайте только то, что меняется.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, ...productFields },
      required: ['id'],
    },
  },
  {
    name: 'adjust_stock',
    description: 'Изменить остаток на складе: +5 — приход, −1 — списание.',
    input_schema: {
      type: 'object',
      properties: { productId: { type: 'string' }, delta: { type: 'integer' } },
      required: ['productId', 'delta'],
    },
  },
  {
    name: 'list_orders',
    description: 'Заказы (новые сверху, до 50).',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['new', 'confirmed', 'completed', 'cancelled'] } },
    },
  },
  {
    name: 'update_order_status',
    description: 'Сменить статус заказа. cancelled возвращает товар на склад.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string', enum: ['confirmed', 'completed', 'cancelled'] },
      },
      required: ['orderId', 'status'],
    },
  },
  {
    name: 'list_trade_ins',
    description: 'Заявки на trade-in (новые сверху, до 50).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['new', 'evaluated', 'accepted', 'rejected', 'completed'] },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Статистика магазина за 7, 30 или 90 дней: выручка, прибыль, заказы, товары.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', enum: [7, 30, 90] } },
      required: ['days'],
    },
  },
]

export function assistantSystem(extra: string): string {
  const base = `Ты — ИИ-помощник администратора магазина электроники (смартфоны, ноутбуки, наушники, часы, Dyson, аксессуары; новые и Б/У). Ты работаешь внутри админки и выполняешь поручения через инструменты: категории, товары, склад, заказы, trade-in, статистика.

Правила магазина: онлайн-оплаты, корзины и рассрочки нет — клиент оставляет заявку на один товар и платит при получении. Цены — целые числа в рублях.

Как работать:
- Перед созданием товара узнай id категории через list_categories и заполни specs по ключам её specFields. Если нужной категории нет — спроси, создать ли её.
- Не выдумывай цену, остаток и характеристики, которых нет в поручении. Если без них не обойтись — спроси одним сообщением. Общеизвестные характеристики модели (экран, процессор) можно заполнить, если уверен.
- Б/У товар: condition used, usedInfo.grade, в названии в конце «(Б/У)».
- Новый товар по умолчанию виден на сайте (isActive: true).
- Удалять ты не умеешь: удаление делается вручную в админке. Фото загружаются в карточке товара.
- Перед массовыми изменениями (больше 5 товаров или отмена заказов) коротко опиши план и дождись согласия.
- После действий коротко отчитайся, что сделано. Пиши по-русски, просто, без таблиц.`
  const trimmed = extra.trim()
  return trimmed ? `${base}\n\nДополнительные указания администратора:\n${trimmed}` : base
}
