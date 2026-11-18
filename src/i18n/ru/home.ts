export const home = {
  badge: 'Новые поступления',
  title: 'Гаджеты и техника для каждого дня',
  lead: 'Смартфоны, ноутбуки, аксессуары и техника для дома — всё в наличии, оплата при получении.',
  toCatalog: 'В каталог',
  tradeIn: 'Обменять старый',
  whyUs: 'Почему у нас',
  features: [
    { icon: 'local_shipping', title: 'Доставка по городу', text: 'Или самовывоз — как удобнее' },
    { icon: 'payments', title: 'Оплата при получении', text: 'Без предоплаты и онлайн-оплаты' },
    { icon: 'verified', title: 'Проверка устройств', text: 'Б/У — с указанием состояния и аккумулятора' },
    { icon: 'swap_horiz', title: 'Trade-in', text: 'Сдайте старое устройство в счёт нового' },
  ],
  categories: 'Категории',
  seeAll: 'Смотреть всё',
  popular: 'Популярные товары',
  allProducts: 'Все товары',
  usedPhones: 'Б/У смартфоны',
  allOffers: 'Все предложения',
  sales: 'Скидки',
  promoAria: 'Акции',
  promoSlide: (index: number, total: number) => `Акция ${index} из ${total}`,
  promoPrev: 'Предыдущая акция',
  promoNext: 'Следующая акция',
}

export type HomeMessages = typeof home
