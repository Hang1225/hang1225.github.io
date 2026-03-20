# Event Card Consistency — Design Spec

**Date:** 2026-03-20

## Problem

Event cards in `home.html` and `openbar.html` are inconsistent in two ways:

1. `home.html` cards show a static type badge but no slot availability — guests can't tell if an event is full before navigating elsewhere.
2. `openbar.html` pre-login cards for non-curated events show a slot meter but no type label — guests see availability but have no way to know this is an "Open Bar" event.
3. The term "Curated" is used as user-facing copy in some places (`openbar.html`, `admin/js/admin-main.js`) despite the canonical display names being "Home Bar" and "Open Bar" (already used in the admin dropdown and `home.html`).

## Solution

### 1. Extract `renderSlotMeter` to `js/events.js`

Move `renderSlotMeter(used, capacity)` from `openbar.html`'s inline script to `js/events.js` as a named export. The `t()` calls are dropped (English strings hardcoded) because `t()` is not available in `events.js`. This is acceptable because language switching triggers a full page reload, so rendered output is always in the correct language.

```js
// js/events.js — add this export
export function renderSlotMeter(used, capacity) {
  const pips = Array.from({ length: capacity }, (_, i) =>
    `<span class="slot-pip${i < used ? ' filled' : ''}"></span>`
  ).join('')
  const available = capacity - used
  const label = available > 0
    ? `<span class="slot-label">${available} seats left</span>`
    : `<span class="slot-label" style="color:var(--muted)">Full</span>`
  return `<span class="slot-meter">${pips}${label}</span>`
}
```

`openbar.html` removes its local `renderSlotMeter` definition and imports from `events.js` instead. There are five existing call sites in `openbar.html` (pre-login: lines ~895, ~899; dashboard `buildEventRowHtml`: lines ~1062, ~1072, ~1081) — all are function call expressions that work identically after extraction and require no changes beyond the import.

### 2. `home.html` — add slot meter to event cards

**Data:** Run both queries concurrently via `Promise.all`:
```js
const [allEvents, slotRes] = await Promise.all([
  loadEvents(),
  supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed').eq('admin_added', false)
])
const slotsByEvent = {}
;(slotRes.data || []).forEach(r => {
  slotsByEvent[r.event_id] = (slotsByEvent[r.event_id] || 0) + r.guest_count
})
```
If the slot query errors, `slotRes.data` is null and `(slotRes.data || [])` produces an empty array — cards render without a meter rather than failing entirely.

**Card rendering** — below the title line, add a meta row:
- Non-curated events: `<div class="home-event-card-meta">${renderSlotMeter(used, capacity)}</div>`
  - `used = slotsByEvent[ev.id] || 0`
  - `capacity = ev.capacity - (ev.admin_reserved || 0)`
- Curated events: `<div class="home-event-card-meta home-event-card-meta--invited">Home Bar · By Invitation</div>` (no slot meter — capacity is not meaningful for invitation-only events)

The existing right-side type badge (`home-event-card-badge`) is unchanged.

**CSS additions** (added to `home.html`'s inline `<style>` block — consistent with this project's pattern of page-scoped styles; no changes to `css/style.css` or `openbar.html`'s existing copy; the `.slot-*` rules are intentionally duplicated across the two pages rather than promoted to a shared stylesheet):
```css
.home-event-card-meta {
  margin-top: 0.3rem;
}
.home-event-card-meta--invited {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.slot-meter { display: flex; gap: 3px; align-items: center; }
.slot-pip {
  width: 9px; height: 9px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
}
.slot-pip.filled { background: var(--gold); border-color: var(--gold); }
.slot-label {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-left: 0.3rem;
}
```

### 3. `openbar.html` pre-login cards — add type badge

In `renderPreloginEvents()`, the `slotHtml` variable is set via an `if (isCurated) / else` branch. The change:

- **Curated branch:** `slotHtml` already renders the curated badge; after the Section 4 rename it will read "Home Bar · By Invitation". No structural change needed — the curated badge intentionally uses `badge-curated` styling, while the Open Bar label below uses the plain `.badge` class. This asymmetry is deliberate: the two event types have different visual weight in the pre-login view.
- **Non-curated branch (available, line ~899):** Replace the assignment:
  ```js
  slotHtml = `<span class="badge">Open Bar</span> ` + renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
  ```
- **Non-curated branch (full, lines ~895–896):** Replace line ~895 identically:
  ```js
  slotHtml = `<span class="badge">Open Bar</span> ` + renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
  ```
  Leave line ~896 (`slotHtml += waitlist badge`) unchanged — it continues to append after the Open Bar badge + slot meter, producing: `Open Bar badge + slot meter + waitlist badge`.

Both badges sit inside the `.event-meta` div via `${slotHtml}`.

### 4. Rename "Curated" → "Home Bar" everywhere user-facing

Both zh and en args of `t()` calls are updated. Chinese for "Home Bar": `家庭酒吧`. "Open Bar" is unchanged in both languages (already "Open Bar" in nav.js).

| File | Line | Type | zh before → after | en before → after |
|------|------|------|-------------------|-------------------|
| `openbar.html` | ~892 | `t()` | `'策划活动 · 邀请制'` → `'家庭酒吧 · 邀请制'` | `'Curated · By Invitation'` → `'Home Bar · By Invitation'` |
| `openbar.html` | ~1042 | `t()` | `'策划'` → `'家庭酒吧'` | `'Curated'` → `'Home Bar'` |
| `openbar.html` | ~1257 | `t()` zh arg only | `'策划'` → `'家庭酒吧'` | `'Home Bar'` — already correct, do not change |
| `openbar.html` | ~1306 | `t()` zh arg only | `'策划'` → `'家庭酒吧'` | `'Home Bar'` — already correct, do not change |
| `openbar.html` | ~1369 | raw string (no `t()`) | n/a | `Curated` → `Home Bar` |
| `admin/js/admin-main.js` | ~527 | raw string (no `t()`) | n/a | `Curated` → `Home Bar` |

The `isCurated` variable name and `event_type === 'curated'` checks are internal and remain unchanged.

## Scope

- `js/events.js` — add `renderSlotMeter` export
- `home.html` — add `import { supabase } from './js/supabase-client.js'`; import `renderSlotMeter` from `events.js`; add slot query + aggregation; add meta row to cards; add CSS
- `openbar.html` — update import line 811 to `import { loadEvents, formatTimeRange, renderSlotMeter } from './js/events.js'`; remove local `renderSlotMeter` definition; prepend Open Bar badge to non-curated pre-login `slotHtml`; rename Curated → Home Bar in 5 locations (zh + en where applicable)
- `admin/js/admin-main.js` — rename one raw "Curated" string → "Home Bar"

## Trade-offs

- **Pro:** Single source of truth for slot meter rendering
- **Pro:** Consistent terminology across all user-facing surfaces
- **Pro:** Guests on `home.html` can see slot availability before navigating to openbar
- **Con:** `renderSlotMeter` outputs English-only slot labels — acceptable given page-reload language switching
