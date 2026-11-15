---
name: A7Store Retail System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  price-hero:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  price-card:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.01em
  price-installment:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-ui:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system defines the digital flagship experience for an authorized-grade personal technology retailer operating in Central Asia. The visual identity translates the exacting precision, quiet restraint, and tactile satisfaction of premium consumer hardware into an ultra-functional digital commerce platform.

### Target Audience & Psychological Blueprint
The primary customer base includes tech-savvy urban professionals, digital creators, and discerning hardware buyers seeking verified, premium gear (smartphones, laptops, audio, wearable ecosystems) with authentic local warranty support. The interface must project:
- **Absolute Authenticity & Trust:** Eradicating marketplace clutter, aggressive countdown timers, and visual noise in favor of serene, institutional authority.
- **Atmospheric Clarity:** Emphasizing product geometry through vast white and off-white negative space, allowing industrial design to take center stage.
- **Physical Frictionlessness:** Providing instant clarity on localized stock status ("В наличии"), straightforward regional financing/installments, and fluid dual-language context (Russian / Kyrgyz).

### Aesthetic Classification: High-Precision Functional Minimalism
The visual vocabulary combines Apple-store editorial minimalism with rigorous mobile-first transaction flows. It relies on:
- High-key matte surfaces and razor-sharp photographic cutouts.
- Strict micro-borders replacing heavy drop shadows for separation.
- Hyper-legible Cyrillic typographic balance.
- Purposeful, tactile micro-interactions built for one-handed mobile ergonomic zones.

## Colors

The palette is engineered around high luminance contrast, clinical neutral surfaces, and decisive communicative accents. It strictly avoids visual pollution, reserving saturated hues exclusively for action affordances and critical inventory status.

### System Roles & Palette Structure
- **Canvas & Layering Surfaces:**
  - `Base Canvas`: `#FFFFFF` — Pure clinical white for main screen backgrounds, edge-to-edge product grids, and primary modal sheets.
  - `Surface Container Warm`: `#F8F9FA` — Subtle warm alabaster used for secondary card backplates, spec tables, and segmented controls.
  - `Surface Container Recessed`: `#F1F3F5` — Soft neutral gray for inactive states, input fields, and pill backgrounds.
  - `Surface Border / Divider`: `#E2E8F0` — Deliberate 1px micro-border separating modules without relying on ambient darkening.

- **Primary Action (`#2563EB` — Electric Cobalt):**
  - Reserved exclusively for directional user choices: "Купить" (Buy), "В корзину" (Add to Cart), primary checkout progressions, active pagination tabs, and selected hardware variant rings.
  - Interactive Hover/Press: `#1D4ED8` (Deep Sapphire).

- **Secondary Authority (`#0F172A` & `#1E293B` — Midnight Graphite):**
  - High-order typographic hierarchy, header surfaces, technical badge outlines, and premium navigation icons. 

- **Tertiary Utility (`#10B981` — Emerald Signal):**
  - Used for immediate retail confidence signals: "В наличии в Оше" (In stock in Osh), instant delivery guarantees, and verification checkmarks.
  - Secondary Warning / Installment: `#F59E0B` (Amber) for low inventory thresholds ("Осталось 2 шт.").

- **Content & Neutral Scale:**
  - `Text Primary`: `#0F172A` (Pure legibility across Russian and Kyrgyz text).
  - `Text Secondary`: `#475569` (Technical specifications, memory configurations, accessory notes).
  - `Text Tertiary / Muted`: `#94A3B8` (Form helper labels, inactive tabs, placeholder text).

## Typography

The type structure relies entirely on `Inter` for its neutral, highly engineered geometric geometry, exceptional Cyrillic diacritics, and crystal-clear rendering across standard mobile displays.

### Localized Typography & Formatting Rules
- **Regional Currency Display:** All prices in Kyrgyz Som (`сом`) must follow the non-breaking space rule for thousands, with the currency symbol lowercased: `89 900 сом`. Never truncate the currency sign or replace it with irregular shorthand.
- **Language Switch Ergonomics:** Russian (`РУС`) and Kyrgyz (`КЫР`) language switches render as a compact monospace-inspired pill toggle (`label-ui`), preserving layout height and avoiding shift during bilingual switching.
- **Technical Specifications:** All hardware metrics (RAM, SSD, screen sizes) use numeric tabular figures (`tnum`) in font features to ensure neat column alignment in technical specifications sheets.

## Layout & Spacing

The architecture operates strictly under a 4px/8px incremental spatial scale optimized for mobile shopping ergonomical patterns.

### Grid Foundations
- **Mobile (< 768px):** Single-column presentation feeds or high-density 2-column product grids with a persistent `gutter-mobile` of `12px` (0.75rem) and `margin-mobile` of `16px` (1rem). Thumb-safe reach governs all critical actions.
- **Desktop & Tablet (≥ 768px to 1440px):** Responsive 12-column grid capped at a maximum width of `1280px`, anchored with `margin` of `24px` (1.5rem) and `gutter` of `16px` (1rem).

