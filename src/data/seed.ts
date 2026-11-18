// Демо-данные. Из них генерируется supabase/seed.sql для ЛОКАЛЬНОЙ базы (supabase db reset).
// На боевую базу не попадают. Сайт их не импортирует.
// Цены в рублях. Фото нет — интерфейс показывает заглушку.

import type {
  BotChat,
  BotMessage,
  BotSettings,
  Category,
  Order,
  OrderEvent,
  Product,
  ProductSpecs,
  SpecField,
  TradeInEvent,
  TradeInRequest,
  UsedInfo,
} from '../types'

export interface Db {
  categories: Category[]
  products: Product[]
  orders: Order[]
  orderEvents: OrderEvent[]
  tradeIns: TradeInRequest[]
  tradeInEvents: TradeInEvent[]
  nextOrderNumber: number
  nextTradeInNumber: number
  botSettings: BotSettings
  chats: BotChat[]
  chatMessages: BotMessage[]
}

const MEMORY = ['64 ГБ', '128 ГБ', '256 ГБ', '512 ГБ', '1 ТБ']
const RAM = ['4 ГБ', '6 ГБ', '8 ГБ', '12 ГБ', '16 ГБ', '24 ГБ', '32 ГБ']

function category(id: string, name: string, slug: string, sortOrder: number, specFields: SpecField[]): Category {
  return { id, name, slug, sortOrder, isActive: true, specFields }
}

