// Настройки магазина. ВНИМАНИЕ: название, город и контакты — временные заглушки,
// настоящие значения заполнит владелец магазина.

export const shop = {
  name: 'Phone Market',
  tagline: 'Смартфоны, ноутбуки, гаджеты и техника для дома',
  city: 'Ош',
  currency: '₽',

  /** Телефон в международном формате, без пробелов. */
  phone: '+70000000000',
  /** Номер WhatsApp: только цифры, без «+». */
  whatsapp: '70000000000',
  /** Имя пользователя или канала в Telegram, без «@». */
  telegram: 'phone_market_demo',

  pickupAddress: 'ул. Ленина, 1 (адрес-заглушка)',
  workingHours: 'Ежедневно с 10:00 до 20:00',

  /** При таком остатке и меньше показываем «Осталось N шт.» и шлём уведомление. */
  lowStockThreshold: 3,
  /** Максимум фото у одного товара (в локальной версии место в localStorage ограничено). */
  maxProductImages: 5,
  /** Максимум фото в заявке на trade-in. */
  maxTradeInPhotos: 5,
  /** Slug-и категорий, на странице новых товаров которых показываем ссылку «Обменять старый (trade-in)». */
  tradeInCategorySlugs: ['smartfony'] as readonly string[],

  /** Демо-вход в админку. Только для локальной версии — потом Supabase Auth. */
  demoAdminEmail: 'admin@phone-market.local',
  demoAdminPassword: 'admin123',
} as const
