import type { LabelsMessages } from '../ru/labels'

export const labels: LabelsMessages = {
  orderStatus: { new: 'Жаңы', confirmed: 'Ырасталды', completed: 'Аткарылды', cancelled: 'Жокко чыгарылды' },
  deliveryType: { pickup: 'Өзү алып кетүү', delivery: 'Жеткирүү' },
  orderSource: { site: 'Сайт', telegram: 'Telegram', whatsapp: 'WhatsApp' },
  specFieldType: { text: 'Текст', number: 'Сан', select: 'Тизмеден тандоо', boolean: 'Ооба / Жок' },
  condition: { new: 'Жаңы', used: 'Колдонулган' },
  deviceGrade: { excellent: 'Эң жакшы', good: 'Жакшы', fair: 'Канааттандырарлык' },
  tradeInStatus: {
    new: 'Жаңы',
    evaluated: 'Бааланды',
    accepted: 'Кардар макул',
    rejected: 'Баш тартты',
    completed: 'Аяктады',
  },
  tradeInDeviceCategory: { smartphone: 'Смартфон', laptop: 'Ноутбук', watch: 'Акылдуу саат', other: 'Башка' },
  chatChannel: { telegram: 'Telegram', whatsapp: 'WhatsApp' },
  chatMode: { bot: 'Бот жооп берет', manager: 'Менеджер керек', closed: 'Жабык' },
  chatSender: { customer: 'Кардар', bot: 'Бот', manager: 'Менеджер' },
}