const categories: Category[] = [
  category('cat-smartphones', 'Смартфоны', 'smartfony', 1, [
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'memory', label: 'Память', type: 'select', options: MEMORY },
    { key: 'ram', label: 'Оперативная память', type: 'select', options: RAM },
    { key: 'camera', label: 'Основная камера', type: 'text' },
    { key: 'battery', label: 'Аккумулятор', unit: 'мА·ч', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
    { key: 'sim', label: 'SIM-карты', type: 'select', options: ['1 nano-SIM', '2 nano-SIM', 'nano-SIM + eSIM'] },
    { key: 'nfc', label: 'NFC', type: 'boolean' },
  ]),
  category('cat-laptops', 'Ноутбуки', 'noutbuki', 2, [
    { key: 'cpu', label: 'Процессор', type: 'text' },
    { key: 'ram', label: 'Оперативная память', type: 'select', options: RAM },
    { key: 'ssd', label: 'Накопитель SSD', type: 'select', options: ['256 ГБ', '512 ГБ', '1 ТБ', '2 ТБ'] },
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'gpu', label: 'Видеокарта', type: 'text' },
    { key: 'weight', label: 'Вес', unit: 'кг', type: 'number' },
    { key: 'os', label: 'Операционная система', type: 'text' },
  ]),
  category('cat-headphones', 'Наушники', 'naushniki', 3, [
    {
      key: 'type',
      label: 'Тип',
      type: 'select',
      options: ['Внутриканальные', 'Вкладыши', 'Накладные', 'Полноразмерные'],
    },
    { key: 'connection', label: 'Подключение', type: 'select', options: ['Bluetooth', 'Проводные', 'Bluetooth + кабель'] },
    { key: 'anc', label: 'Активное шумоподавление', type: 'boolean' },
    { key: 'battery_life', label: 'Время работы', unit: 'ч', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-watches', 'Смарт-часы', 'smart-chasy', 4, [
    { key: 'screen', label: 'Экран', unit: 'дюйм', type: 'number' },
    { key: 'case_size', label: 'Размер корпуса', unit: 'мм', type: 'number' },
    { key: 'battery_life', label: 'Время работы', type: 'text' },
    { key: 'water', label: 'Защита от воды', type: 'text' },
    { key: 'gps', label: 'GPS', type: 'boolean' },
    { key: 'compat', label: 'Совместимость', type: 'select', options: ['iOS', 'Android', 'iOS и Android'] },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-hair', 'Фены и стайлеры', 'feny-i-staylery', 5, [
    { key: 'power', label: 'Мощность', unit: 'Вт', type: 'number' },
    { key: 'modes', label: 'Режимы', type: 'text' },
    { key: 'attachments', label: 'Насадки', type: 'text' },
    { key: 'weight', label: 'Вес', unit: 'г', type: 'number' },
    { key: 'cord', label: 'Длина шнура', unit: 'м', type: 'number' },
    { key: 'ionization', label: 'Ионизация', type: 'boolean' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
  category('cat-vacuums', 'Пылесосы', 'pylesosy', 6, [
    { key: 'type', label: 'Тип', type: 'select', options: ['Вертикальный беспроводной', 'Робот-пылесос', 'Классический'] },
    { key: 'suction', label: 'Мощность всасывания', type: 'text' },
    { key: 'runtime', label: 'Время работы', unit: 'мин', type: 'number' },
    { key: 'dustbin', label: 'Пылесборник', unit: 'л', type: 'number' },
    { key: 'weight', label: 'Вес', unit: 'кг', type: 'number' },
    { key: 'wet', label: 'Влажная уборка', type: 'boolean' },
  ]),
  category('cat-accessories', 'Аксессуары', 'aksessuary', 7, [
    {
      key: 'type',
      label: 'Тип',
      type: 'select',
      options: ['Зарядное устройство', 'Кабель', 'Внешний аккумулятор', 'Чехол', 'Защитное стекло'],
    },
    { key: 'compat', label: 'Совместимость', type: 'text' },
    { key: 'power', label: 'Мощность', unit: 'Вт', type: 'number' },
    { key: 'capacity', label: 'Ёмкость', unit: 'мА·ч', type: 'number' },
    { key: 'length', label: 'Длина', unit: 'м', type: 'number' },
    { key: 'color', label: 'Цвет', type: 'text' },
  ]),
]

interface SeedProduct {
  categoryId: string
  name: string
  slug: string
  brand: string
  description: string
  price: number
  oldPrice?: number
  minPrice?: number
  stock: number
  specs: ProductSpecs
  used?: UsedInfo
}

const products: SeedProduct[] = [
  // ---------- Смартфоны (новые) ----------
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy S24 8/256 ГБ',
    slug: 'samsung-galaxy-s24-8-256',
    brand: 'Samsung',
    description:
      'Компактный флагман с ярким AMOLED-экраном 120 Гц, быстрым процессором и семью годами обновлений. Хорошо лежит в руке и отлично снимает днём и ночью.',
    price: 64990,
    oldPrice: 74990,
    minPrice: 61990,
    stock: 8,
    specs: {
      screen: 6.2,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 10 Мп',
      battery: 4000,
      color: 'Чёрный оникс',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 15 128 ГБ',
    slug: 'apple-iphone-15-128',
    brand: 'Apple',
    description:
      'Dynamic Island, основная камера 48 Мп и разъём USB-C. Алюминиевый корпус с матовым стеклом, которое не собирает отпечатки.',
    price: 69990,
    minPrice: 67490,
    stock: 6,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '6 ГБ',
      camera: '48 + 12 Мп',
      battery: 3349,
      color: 'Голубой',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Xiaomi Redmi Note 13 Pro 8/256 ГБ',
    slug: 'xiaomi-redmi-note-13-pro-8-256',
    brand: 'Xiaomi',
    description:
      'Камера 200 Мп, AMOLED-экран 120 Гц и быстрая зарядка 67 Вт в комплекте. Один из лучших вариантов в своей цене.',
    price: 24990,
    minPrice: 23490,
    stock: 14,
    specs: {
      screen: 6.67,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '200 + 8 + 2 Мп',
      battery: 5000,
      color: 'Полночный чёрный',
      sim: '2 nano-SIM',
      nfc: true,
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy A55 8/128 ГБ',
    slug: 'samsung-galaxy-a55-8-128',
    brand: 'Samsung',
    description:
      'Металлическая рамка, защита от воды IP67 и экран Super AMOLED. Надёжный смартфон на каждый день с батареей на два дня.',
    price: 32990,
    stock: 10,
    specs: {
      screen: 6.6,
      memory: '128 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 5 Мп',
      battery: 5000,
      color: 'Тёмно-синий',
      sim: '2 nano-SIM',
      nfc: true,
    },
  },

  // ---------- Смартфоны (Б/У) ----------
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 14 Pro 256 ГБ (Б/У)',
    slug: 'apple-iphone-14-pro-256-bu',
    brand: 'Apple',
    description:
      'Проверенный Б/У смартфон в отличном состоянии: экран и корпус без царапин, все функции работают. Проверка при получении.',
    price: 62990,
    minPrice: 59990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '256 ГБ',
      ram: '6 ГБ',
      camera: '48 + 12 + 12 Мп',
      battery: 3200,
      color: 'Космический чёрный',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'excellent',
      batteryHealth: 91,
      warrantyMonths: 3,
      kit: 'Коробка, кабель USB-C — Lightning',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 13 128 ГБ (Б/У)',
    slug: 'apple-iphone-13-128-bu',
    brand: 'Apple',
    description:
      'Б/У смартфон в хорошем состоянии. Полностью исправен, Face ID и камеры работают. Небольшие следы использования на корпусе.',
    price: 34990,
    minPrice: 32990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '4 ГБ',
      camera: '12 + 12 Мп',
      battery: 3240,
      color: 'Тёмная ночь',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'good',
      batteryHealth: 86,
      warrantyMonths: 1,
      defects: 'Мелкие царапины на рамке',
      kit: 'Кабель, чехол в подарок',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Apple iPhone 12 64 ГБ (Б/У)',
    slug: 'apple-iphone-12-64-bu',
    brand: 'Apple',
    description:
      'Недорогой Б/У iPhone для звонков, мессенджеров и соцсетей. Исправен, есть заметные следы использования — цена это учитывает.',
    price: 21990,
    minPrice: 19990,
    stock: 1,
    specs: {
      screen: 6.1,
      memory: '64 ГБ',
      ram: '4 ГБ',
      camera: '12 + 12 Мп',
      battery: 2815,
      color: 'Белый',
      sim: 'nano-SIM + eSIM',
      nfc: true,
    },
    used: {
      grade: 'fair',
      batteryHealth: 79,
      warrantyMonths: 1,
      defects: 'Царапины на экране, скол на углу корпуса',
      kit: 'Только смартфон и кабель',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Samsung Galaxy S22 8/128 ГБ (Б/У)',
    slug: 'samsung-galaxy-s22-8-128-bu',
    brand: 'Samsung',
    description:
      'Компактный флагман прошлых лет в отличном состоянии. Экран без выгорания, корпус без сколов, аккумулятор держит день.',
    price: 27990,
    stock: 2,
    specs: {
      screen: 6.1,
      memory: '128 ГБ',
      ram: '8 ГБ',
      camera: '50 + 12 + 10 Мп',
      battery: 3700,
      color: 'Зелёный',
      sim: '2 nano-SIM',
      nfc: true,
    },
    used: {
      grade: 'excellent',
      warrantyMonths: 3,
      kit: 'Коробка, кабель USB-C',
    },
  },
  {
    categoryId: 'cat-smartphones',
    name: 'Xiaomi 12T 8/256 ГБ (Б/У)',
    slug: 'xiaomi-12t-8-256-bu',
    brand: 'Xiaomi',
    description:
      'Б/У смартфон с камерой 108 Мп и зарядкой 120 Вт. Хорошее состояние, на экране наклеено защитное стекло.',
    price: 17990,
    stock: 1,
    specs: {
      screen: 6.67,
      memory: '256 ГБ',
      ram: '8 ГБ',
      camera: '108 + 8 + 2 Мп',
      battery: 5000,
      color: 'Серебристый',
      sim: '2 nano-SIM',
      nfc: true,
    },
    used: {
      grade: 'good',
      warrantyMonths: 1,
      defects: 'Потёртости на задней крышке',
      kit: 'Коробка, зарядное устройство 120 Вт, чехол',
    },
  },

  // ---------- Ноутбуки ----------
  {
    categoryId: 'cat-laptops',
    name: 'Apple MacBook Air 13 M3 8/256 ГБ',
    slug: 'apple-macbook-air-13-m3-8-256',
    brand: 'Apple',
    description:
      'Тонкий и бесшумный ноутбук без вентилятора. До 18 часов работы от батареи, экран Liquid Retina и чип M3 для работы и учёбы.',
    price: 104990,
    minPrice: 99990,
    stock: 2,
    specs: {
      cpu: 'Apple M3 (8 ядер)',
      ram: '8 ГБ',
      ssd: '256 ГБ',
      screen: 13.6,
      gpu: 'Apple M3 GPU (8 ядер)',
      weight: 1.24,
      os: 'macOS',
    },
  },
  {
    categoryId: 'cat-laptops',
    name: 'Lenovo IdeaPad Slim 5 14 16/512 ГБ',
    slug: 'lenovo-ideapad-slim-5-14-16-512',
    brand: 'Lenovo',
    description:
      'Лёгкий металлический ноутбук с OLED-экраном и производительным Ryzen 7. Подсветка клавиатуры и быстрая зарядка через USB-C.',
    price: 62990,
    stock: 5,
    specs: {
      cpu: 'AMD Ryzen 7 8845HS',
      ram: '16 ГБ',
      ssd: '512 ГБ',
      screen: 14,
      gpu: 'AMD Radeon 780M',
      weight: 1.46,
      os: 'Без ОС',
    },
  },
  {
    categoryId: 'cat-laptops',
    name: 'ASUS Vivobook 15 8/512 ГБ',
    slug: 'asus-vivobook-15-8-512',
    brand: 'ASUS',
    description:
      'Доступный ноутбук для учёбы, офиса и фильмов. Большой экран 15,6 дюйма, цифровой блок клавиатуры и быстрый SSD.',
    price: 44990,
    stock: 7,
    specs: {
      cpu: 'Intel Core i5-1335U',
      ram: '8 ГБ',
      ssd: '512 ГБ',
      screen: 15.6,
      gpu: 'Intel Iris Xe',
      weight: 1.7,
      os: 'Windows 11 Home',
    },
  },

  // ---------- Наушники ----------
  {
    categoryId: 'cat-headphones',
    name: 'Apple AirPods Pro 2 (USB-C)',
    slug: 'apple-airpods-pro-2-usb-c',
    brand: 'Apple',
    description:
      'Активное шумоподавление, режим прозрачности и пространственный звук. Футляр с разъёмом USB-C и защитой от брызг.',
    price: 19990,
    stock: 12,
    specs: { type: 'Внутриканальные', connection: 'Bluetooth', anc: true, battery_life: 6, color: 'Белый' },
  },
  {
    categoryId: 'cat-headphones',
    name: 'Sony WH-1000XM5',
    slug: 'sony-wh-1000xm5',
    brand: 'Sony',
    description:
      'Полноразмерные наушники с одним из лучших шумоподавлений. Мягкие амбушюры, 30 часов работы и чистый звук в звонках.',
    price: 29990,
    minPrice: 27990,
    stock: 4,
    specs: { type: 'Полноразмерные', connection: 'Bluetooth + кабель', anc: true, battery_life: 30, color: 'Чёрный' },
  },
  {
    categoryId: 'cat-headphones',
    name: 'Xiaomi Redmi Buds 5',
    slug: 'xiaomi-redmi-buds-5',
    brand: 'Xiaomi',
    description:
      'Недорогие беспроводные наушники с шумоподавлением до 46 дБ. Лёгкие, с быстрой зарядкой: 5 минут — 2 часа музыки.',
    price: 2990,
    stock: 25,
    specs: { type: 'Внутриканальные', connection: 'Bluetooth', anc: true, battery_life: 10, color: 'Чёрный' },
  },

  // ---------- Смарт-часы ----------
  {
    categoryId: 'cat-watches',
    name: 'Apple Watch Series 10 46 мм',
    slug: 'apple-watch-series-10-46',
    brand: 'Apple',
    description:
      'Самые тонкие Apple Watch с большим экраном. Отслеживание сна и тренировок, быстрая зарядка, ответы на звонки с запястья.',
    price: 39990,
    stock: 5,
    specs: {
      screen: 1.96,
      case_size: 46,
      battery_life: 'До 18 часов',
      water: '50 м (WR50)',
      gps: true,
      compat: 'iOS',
      color: 'Глянцевый чёрный',
    },
  },
  {
    categoryId: 'cat-watches',
    name: 'Samsung Galaxy Watch7 44 мм',
    slug: 'samsung-galaxy-watch7-44',
    brand: 'Samsung',
    description:
      'Сапфировое стекло, точный двухдиапазонный GPS и анализ состава тела. Удобный ремешок и яркий экран под солнцем.',
    price: 22990,
    stock: 6,
    specs: {
      screen: 1.5,
      case_size: 44,
      battery_life: 'До 40 часов',
      water: '5 АТМ, IP68',
      gps: true,
      compat: 'Android',
      color: 'Зелёный',
    },
  },
  {
    categoryId: 'cat-watches',
    name: 'Xiaomi Smart Band 9',
    slug: 'xiaomi-smart-band-9',
    brand: 'Xiaomi',
    description:
      'Фитнес-браслет с ярким AMOLED-экраном и батареей до трёх недель. Считает шаги, пульс, сон и 150 видов тренировок.',
    price: 3490,
    stock: 30,
    specs: {
      screen: 1.62,
      battery_life: 'До 21 дня',
      water: '5 АТМ',
      gps: false,
      compat: 'iOS и Android',
      color: 'Чёрный',
    },
  },

  // ---------- Фены и стайлеры ----------
  {
    categoryId: 'cat-hair',
    name: 'Dyson Supersonic HD15',
    slug: 'dyson-supersonic-hd15',
    brand: 'Dyson',
    description:
      'Быстро сушит волосы без перегрева: датчик следит за температурой 40 раз в секунду. Пять магнитных насадок в комплекте.',
    price: 39990,
    minPrice: 37990,
    stock: 4,
    specs: {
      power: 1600,
      modes: '3 скорости, 4 температуры',
      attachments: 'Концентратор, диффузор, насадка для гладкости, для непослушных волос, расчёска',
      weight: 650,
      cord: 2.7,
      ionization: true,
      color: 'Никель / медь',
    },
  },
  {
    categoryId: 'cat-hair',
    name: 'Dyson Airwrap Complete Long',
    slug: 'dyson-airwrap-complete-long',
    brand: 'Dyson',
    description:
      'Мультистайлер для длинных волос: сушит, завивает, выпрямляет и придаёт объём воздухом, без экстремальных температур.',
    price: 54990,
    stock: 0,
    specs: {
      power: 1300,
      modes: '3 скорости, 3 температуры',
      attachments: 'Цилиндры 30 и 40 мм, щётки для гладкости, круглая щётка, фен-насадка',
      weight: 680,
      cord: 2.6,
      ionization: false,
      color: 'Синий / медный',
    },
  },
  {
    categoryId: 'cat-hair',
    name: 'Xiaomi Mijia High Speed H500',
    slug: 'xiaomi-mijia-high-speed-h500',
    brand: 'Xiaomi',
    description:
      'Компактный скоростной фен с ионизацией. Сушит волосы средней длины за пару минут и умещается в дорожную сумку.',
    price: 4990,
    stock: 15,
    specs: {
      power: 1600,
      modes: '2 скорости, 4 температуры',
      attachments: 'Концентратор',
      weight: 365,
      cord: 1.7,
      ionization: true,
      color: 'Белый',
    },
  },

  // ---------- Пылесосы ----------
  {
    categoryId: 'cat-vacuums',
    name: 'Dyson V15 Detect Absolute',
    slug: 'dyson-v15-detect-absolute',
    brand: 'Dyson',
    description:
      'Беспроводной пылесос с лазерной подсветкой пыли и счётчиком частиц на экране. До часа уборки на одном заряде.',
    price: 64990,
    oldPrice: 74990,
    minPrice: 61990,
    stock: 3,
    specs: {
      type: 'Вертикальный беспроводной',
      suction: '240 аВт',
      runtime: 60,
      dustbin: 0.76,
      weight: 3.1,
      wet: false,
    },
  },
  {
    categoryId: 'cat-vacuums',
    name: 'Xiaomi Robot Vacuum S20',
    slug: 'xiaomi-robot-vacuum-s20',
    brand: 'Xiaomi',
    description:
      'Робот-пылесос с лазерной навигацией и влажной уборкой. Строит карту квартиры, объезжает препятствия, управляется со смартфона.',
    price: 17990,
    stock: 6,
    specs: {
      type: 'Робот-пылесос',
      suction: '5000 Па',
      runtime: 130,
      dustbin: 0.4,
      weight: 3.3,
      wet: true,
    },
  },

  // ---------- Аксессуары ----------
  {
    categoryId: 'cat-accessories',
    name: 'Зарядное устройство Anker Nano 20 Вт USB-C',
    slug: 'anker-nano-20w-usb-c',
    brand: 'Anker',
    description: 'Компактная быстрая зарядка для смартфонов и наушников. Не греется и не занимает соседнюю розетку.',
    price: 1290,
    stock: 40,
    specs: { type: 'Зарядное устройство', compat: 'iPhone, Android, наушники', power: 20, color: 'Белый' },
  },
  {
    categoryId: 'cat-accessories',
    name: 'Внешний аккумулятор Baseus Bipow 20000 мА·ч',
    slug: 'baseus-bipow-20000',
    brand: 'Baseus',
    description:
      'Хватит на 3–4 полные зарядки смартфона. Экран с процентами заряда, два выхода USB и USB-C с быстрой зарядкой.',
    price: 2990,
    stock: 18,
    specs: {
      type: 'Внешний аккумулятор',
      compat: 'Смартфоны, планшеты, наушники',
      power: 20,
      capacity: 20000,
      color: 'Чёрный',
    },
  },
  {
    categoryId: 'cat-accessories',
    name: 'Кабель Baseus USB-C — USB-C 100 Вт, 1 м',
    slug: 'baseus-usb-c-usb-c-100w-1m',
    brand: 'Baseus',
    description: 'Кабель в прочной нейлоновой оплётке. Подходит для быстрой зарядки смартфонов и ноутбуков до 100 Вт.',
    price: 590,
    stock: 60,
    specs: { type: 'Кабель', compat: 'Устройства с USB-C', power: 100, length: 1, color: 'Чёрный' },
  },
]

/** Свежий демо-набор. Даты создания идут с шагом в час: первый товар в списке — самый новый. */
export function createSeed(): Db {
  const base = Date.now()
  const seededProducts: Product[] = products.map((item, index) => {
    const createdAt = new Date(base - index * 3_600_000).toISOString()
    return {
      id: `prod-${item.slug}`,
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      brand: item.brand,
      description: item.description,
      condition: item.used ? 'used' : 'new',
      usedInfo: item.used ?? null,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      minPrice: item.minPrice ?? null,
      // Демо-себестоимость: новые ~82% цены, Б/У ~70%, округлено до сотен.
      costPrice: Math.round((item.price * (item.used ? 0.7 : 0.82)) / 100) * 100,
      stock: item.stock,
      isActive: true,
      images: [],
      specs: item.specs,
      createdAt,
      updatedAt: createdAt,
    }
  })

  const demo = createDemoRequests(seededProducts, base)

  return {
    categories: structuredClone(categories),
    products: seededProducts,
    orders: demo.orders,
    orderEvents: demo.orderEvents,
    tradeIns: demo.tradeIns,
    tradeInEvents: demo.tradeInEvents,
    nextOrderNumber: 1001 + demo.orders.length,
    nextTradeInNumber: 501 + demo.tradeIns.length,
    ...createBotSeed(demo.orders, base),
  }
}

/**
 * Несколько демо-заказов и заявок trade-in, чтобы админка не была пустой при показе.
 * Остатки в `products` уже считаются «после» этих заказов — склад здесь не трогаем.
 */
function createDemoRequests(seeded: Product[], base: number) {
  const ago = (minutes: number) => new Date(base - minutes * 60_000).toISOString()
  const day = (offsetDays: number) => new Date(base + offsetDays * 86_400_000).toISOString().slice(0, 10)
  const bySlug = (slug: string) => {
    const product = seeded.find((item) => item.slug === slug)
    if (!product) throw new Error(`seed: нет товара ${slug}`)
    return product
  }

  const s24 = bySlug('samsung-galaxy-s24-8-256')
  const airpods = bySlug('apple-airpods-pro-2-usb-c')
  const dyson = bySlug('dyson-supersonic-hd15')
  const iphone15 = bySlug('apple-iphone-15-128')

  const orders: Order[] = [
    {
      id: 'order-demo-1003', number: 1003, status: 'new', source: 'site',
      productId: s24.id, productName: s24.name, price: s24.price, costPrice: s24.costPrice, quantity: 1,
      customerName: 'Алексей Смирнов', customerPhone: '+79161234567',
      deliveryType: 'delivery', address: 'Москва, ул. Профсоюзная, 45, кв. 12',
      location: { lat: 55.6705, lng: 37.5537 },
      desiredDate: day(1), desiredTime: '18:30',
      comment: 'Позвоните за час до приезда', adminNote: '',
      createdAt: ago(25), updatedAt: ago(25),
    },
    {
      id: 'order-demo-1002', number: 1002, status: 'confirmed', source: 'site',
      productId: airpods.id, productName: airpods.name, price: airpods.price, costPrice: airpods.costPrice, quantity: 2,
      customerName: 'Мария Иванова', customerPhone: '+79035557788',
      deliveryType: 'pickup', address: '', location: null,
      desiredDate: day(0), desiredTime: '15:00',
      comment: '', adminNote: 'Подтвердила по телефону, отложили 2 шт.',
      createdAt: ago(180), updatedAt: ago(150),
    },
    {
      id: 'order-demo-1001', number: 1001, status: 'completed', source: 'site',
      productId: dyson.id, productName: dyson.name, price: dyson.price, costPrice: dyson.costPrice, quantity: 1,
      customerName: 'Ольга Кузнецова', customerPhone: '+79257001020',
      deliveryType: 'delivery', address: 'Москва, Ленинский проспект, 32',
      location: null, desiredDate: day(-1), desiredTime: '12:00',
      comment: 'Домофон 32К', adminNote: 'Доставлено, оплата наличными',
      createdAt: ago(1500), updatedAt: ago(1300),
    },
  ]

  const orderEvents: OrderEvent[] = [
    { id: 'oe-demo-1', orderId: 'order-demo-1003', type: 'created', fromStatus: null, toStatus: 'new', message: 'Заявка создана, со склада списано 1 шт.', createdAt: ago(25) },
    { id: 'oe-demo-2', orderId: 'order-demo-1002', type: 'created', fromStatus: null, toStatus: 'new', message: 'Заявка создана, со склада списано 2 шт.', createdAt: ago(180) },
    { id: 'oe-demo-3', orderId: 'order-demo-1002', type: 'status_changed', fromStatus: 'new', toStatus: 'confirmed', message: 'Статус: Новый → Подтверждён', createdAt: ago(150) },
    { id: 'oe-demo-4', orderId: 'order-demo-1001', type: 'created', fromStatus: null, toStatus: 'new', message: 'Заявка создана, со склада списано 1 шт.', createdAt: ago(1500) },
    { id: 'oe-demo-5', orderId: 'order-demo-1001', type: 'status_changed', fromStatus: 'new', toStatus: 'completed', message: 'Статус: Новый → Выполнен', createdAt: ago(1300) },
  ]

  const tradeIns: TradeInRequest[] = [
    {
      id: 'tradein-demo-502', number: 502, status: 'new',
      customerName: 'Дмитрий Павлов', customerPhone: '+79998887766',
      device: { category: 'smartphone', brand: 'Apple', model: 'iPhone 11', memory: '128 ГБ', grade: 'good', batteryHealth: 81, defects: 'Царапина на задней крышке', kit: 'Только телефон' },
      photos: [], desiredProductId: iphone15.id, desiredProductName: iphone15.name, desiredProductPrice: iphone15.price,
      comment: 'Хочу обменять с доплатой', adminEstimate: null, adminNote: '',
      createdAt: ago(60), updatedAt: ago(60),
    },
    {
      id: 'tradein-demo-501', number: 501, status: 'evaluated',
      customerName: 'Игорь Соколов', customerPhone: '+79260001122',
      device: { category: 'smartphone', brand: 'Samsung', model: 'Galaxy S21', memory: '256 ГБ', grade: 'excellent', batteryHealth: 88, defects: '', kit: 'Коробка, кабель' },
      photos: [], desiredProductId: s24.id, desiredProductName: s24.name, desiredProductPrice: s24.price,
      comment: '', adminEstimate: 18000, adminNote: 'Предложили 18 000 ₽, клиент думает',
      createdAt: ago(600), updatedAt: ago(400),
    },
  ]

  const tradeInEvents: TradeInEvent[] = [
    { id: 'te-demo-1', tradeInId: 'tradein-demo-502', type: 'created', fromStatus: null, toStatus: 'new', message: 'Заявка создана', createdAt: ago(60) },
    { id: 'te-demo-2', tradeInId: 'tradein-demo-501', type: 'created', fromStatus: null, toStatus: 'new', message: 'Заявка создана', createdAt: ago(600) },
    { id: 'te-demo-3', tradeInId: 'tradein-demo-501', type: 'evaluated', fromStatus: 'new', toStatus: 'evaluated', message: 'Оценка: 18 000 ₽', createdAt: ago(400) },
  ]

  // История выполненных и отменённых заказов за 60 дней — чтобы статистике было что показать.
  // Номера: история 1001…, затем три «живых» заказа выше.
  const history = createOrderHistory(seeded, base)
  for (const order of orders) order.number += history.orders.length

  return {
    orders: [...orders, ...history.orders],
    orderEvents: [...orderEvents, ...history.orderEvents],
    tradeIns,
    tradeInEvents,
  }
}

/** Настройки бота по умолчанию: бот не подключён, ИИ и торг включены. */
export function defaultBotSettings(now = new Date().toISOString()): BotSettings {
  return {
    connected: false,
    tokenHint: '',
    botUsername: '',
    isEnabled: true,
    groupId: '',
    notify: { newOrder: true, orderStatus: true, newTradeIn: true, lowStock: true },
    aiEnabled: true,
    greeting: 'Здравствуйте! Я помощник магазина. Подскажу по наличию и ценам, помогу оформить заявку. Оплата — при получении.',
    greetingKy: 'Саламатсызбы! Мен дүкөндүн жардамчысымын. Товарлардын бар-жогу жана баалары боюнча айтып берем, заявка калтырууга жардам берем. Төлөм — алганда.',
    aiInstructions:
      'Отвечай коротко и вежливо, на «вы». Цены и наличие бери только из каталога, не выдумывай. ' +
      'Онлайн-оплаты нет — оплата при получении. Если не знаешь ответа — позови менеджера.',
    allowBargaining: true,
    allowOrders: true,
    handoffToManager: true,
    updatedAt: now,
  }
}

/**
 * Демо-переписка из Telegram, чтобы раздел «Чаты» не был пустым.
 * `orders` — уже созданные заказы (чат может ссылаться на заказ).
 */
export function createBotSeed(orders: Order[], base = Date.now()) {
  const ago = (minutes: number) => new Date(base - minutes * 60_000).toISOString()
  const linkedOrder = orders.find((order) => order.id === 'order-demo-1003') ?? null

  const messages: Array<Omit<BotMessage, 'id'> & { minutesAgo: number }> = [
    // Чат 1: клиент торгуется ниже допустимого — бот позвал менеджера.
    { chatId: 'chat-demo-1', sender: 'customer', text: 'Здравствуйте! Galaxy S24 на 256 есть в наличии?', minutesAgo: 14, createdAt: '' },
    { chatId: 'chat-demo-1', sender: 'bot', text: 'Здравствуйте! Да, Samsung Galaxy S24 8/256 ГБ есть в наличии. Цена — 64 990 ₽, оплата при получении. Оформить заявку?', minutesAgo: 14, createdAt: '' },
    { chatId: 'chat-demo-1', sender: 'customer', text: 'А за 55 000 отдадите? Заберу сегодня', minutesAgo: 12, createdAt: '' },
    { chatId: 'chat-demo-1', sender: 'bot', text: 'Могу предложить 61 990 ₽ — это лучшая цена, которую я могу дать. Если хотите обсудить ещё, подключу менеджера.', minutesAgo: 12, createdAt: '' },
    { chatId: 'chat-demo-1', sender: 'customer', text: 'Давайте менеджера', minutesAgo: 11, createdAt: '' },
    { chatId: 'chat-demo-1', sender: 'customer', text: 'И можно ли сдать мой старый iPhone 12?', minutesAgo: 10, createdAt: '' },
    // Чат 2: бот сам ответил и оформил заявку.
    { chatId: 'chat-demo-2', sender: 'customer', text: 'Добрый вечер, нужен Galaxy S24 с доставкой на Профсоюзную', minutesAgo: 40, createdAt: '' },
    { chatId: 'chat-demo-2', sender: 'bot', text: 'Добрый вечер! Galaxy S24 8/256 ГБ в наличии, 64 990 ₽. Подскажите, пожалуйста, имя, телефон и удобное время доставки.', minutesAgo: 39, createdAt: '' },
    { chatId: 'chat-demo-2', sender: 'customer', text: 'Алексей, +7 916 123-45-67, завтра после 18', minutesAgo: 30, createdAt: '' },
    { chatId: 'chat-demo-2', sender: 'bot', text: `Готово! Заявка №${linkedOrder?.number ?? ''} принята. Менеджер позвонит для подтверждения. Оплата при получении.`, minutesAgo: 25, createdAt: '' },
    // Чат 3: вопрос закрыт.
    { chatId: 'chat-demo-3', sender: 'customer', text: 'Вы работаете в воскресенье?', minutesAgo: 1440, createdAt: '' },
    { chatId: 'chat-demo-3', sender: 'bot', text: 'Да, мы работаем каждый день с 10:00 до 21:00.', minutesAgo: 1440, createdAt: '' },
    { chatId: 'chat-demo-3', sender: 'customer', text: 'Спасибо!', minutesAgo: 1438, createdAt: '' },
  ]

  const chatMessages: BotMessage[] = messages.map(({ minutesAgo, ...message }, index) => ({
    ...message,
    id: `msg-demo-${index + 1}`,
    createdAt: ago(minutesAgo),
  }))

  const last = (chatId: string) => {
    const list = chatMessages.filter((message) => message.chatId === chatId)
    return list[list.length - 1]
  }

  const chats: BotChat[] = [
    {
      id: 'chat-demo-1', telegramChatId: 500100201, customerName: 'Анна', telegramUsername: 'anna_m',
      customerPhone: '', mode: 'manager', handoffReason: 'Клиент просит скидку ниже допустимой и спрашивает про trade-in',
      orderId: null, unreadCount: 2,
      lastMessageText: last('chat-demo-1').text, lastMessageAt: last('chat-demo-1').createdAt, createdAt: ago(14),
    },
    {
      id: 'chat-demo-2', telegramChatId: 500100202, customerName: 'Алексей Смирнов', telegramUsername: 'alex_smirnov',
      customerPhone: '+79161234567', mode: 'bot', handoffReason: '',
      orderId: linkedOrder?.id ?? null, unreadCount: 0,
      lastMessageText: last('chat-demo-2').text, lastMessageAt: last('chat-demo-2').createdAt, createdAt: ago(40),
    },
    {
      id: 'chat-demo-3', telegramChatId: 500100203, customerName: 'Виктор', telegramUsername: '',
      customerPhone: '', mode: 'closed', handoffReason: '',
      orderId: null, unreadCount: 0,
      lastMessageText: last('chat-demo-3').text, lastMessageAt: last('chat-demo-3').createdAt, createdAt: ago(1440),
    },
  ]

  return { botSettings: defaultBotSettings(new Date(base).toISOString()), chats, chatMessages }
}

/**
 * Демо-история продаж за 60 дней: в основном выполненные заказы, часть отменённых.
 * Детерминированная (одинаковая при каждом сбросе), склад не трогает.
 */
function createOrderHistory(seeded: Product[], base: number) {
  // Простой генератор псевдослучайных чисел с фиксированным зерном.
  let state = 20261117
  const random = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]

  const names = [
    'Иван Петров', 'Анна Соколова', 'Сергей Волков', 'Екатерина Морозова', 'Дмитрий Новиков',
    'Ольга Лебедева', 'Максим Козлов', 'Наталья Попова', 'Артём Васильев', 'Юлия Фёдорова',
  ]
  const candidates = seeded.filter((product) => product.condition === 'new' || product.stock > 0)
  const orders: Order[] = []
  const orderEvents: OrderEvent[] = []

  // Чем ближе к сегодняшнему дню, тем больше заказов — на графике виден рост.
  for (let daysAgo = 60; daysAgo >= 2; daysAgo -= 1) {
    const perDay = random() < 0.35 + (60 - daysAgo) / 120 ? (random() < 0.3 ? 2 : 1) : 0
    for (let i = 0; i < perDay; i += 1) {
      const product = pick(candidates)
      const quantity = product.price < 10_000 && random() < 0.4 ? 2 : 1
      const createdAt = new Date(base - daysAgo * 86_400_000 + Math.floor(random() * 10) * 3_600_000).toISOString()
      const updatedAt = new Date(Date.parse(createdAt) + 26 * 3_600_000).toISOString()
      const cancelled = random() < 0.12
      const id = `order-history-${orders.length + 1}`
      orders.push({
        id,
        number: 1001 + orders.length,
        status: cancelled ? 'cancelled' : 'completed',
        source: random() < 0.25 ? 'telegram' : 'site',
        productId: product.id,
        productName: product.name,
        price: product.price,
        costPrice: product.costPrice,
        quantity,
        customerName: pick(names),
        customerPhone: `+7916${String(1_000_000 + Math.floor(random() * 8_999_999))}`,
        deliveryType: random() < 0.5 ? 'pickup' : 'delivery',
        address: '',
        location: null,
        desiredDate: '',
        desiredTime: '',
        comment: '',
        adminNote: '',
        createdAt,
        updatedAt,
      })
      orderEvents.push(
        { id: `${id}-e1`, orderId: id, type: 'created', fromStatus: null, toStatus: 'new', message: `Заявка создана, со склада списано ${quantity} шт.`, createdAt },
        cancelled
          ? { id: `${id}-e2`, orderId: id, type: 'cancelled', fromStatus: 'new', toStatus: 'cancelled', message: `Заказ отменён, на склад возвращено ${quantity} шт.`, createdAt: updatedAt }
          : { id: `${id}-e2`, orderId: id, type: 'status_changed', fromStatus: 'new', toStatus: 'completed', message: 'Статус: Новый → Выполнен', createdAt: updatedAt },
      )
    }
  }

  return { orders, orderEvents }
}
