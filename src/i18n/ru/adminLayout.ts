export const adminLayout = {
  nav: {
    orders: 'Заказы',
    tradeIns: 'Trade-in',
    chats: 'Чаты',
    products: 'Товары',
    categories: 'Категории',
    stats: 'Статистика',
    banners: 'Акции',
    settings: 'Настройки',
  },
  caption: 'Админка',
  logout: 'Выйти',
  navAria: 'Разделы админки',
  toSite: 'На сайт',
  // Вход
  loginEmpty: 'Введите email и пароль',
  loginCaption: 'Вход для сотрудников',
  password: 'Пароль',
  login: 'Войти',
  backToSite: '← На сайт',
  // Общие блоки
  back: 'Назад',
  noEvents: 'Событий пока нет',
  notifyChannel: 'Заявки и сообщения',
  notifyOrderTitle: (number: number) => `Новый заказ №${number}`,
  notifyOrderBody: (product: string, quantity: number, total: string, name: string) =>
    `${product} × ${quantity} — ${total}. ${name}`,
  notifyTradeInTitle: (number: number) => `Заявка trade-in №${number}`,
  notifyTradeInBody: (device: string, name: string) => `${device}. ${name}`,
  notifyHandoffTitle: 'Клиент ждёт менеджера',
  notifyHandoffBody: (name: string, reason: string) => [name || 'Клиент в Telegram', reason].filter(Boolean).join(': '),
  notifyMessageTitle: (name: string) => `Сообщение: ${name || 'клиент'}`,
}

export type AdminLayoutMessages = typeof adminLayout