### Mobile Shopping Zone Strategy
1. **Header Safe Area:** Compact sticky header (56px tall) hosting logo, store location indicator ("Ош"), search modal trigger, and language toggle.
2. **Bottom-Dock Ergonomics (Mobile):** Primary checkout and cart interactions are pinned to a bottom dock utilizing native safe-area insets (`env(safe-area-inset-bottom)`). The sticky bar features a horizontal split: Price & Installment summary on the left, full-width Cobalt CTA button on the right.
3. **Floating Communication Matrix:** Direct links to WhatsApp and Telegram customer care channels remain floating 16px above the sticky bottom tray, ensuring instant local customer support without interrupting the product gallery.

## Elevation & Depth

To avoid visual murkiness and maintain crisp tech-grade precision, depth is established via low-contrast structural micro-borders, clean surface stacking, and ambient soft lighting.

### Elevation Hierarchy
- **Level 0 (Flat Ground):** `#FFFFFF` or `#F8F9FA`. Product showcases and full-bleed tech specs.
- **Level 1 (Product Cards & Content Units):** Background `#FFFFFF` with a 1px border of `#E2E8F0` and zero drop shadow. On mobile swipe or desktop hover, a subtle ambient shadow blooms: `0 4px 20px -2px rgba(15, 23, 42, 0.06)`.
- **Level 2 (Sticky Headers & Navigation Trays):** `#FFFFFF` with `backdrop-filter: blur(16px)` at 92% opacity, anchored by a bottom border in `#E2E8F0`.
- **Level 3 (Modals, Filter Drawers, & Bottom Sheets):** Elevated floating sheets with a soft, diffused shadow: `0 12px 36px -4px rgba(15, 23, 42, 0.12)`, topped with a smooth 1px white border highlight.

## Shapes

The form language mirrors contemporary hardware design: refined, rounded corners that feel comfortable to the hand while maintaining precision.

### Geometric Rules
- **Base Geometry (`roundedness: 2`):** Primary components (interactive buttons, input fields, badges) use a baseline radius of `8px` (`0.5rem`).
- **Product Cards & Modal Containers:** Apply `rounded-lg` (`16px` / `1rem`), providing a refined framing effect around rectangular smartphone displays and hardware imagery.
- **Floating Bottom Trays & Sheets:** Upper corners use `rounded-xl` (`24px` / `1.5rem`) to create an approachable container for checkout steps.
- **Status Pills & Color Swatches:** Utilize full circular or pill-shape geometries (`rounded-full` / `9999px`) for badges and variant pickers.

## Components

### Buttons
- **Primary CTA ("Купить", "Оформить заказ"):** Padded container (48px mobile height for thumb comfort). Solid Electric Cobalt (`#2563EB`) fill, text in `#FFFFFF` (`label-ui`, weight 600). Hover/Active transitions to `#1D4ED8`. Active tap compresses by 1.5% (`scale(0.985)`).
- **Secondary / Installment Button ("Купить в рассрочку"):** `#F8F9FA` background with `#E2E8F0` micro-border, `#0F172A` text.
- **Ghost Action:** Transparent background with `#2563EB` text; used exclusively inside cart dropdowns and configuration steps.

### Product Badges & Status Chips
- **"В наличии" (In Stock):** Background `#ECFDF5`, text `#065F46`, left-anchored 6px pulsing dot in `#10B981`. Rounded-full, 24px height.
- **Spec Pill (e.g., "512 GB", "M3 Pro"):** Background `#F1F3F5`, micro-border `#E2E8F0`, text `#1E293B` (`body-sm`). Selected state changes border to `#2563EB` with `#EFF6FF` background.

### Product Card
- **Structure:** Clean white surface, 16px radius, enclosed in a 1px `#E2E8F0` micro-border.
- **Media Aspect:** Square 1:1 ratio with `#F8F9FA` backing and transparent hardware cutout.
- **Price Block:** Large bold typographic price (`price-card`), followed immediately by installment math (`"от 7 490 сом/мес"` in `#64748B`).
- **Action:** Quick-add shopping cart circular icon button (40px × 40px) pinned to bottom right.

### Input Fields & Search
- **Search Bar:** 44px height, `#F1F3F5` fill with placeholder `#94A3B8`. Displays inline quick filters ("iPhone 16", "MacBook Air", "Dyson") on tap.
- **Text Inputs:** `#FFFFFF` fill, 1px `#CBD5E1` border, transitioning to 1.5px `#2563EB` border glow on focus.

### Interactive Language Switcher
- Segmented dual pill container: Height 32px, background `#F1F3F5`, pill-switch with an active white sliding indicator displaying `РУС` and `КЫР` in 11px uppercase weight 600.

### Sticky Bottom Purchase Bar (Mobile Product Page)
- Floating dock directly over the safe area. 
- Left section: Price display (`89 900 сом`) stacked over stock status ("В наличии").
- Right section: High-contrast primary CTA ("В корзину" or "Купить сразу") spanning 60% of horizontal viewport width.