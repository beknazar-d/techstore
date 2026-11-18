import { msg } from '../i18n'

export type ApiErrorCode =
  | 'validation' // неверно заполнены поля
  | 'not_found'
  | 'out_of_stock' // недостаточно товара на складе
  | 'product_unavailable' // товар снят с продажи
  | 'invalid_transition' // недопустимая смена статуса
  | 'category_not_empty' // в категории есть товары
  | 'conflict' // дубликат (например, slug)
  | 'auth' // нет входа или неверный пароль
  | 'storage' // не удалось сохранить данные

/** Ошибка слоя данных. `message` — готовый русский текст, его можно показывать пользователю. */
export class ApiError extends Error {
  code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** Текст ошибки для показа пользователю. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return msg().errors.generic
}
