import type { AdminLayoutMessages } from '../ru/adminLayout'

export const adminLayout: AdminLayoutMessages = {
  nav: {
    orders: 'Заказдар',
    tradeIns: 'Trade-in',
    chats: 'Чаттар',
    products: 'Товарлар',
    categories: 'Категориялар',
    stats: 'Статистика',
    banners: 'Акциялар',
    settings: 'Жөндөөлөр',
  },
  caption: 'Админка',
  logout: 'Чыгуу',
  navAria: 'Админканын бөлүмдөрү',
  toSite: 'Сайтка',
  loginEmpty: 'Email жана сырсөздү жазыңыз',
  loginCaption: 'Кызматкерлер үчүн кирүү',
  password: 'Сырсөз',
  login: 'Кирүү',
  backToSite: '← Сайтка',
  back: 'Артка',
  noEvents: 'Азырынча окуялар жок',
  notifyChannel: 'Заявкалар жана билдирүүлөр',
  notifyOrderTitle: (number: number) => `Жаңы заказ №${number}`,
  notifyOrderBody: (product: string, quantity: number, total: string, name: string) =>
    `${product} × ${quantity} — ${total}. ${name}`,
  notifyTradeInTitle: (number: number) => `Trade-in арызы №${number}`,
  notifyTradeInBody: (device: string, name: string) => `${device}. ${name}`,
  notifyHandoffTitle: 'Кардар менеджерди күтүп жатат',
  notifyHandoffBody: (name: string, reason: string) => [name || 'Telegram кардары', reason].filter(Boolean).join(': '),
  notifyMessageTitle: (name: string) => `Билдирүү: ${name || 'кардар'}`,
}
