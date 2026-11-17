/** Иконки Material Symbols для категорий по slug. */
const CATEGORY_ICONS: Record<string, string> = {
  smartfony: 'smartphone',
  noutbuki: 'laptop_mac',
  naushniki: 'headphones',
  'smart-chasy': 'watch',
  'feny-i-staylery': 'air',
  'feny-dyson': 'air',
  chekhly: 'phone_iphone',
  zaryadki: 'battery_charging_full',
  pylesosy: 'vacuum',
  aksessuary: 'cable',
}

/** Имя иконки для категории; для незнакомых (созданных админом) — общая иконка. */
export function getCategoryIcon(slug: string): string {
  return CATEGORY_ICONS[slug] ?? 'category'
}
