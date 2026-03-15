# 二十五 — Wabi-Sabi Linen Redesign
**Date:** 2026-03-14
**Branch:** feature/wabi-linen-redesign

## Context

二十五 (ershu25.com) is a private homebar gathering site. The space features warm wood structures and ambient warm lighting at night. The current art deco speakeasy theme (dark navy + gold) no longer matches the physical environment. The redesign should evoke the feeling of the space itself: aged linen, warm candlelight through wood, handmade and intimate.

## Design Direction

**Theme:** Wabi-Sabi Zen · Mulberry Linen
**Mode:** Light (warm off-white backgrounds throughout)
**Exception:** Admin panel (`/admin`) uses a **dark wabi-linen variant** — same typography, texture, and design language, but with deep wood-brown backgrounds and warm linen text instead of the light inversion. It does NOT retain the old art deco theme.

## Color System

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F0E8DC` | Page background (aged linen) |
| `--surface` | `#E8DCCB` | Card and nav backgrounds |
| `--surface-2` | `#DDD0BA` | Footer, deeper surfaces |
| `--border` | `rgba(130,95,60,0.18)` | All borders |
| `--accent` | `#C49A5C` | Amber highlight accent |
| `--accent-dim` | `rgba(196,154,92,0.25)` | Subtle accent fills, badge backgrounds |
| `--wood` | `#B8895A` | Mid wood tone, eyebrows, `.btn` border/text |
| `--wood-dark` | `#6B4A28` | Brand, nav brand, `.btn-solid` background |
| `--ink` | `#2E1D0E` | h1–h3, high-contrast text |
| `--text` | `#4A3320` | Body text |
| `--muted` | `#8B6B4A` | Secondary text, placeholders, nav links default |
| `--red` | `#A84040` | `.error` text, `.btn-danger` border/text/hover-bg |
| `--sage` | `#5A7A55` | `.success` text, `.btn-approve` border/text/hover-bg |

## Typography

| Role | Font stack | Style |
|---|---|---|
| Headings (h1–h3) | `'Lora', 'Noto Serif SC', Georgia, serif` | weight 400, warm serif |
| Body | `'Cormorant Garamond', 'Noto Serif SC', Georgia, serif` | italic body text |
| Labels / Nav / Eyebrows | `'Josefin Sans', 'Noto Sans SC', sans-serif` | weight 300–400, tight tracking, uppercase |

Fallbacks ensure CJK characters render via Noto Serif SC / Noto Sans SC when Google Fonts is unavailable. Georgia and sans-serif cover the worst-case Latin fallback.

Josefin Sans replaces Cinzel — same elegant spacing but softer, matching the wabi-sabi feel.

## Texture & Atmosphere

- **Paper grain overlay** on `body::before` via SVG fractalNoise, opacity exactly `0.055`
- **Hero ambient gradient**: `linear-gradient(to bottom, rgba(196,154,92,0.07), transparent)` applied to `.hero::before` pseudo-element, 180px height. Applies to `.hero` on `home.html` and the login `.gate` on `index.html`.
- **Card top accent strip**: `::before` pseudo-element, height 2px, `linear-gradient(to right, var(--accent-dim), transparent 70%)`, border-radius top corners only
- **Ornamental rule**: `.rule` inner character changes from `◆ ◇ ◆` to `一`. Appears only in HTML files, not in JS.
- **Nav bottom edge**: `border-bottom: 1px solid var(--border)` + `::after` pseudo `linear-gradient(to right, transparent, rgba(196,154,92,0.3), transparent)` 2px line

## Component Changes

### Navigation
- Background: `--surface`, `backdrop-filter: blur(8px)`
- Brand: `--wood-dark`, Josefin Sans, letter-spacing 0.32em
- Links: `--muted` default → `--ink` hover/active, `border-bottom: 1px solid var(--accent)` on active

### Cards
- Background: `--surface`
- Top accent strip: see Texture section
- Border: `--border`
- Hover: `box-shadow: 0 6px 24px rgba(139,95,60,0.12)`

