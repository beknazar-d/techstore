---
name: Obsidian Precision
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a luxury tech retail experience tailored for flagship electronics and high-spec computing hardware. Rooted in minimalist aesthetics, the visual language merges the sleek industrial refinement of bead-blasted dark titanium with the clarity of high-end consumer device showcases. 

The emotional target is uncompromising prestige, technical mastery, and frictionless decision-making. Surfaces reflect deep spatial layering without visual clutter, emphasizing device silhouettes, crisp typographic hierarchies, and deliberate micro-interactions. Precision edge highlights, balanced glass textures, and surgical accent placements guide discerning customers through device configuration, live availability, and concierge delivery checkout.

## Colors

The palette establishes an ultra-refined dark atmosphere through structured titanium and deep obsidian values:

- **Canvas Base (`#0b0f17`)**: Pitch-dark base surface simulating matte anodized titanium under low studio lighting.
- **Surface Elevation (`#111827`, `#1a2234`, `#1f293d`)**: Three distinct surface tiers providing functional depth. Cards sit on `#111827`, floating panels and modals utilize `#1a2234`, and interactive hover/active states rest on `#1f293d`.
- **Primary Electric Blue (`#3b82f6`)**: Pure luminous energy reserved for primary calls-to-action, active hardware variant selectors, price tags, and focal links.
- **Status Emerald (`#10b981`)**: Dedicated indicator for verified instant warehouse stock, courier delivery speed guarantees, and positive transactional confirmations.
- **Structural Outlines (`#283548`)**: Subtle slate borders defining card silhouettes, split-view dividers, and active form rings with razor-sharp definition.
- **Text Layers**: Highest contrast `#f8fafc` for hero metrics and product designations, balanced `#94a3b8` for technical specs and subtext, and `#475569` for legal and disabled markers.

## Typography

The typography is built entirely on Inter, tuned for high-density retail catalogs and high-impact hero product releases. Negative letter spacing is applied progressively to large headline scales to produce an authoritative, cinematic posture. 

Spec sheets, tabular pricing tables, and SKU codes leverage tabular numeric figures (`tnum`) for exact vertical alignment. Body text sustains airy line heights to ensure long-form tech specifications remain effortlessly scannable in high-contrast dark environments.

## Layout & Spacing

The layout philosophy centers on a responsive 12-column grid constrained to a maximum width of 1440px on desktop, transitioning to an 8-column layout on tablet and a 4-column layout on mobile.

- **Desktop (1024px and above)**: Full 12 columns with 1.5rem gutters and generous 3rem outer margins to allow hardware photography breathing room. Product pages leverage a 7/5 split ratio (7 columns for interactive media carousels and hardware showcases; 5 columns for fixed purchase configuration panes).
- **Tablet (768px – 1023px)**: 8 columns with 1.25rem gutters. Product actions shift to a structured vertical sequence.
- **Mobile (below 768px)**: 4 columns with 1rem gutters and 1.25rem canvas padding. Configuration selectors convert into edge-to-edge horizontally scrolling carousels, anchored by a sticky bottom checkout bar.

## Elevation & Depth

Elevation eschews traditional stark drop shadows in favor of a layered dark glass architecture with soft ambient tints:

- **Level 0 (Canvas)**: `#0b0f17` solid ground plane.
- **Level 1 (Catalog Tiles & Sections)**: Background `#111827` enclosed by a hairline 1px border of `#283548`. Soft ambient shadow: `0 8px 30px rgba(0, 0, 0, 0.45)`.
- **Level 2 (Active Hardware Panels & Drawers)**: Background `#1a2234` with 1px border of `#283548`. Elevated shadow: `0 16px 40px rgba(0, 0, 0, 0.65), 0 0 1px rgba(59, 130, 246, 0.15)`.
- **Level 3 (Modals, Overlays, and Floating Dock Cart)**: Backdrop-filtered surface using `rgba(26, 34, 52, 0.75)` with `20px` blur, bordered by `rgba(40, 53, 72, 0.8)`. Floating shadow: `0 24px 64px rgba(0, 0, 0, 0.85)`.
- **Specular Glows**: Focused buttons and selected specification cards introduce a subtle electric blue rim dispersion (`box-shadow: 0 0 20px rgba(59, 130, 246, 0.25)`).

## Shapes

The geometry reflects hardware product engineering with unified continuous curves. Base UI components, input fields, standard cards, and dropdown containers use 12px to 16px corner radii (`rounded-lg` through `rounded-xl`). Hero display modules, modal viewports, and floating checkout drawers expand to 24px corner radii for an ergonomic, polished silhouette. Minor informational tags, status pills, and circular color variant pickers preserve full pill-shaped geometry.

## Components

### Buttons
- **Primary**: Solid Electric Blue (`#3b82f6`) fill, pure white text (`#ffffff`), `rounded-xl`, with a subtle hover transition to `#2563eb` accompanied by a localized `0 0 16px rgba(59, 130, 246, 0.35)` glow.
- **Secondary / Ghost**: `#1a2234` background with 1px `#283548` border and `#f8fafc` text. On hover, background shifts to `#1f293d` and border brightens to `#3b82f6`.
- **Cart Sticky Action**: Full-width high-gloss floating pill pinned to mobile viewports with embedded quick-pay integration.

### Badges & Chips
- **Availability & Logistics**: `#10b981` at 15% opacity fill, solid `#10b981` text, bordered by `rgba(16, 185, 129, 0.3)`. Accompanied by a pulsing 6px radial dot for same-day courier dispatch in Moscow.
- **Spec / Filter Chips**: Inactive items utilize `#111827` surface with `#94a3b8` text and `#283548` outline. Active items feature an electric blue perimeter (`#3b82f6`), `#f8fafc` text, and a deep blue wash surface (`rgba(59, 130, 246, 0.1)`).

### Cards & Grid Containers
- **Product Tiles**: Crisp `#111827` foundation with 1px `#283548` border. Imagery sits centered on a transparent or `#0b0f17` radial vignette. Hover effects subtly scale device previews by 1.02x while activating a localized outer border gradient toward `#3b82f6`.

### Inputs & Selectors
- **Form Controls**: `#0b0f17` inset fields paired with `#283548` borders. On focus, triggers a smooth border transition to `#3b82f6` with a `0 0 0 3px rgba(59, 130, 246, 0.15)` focus ring.
- **Hardware Variant Radios**: Custom circular nodes featuring genuine device color finishes (Space Black, Natural Titanium, Silver, Deep Navy) wrapped in a 2px offset border when selected.

### Product Configuration Matrix
- Segmented control grids for storage options (256GB, 512GB, 1TB) displaying size and installment pricing side-by-side, highlighted with hairline active strokes.