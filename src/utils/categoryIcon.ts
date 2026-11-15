/** Иконки Material Symbols для категорий из демо-набора, по slug. */
const CATEGORY_ICONS: Record<string, string> = {
  smartfony: 'smartphone',
  noutbuki: 'laptop_mac',
  naushniki: 'headphones',
  'smart-chasy': 'watch',
  'feny-i-staylery': 'air',
  pylesosy: 'vacuum',
  aksessuary: 'cable',
}

/** Имя иконки для категории; для незнакомых (созданных админом) — общая иконка. */
export function getCategoryIcon(slug: string): string {
  return CATEGORY_ICONS[slug] ?? 'category'
}