### Buttons
- `.btn`: border `--wood`, text `--wood-dark`, Josefin Sans; hover → background `--wood-dark`, text `--bg`
- `.btn-solid`: background `--wood-dark`, text `--bg`; hover → background `--wood`, border `--wood`
- `.btn-sm`: padding reduced, same color system
- `.btn-danger`: border/text `--red`; hover → background `--red`, text `#fff`
- `.btn-approve`: border/text `--sage`; hover → background `--sage`, text `--bg`
- `.btn:disabled`: opacity 0.4, pointer-events none

### Inputs (`input`, `textarea`, `select`)
- Background: `rgba(255,255,255,0.5)`
- Border: `--border`
- Text: `--text`; placeholder: `--muted` italic
- Focus: background `rgba(196,154,92,0.06)`, border-color `var(--accent)`, outline `2px solid rgba(196,154,92,0.15)`

### Badges
- Background: `--accent-dim`
- Border: `rgba(196,154,92,0.3)`
- Text: `--wood-dark`, Josefin Sans

### Status text (openbar orders)
- `.status-pending`: `--accent` (amber), italic
- `.status-approved`: `--sage`, italic
- `.status-rejected`: `--red`, italic

## Scope

### Files Modified
- `css/style.css` — full token and component rewrite
- `admin/index.html` — add `<link rel="stylesheet" href="style.css">` (keep existing `../css/style.css` import, append admin override after it)
- `admin/style.css` — **created new**: re-declares dark `:root` variables to override the light theme
- `index.html` — ornament update (`◆ ◇ ◆` → `一`)
- `home.html` — hero gradient pseudo-element, stat styles
- `menu.html` — scan for any hardcoded color or Cinzel references; update if found
- `openbar.html` — scan for any hardcoded color or Cinzel references; update if found
- `gallery.html` — scan for any hardcoded color or Cinzel references; update if found
- `community.html` — scan for any hardcoded color or Cinzel references; update if found

### Files NOT Modified
- `admin/js/` — no logic changes
- `js/` — no logic changes

## Admin Dark Wabi-Linen Variant

The admin panel shares the same fonts, texture, and component shapes as the public site, but uses an inverted dark token set:

**Chosen palette: Dusk Slate** — cool blue-black base with warm amber accents. City-at-night feel, avoids brownish tones.

| Token | Dark Admin Value | Description |
|---|---|---|
| `--bg` | `#10121A` | Deep blue-black |
| `--surface` | `#171A24` | Slightly lighter surface |
| `--surface-2` | `#1D2030` | Footer / deeper layer |
| `--border` | `rgba(196,154,92,0.13)` | Warm amber border |
| `--accent` | `#C49A5C` | Same amber accent |
| `--accent-dim` | `rgba(196,154,92,0.15)` | Dimmer on dark |
| `--wood` | `#C49A5C` | Amber mid-tone |
| `--wood-dark` | `#DDB870` | Light amber for solid buttons / brand |
| `--ink` | `#F0EBE1` | Warm white for headings |
| `--text` | `#BEB8AC` | Warm linen body text |
| `--muted` | `#5E5E6E` | Cool-muted secondary text |
| `--red` | `#C06060` | Softened red |
| `--sage` | `#6A9E78` | Softened sage |

Implementation: `admin/index.html` keeps its `../css/style.css` import. A new `admin/style.css` overrides only the `:root` tokens above, linked **after** the main stylesheet so cascade order gives it priority. All component CSS (nav, cards, buttons, inputs) inherits unchanged from the main stylesheet.

## Implementation Order

1. Rewrite `css/style.css` with new token system and all component styles
2. Create `admin/style.css` with dark `:root` variable overrides
3. Update `admin/index.html` to import `admin/style.css` after the main stylesheet
4. Scan and update ornamental `◆ ◇ ◆` → `一` in all in-scope HTML files
5. Scan `home.html`, `menu.html`, `openbar.html`, `gallery.html`, `community.html` for hardcoded dark colors or Cinzel font references; patch any found
6. Visual verification across all pages: check default, hover, focus, and error/success states at 375px (mobile) and 960px+ (desktop) viewport widths in a Chromium browser

## Acceptance Criteria

- All public pages (index, home, menu, openbar, gallery, community) render with the linen light theme
- Admin panel renders with the original dark art deco theme unchanged
- No JS files are modified
- Buttons, form inputs, badges, tabs, and status labels all use the new token system
- Hover, focus, and error/success states are visually distinguishable
- Chinese characters render correctly on all pages
