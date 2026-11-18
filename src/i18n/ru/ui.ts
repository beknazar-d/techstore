export const ui = {
  photosLimit: (max: number) => `Можно добавить не больше ${max} фото`,
  photoFailed: 'Не удалось обработать фото',
  photoAlt: (index: number) => `Фото ${index}`,
  photoMain: 'Главное',
  photoRemove: (index: number) => `Удалить фото ${index}`,
  photoLeft: (index: number) => `Переместить фото ${index} влево`,
  photoRight: (index: number) => `Переместить фото ${index} вправо`,
  compressing: 'Сжимаем…',
  add: 'Добавить',
  themeLight: 'Включить светлую тему',
  themeDark: 'Включить тёмную тему',
  imageReadFailed: 'Не удалось прочитать изображение',
  imageUnsupported: 'Браузер не поддерживает обработку изображений',
  imageOnly: 'Можно загружать только изображения',
}

export type UiMessages = typeof ui
