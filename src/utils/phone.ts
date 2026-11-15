// Телефоны. Принимаем любой разумный номер (9–15 цифр), приводим к виду `+XXXXXXXXXXX`.
// Понимаем привычные местные записи: 8 9XX … (Россия), 0 7XX … (Кыргызстан).

function digitsOf(input: string): string {
  return input.replace(/\D/g, '')
}

/** Приводит номер к международному виду `+79001234567`. Пустая строка, если цифр нет. */
export function normalizePhone(input: string): string {
  const hasPlus = input.trim().startsWith('+')
  const digits = digitsOf(input)
  if (!digits) return ''
  if (hasPlus) return `+${digits}`
  // Россия: 8 9XX XXX-XX-XX → +7 9XX …
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  // Кыргызстан: 0 7XX XXX XXX → +996 7XX …
  if (digits.length === 10 && digits.startsWith('0')) return `+996${digits.slice(1)}`
  return `+${digits}`
}

/** Номер похож на настоящий: после нормализации 9–15 цифр. */
export function isValidPhone(input: string): boolean {
  const digits = digitsOf(normalizePhone(input))
  return digits.length >= 9 && digits.length <= 15
}

/** Красивый вид: `+7 900 123-45-67`, `+996 700 123 456`. Остальные — как есть. */
export function formatPhone(input: string): string {
  const phone = normalizePhone(input)
  const d = digitsOf(phone)
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
  }
  if (d.length === 12 && d.startsWith('996')) {
    return `+996 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`
  }
  return phone
}

/** Ссылка для звонка: `tel:+79001234567`. */
export function telHref(input: string): string {
  return `tel:${normalizePhone(input)}`
}
