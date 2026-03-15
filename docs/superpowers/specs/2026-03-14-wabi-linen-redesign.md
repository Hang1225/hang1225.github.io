# 二十五 — Wabi-Sabi Linen Redesign
**Date:** 2026-03-14
**Branch:** feature/wabi-linen-redesign

## Context

二十五 (ershu25.com) is a private homebar gathering site. The space features warm wood structures and ambient warm lighting at night. The current art deco speakeasy theme (dark navy + gold) no longer matches the physical environment. The redesign should evoke the feeling of the space itself: aged linen, warm candlelight through wood, handmade and intimate.

## Design Direction

**Theme:** Wabi-Sabi Zen · Mulberry Linen
**Mode:** Light (warm off-white backgrounds throughout)
**Exception:** Admin panel (`/admin`) retains the existing dark art deco theme

## Color System

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F0E8DC` | Page background (aged linen) |
| `--surface` | `#E8DCCB` | Card and nav backgrounds |
| `--surface-2` | `#DDD0BA` | Footer, deeper surfaces |
| `--border` | `rgba(130,95,60,0.18)` | All borders |
| `--accent` | `#C49A5C` | Amber highlight accent |
| `--accent-dim` | `rgba(196,154,92,0.25)` | Subtle accent fills |
| `--wood` | `#B8895A` | Mid wood tone, eyebrows |
| `--wood-dark` | `#6B4A28` | Brand, nav brand, solid buttons |
| `--ink` | `#2E1D0E` | Headings, high-contrast text |
| `--text` | `#4A3320` | Body text |
| `--muted` | `#8B6B4A` | Muted/secondary text |
| `--red` | `#A84040` | Error/danger |
| `--sage` | `#5A7A55` | Success/approve |

## Typography

| Role | Font | Style |
|---|---|---|
| Headings (h1–h3) | Lora + Noto Serif SC | 400 weight, warm serif |
| Body | Cormorant Garamond + Noto Serif SC | Italic body text |
| Labels / Nav / Eyebrows | Josefin Sans | 300–400, tight tracking, uppercase |

Josefin Sans replaces Cinzel — same elegant spacing but softer and less geometric, matching the wabi-sabi feel.

## Texture & Atmosphere

- **Paper grain overlay** on `body::before` via SVG fractalNoise (opacity ~0.055)
- **Ambient gradient** on hero sections: soft amber wash from top
- **Card accent** top-edge: 2px gradient line in `--accent-dim` instead of gold glow box-shadow
- **Ornamental rule** character changes from `◆ ◇ ◆` to `一` (a single CJK stroke)
- **Nav bottom edge**: faint amber gradient line instead of solid gold border

## Component Changes

### Navigation
- Background: `--surface` (not near-black)
- Brand: `--wood-dark`, Josefin Sans
- Links: `--muted` default, `--ink` + `--accent` underline on active/hover
- Sticky with `backdrop-filter: blur(8px)` over linen

### Cards
- Background: `--surface`
- Top accent strip: 2px linear-gradient in `--accent-dim`
- Border: `--border`
- Hover: subtle shadow with warm tint (`rgba(139,95,60,0.12)`)

### Buttons
- `.btn`: border `--wood`, text `--wood-dark`, Josefin Sans
- `.btn-solid`: background `--wood-dark`, text `--bg`
- Hover: `.btn` fills with `--wood-dark`; `.btn-solid` lightens to `--wood`

### Inputs
- Background: `rgba(255,255,255,0.5)` (semi-transparent on linen)
- Border: `--border`
- Focus: `--accent-dim` background, `--accent` border

### Badges
- Background: `--accent-dim`
- Border: `rgba(196,154,92,0.3)`
- Text: `--wood-dark`

## Scope

### Files Modified
- `css/style.css` — full token and component rewrite
- `index.html` — gate page ornament update (`◆ ◇ ◆` → `一`)
- `home.html` — hero and stat styles updated
- `menu.html` — component class updates if needed
- `openbar.html` — component class updates if needed
- `gallery.html` — component class updates if needed
- `community.html` — component class updates if needed
- `js/nav.js` — no changes expected (purely structural)

### Files NOT Modified
- `admin/index.html` — retains dark art deco theme
- `admin/style.css` — retains dark art deco theme (to be created as admin-specific override)
- All `.js` files — no logic changes

## Admin Isolation Strategy

The admin panel at `/admin/index.html` currently imports `../css/style.css`. To preserve its dark theme while the main stylesheet goes light, add an `admin/style.css` that re-declares the dark `:root` variables, imported after the main stylesheet in `admin/index.html`.

## Implementation Order

1. Rewrite `css/style.css` with new token system and all component styles
2. Create `admin/style.css` with dark variable overrides
3. Update `admin/index.html` to import `admin/style.css`
4. Update ornamental elements in HTML files (`◆ ◇ ◆` → `一`)
5. Verify each page visually
