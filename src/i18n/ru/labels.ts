// Подписи значений из базы: статусы, типы, состояния.
export const labels = {
  orderStatus: { new: 'Новый', confirmed: 'Подтверждён', completed: 'Выполнен', cancelled: 'Отменён' },
  deliveryType: { pickup: 'Самовывоз', delivery: 'Доставка' },
  orderSource: { site: 'Сайт', telegram: 'Telegram', whatsapp: 'WhatsApp' },
  specFieldType: { text: 'Текст', number: 'Число', select: 'Выбор из списка', boolean: 'Да / Нет' },
  condition: { new: 'Новый', used: 'Б/У' },
  deviceGrade: { excellent: 'Отличное', good: 'Хорошее', fair: 'Удовлетворительное' },
  tradeInStatus: {
    new: 'Новая',
    evaluated: 'Оценена',
    accepted: 'Клиент согласен',
    rejected: 'Отказ',
    completed: 'Завершена',
  },
  tradeInDeviceCategory: { smartphone: 'Смартфон', laptop: 'Ноутбук', watch: 'Смарт-часы', other: 'Другое' },
  chatChannel: { telegram: 'Telegram', whatsapp: 'WhatsApp' },
  chatMode: { bot: 'Отвечает бот', manager: 'Нужен менеджер', closed: 'Закрыт' },
  chatSender: { customer: 'Клиент', bot: 'Бот', manager: 'Менеджер' },
}

export type LabelsMessages = typeof labels
