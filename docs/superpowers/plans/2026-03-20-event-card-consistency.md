# Event Card Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make event cards consistent across `home.html` and `openbar.html` — add slot availability to home cards, add "Open Bar" type labels to openbar pre-login cards, and rename all user-facing "Curated" copy to "Home Bar".

**Architecture:** Extract `renderSlotMeter` from `openbar.html`'s inline script to `js/events.js` as a shared export. Update `home.html` to fetch slot counts and render the pip meter. Update `openbar.html` to import the shared function and add type badges to pre-login cards. Rename all "Curated" user-facing strings to "Home Bar" across `openbar.html` and `admin/js/admin-main.js`.

**Tech Stack:** Vanilla JS ES modules, Supabase JS client, no build toolchain, no test framework. Verification is manual browser testing.

---

### Task 1: Extract `renderSlotMeter` to `js/events.js`

The function currently lives as a non-exported inline function inside `openbar.html`'s `<script type="module">` block. Moving it to `events.js` makes it importable by both pages. The `t()` i18n calls inside it are dropped and replaced with hardcoded English strings — this is fine because language switching already triggers a full page reload.

**Files:**
- Modify: `js/events.js`

- [ ] **Step 1: Add `renderSlotMeter` export to `js/events.js`**

Open `js/events.js`. After the `formatTimeRange` export (around line 20), add:

```js
// Returns an HTML string: pip meter + "N seats left" / "Full" label.
// t() is intentionally absent — this module has no i18n dependency.
// English-only output is acceptable because language switching triggers a full page reload.
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

- [ ] **Step 2: Commit**

```bash
git add js/events.js
git commit -m "feat: export renderSlotMeter from events.js"
```

---

### Task 2: Update `openbar.html` to import `renderSlotMeter` from `events.js`

`openbar.html` currently defines `renderSlotMeter` locally and has five call sites for it. After this task the local definition is deleted and the import is updated. The five call sites (`~895`, `~899`, `~1062`, `~1072`, `~1081`) are function calls with no changes needed — they work identically with the imported version.

**Files:**
- Modify: `openbar.html`

- [ ] **Step 1: Update the `events.js` import on line 811**

Find the current line (around 811):
```js
import { loadEvents, formatTimeRange } from './js/events.js'
```

Replace with:
```js
import { loadEvents, formatTimeRange, renderSlotMeter } from './js/events.js'
```

- [ ] **Step 2: Delete the local `renderSlotMeter` definition**

Find and delete this block (around lines 826–835):
```js
    function renderSlotMeter(used, capacity) {
      const pips = Array.from({ length: capacity }, (_, i) =>
        `<span class="slot-pip${i < used ? ' filled' : ''}"></span>`
      ).join('')
      const available = capacity - used
      const label = available > 0
        ? `<span class="slot-label">${available} ${t('位', 'seats left')}</span>`
        : `<span class="slot-label" style="color:var(--muted)">${t('已满', 'Full')}</span>`
      return `<span class="slot-meter">${pips}${label}</span>`
    }
```

- [ ] **Step 3: Verify in browser**

Open `openbar.html` in a browser (with an upcoming event that has slot data). Confirm:
- Pre-login view shows the slot pip meter as before
- Dashboard view (after login) shows slot meters in event rows as before
- No JS console errors

- [ ] **Step 4: Commit**

```bash
git add openbar.html
git commit -m "refactor: import renderSlotMeter from events.js, remove local copy"
```

---

### Task 3: Add "Open Bar" type badge to `openbar.html` pre-login cards

Currently, non-curated pre-login event cards show only the slot meter with no type label. After this task they will show `Open Bar` badge + slot meter (+ waitlist badge when full).

**Files:**
- Modify: `openbar.html`

- [ ] **Step 1: Update the non-curated full branch (line ~895)**

Find the full branch assignment (inside `renderPreloginEvents`, around line 895):
```js
          slotHtml = renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
          if (waitCount) slotHtml += ` <span class="badge" style="margin-left:0.3rem">${waitCount} ${t('人等候', 'on waitlist')}</span>`
```

Replace **only** the first line of that pair:
```js
          slotHtml = `<span class="badge">Open Bar</span> ` + renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
          if (waitCount) slotHtml += ` <span class="badge" style="margin-left:0.3rem">${waitCount} ${t('人等候', 'on waitlist')}</span>`
```

- [ ] **Step 2: Update the non-curated available branch (line ~899)**

Find the available branch assignment (a few lines below, around line 899):
```js
          slotHtml = renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
```

Replace with:
```js
          slotHtml = `<span class="badge">Open Bar</span> ` + renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
```

- [ ] **Step 3: Verify in browser**

Open `openbar.html` without logging in. Confirm:
- Non-curated upcoming events show an "Open Bar" badge followed by the pip meter
- Full events show "Open Bar" badge + pip meter + waitlist count
- Curated (Home Bar) events are unchanged (still show the purple curated badge only)
- No JS console errors

- [ ] **Step 4: Commit**

```bash
git add openbar.html
git commit -m "feat: add Open Bar type badge to pre-login event cards"
```

---

### Task 4: Rename "Curated" → "Home Bar" everywhere user-facing

Six string changes across two files. `isCurated` variable names and `event_type === 'curated'` checks are **not** changed — only display strings.

**Files:**
- Modify: `openbar.html`
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Update `openbar.html` line ~892 — pre-login curated badge (both zh and en)**

Find:
```js
          slotHtml = `<span class="badge badge-curated">${t('策划活动 · 邀请制', 'Curated · By Invitation')}</span>`
```

Replace:
```js
          slotHtml = `<span class="badge badge-curated">${t('家庭酒吧 · 邀请制', 'Home Bar · By Invitation')}</span>`
```

- [ ] **Step 2: Update `openbar.html` line ~1042 — dashboard event row badge (both zh and en)**

Find (inside `buildEventRowHtml`):
```js
        ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('策划', 'Curated')}</span>`
```

Replace:
```js
        ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('家庭酒吧', 'Home Bar')}</span>`
```

- [ ] **Step 3: Update `openbar.html` lines ~1257 and ~1306 — zh arg only**

These two lines are in `renderCancelledReservations` (~1257) and `renderInvitations` (~1306). Both currently read:
```js
          ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('策划', 'Home Bar')}</span>`
```

For **both** lines, update the zh arg only (en is already correct):
```js
          ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('家庭酒吧', 'Home Bar')}</span>`
```

- [ ] **Step 4: Update `openbar.html` line ~1369 — history card badge (raw string, no `t()`)**

Find (inside `renderHistory`, around line 1369):
```js
          ? ` <span class="badge badge-curated" style="font-size:0.42rem;vertical-align:middle">Curated</span>`
```

Replace:
```js
          ? ` <span class="badge badge-curated" style="font-size:0.42rem;vertical-align:middle">Home Bar</span>`
```

- [ ] **Step 5: Update `admin/js/admin-main.js` line ~527 — event type badge (raw string)**

Find (around line 527):
```js
? `<span class="badge" style="border-color:rgba(184,156,216,0.3);color:#B89CD8;font-size:0.7rem">Curated</span>`
```

Replace:
```js
? `<span class="badge" style="border-color:rgba(184,156,216,0.3);color:#B89CD8;font-size:0.7rem">Home Bar</span>`
```

- [ ] **Step 6: Verify in browser**

In `openbar.html`:
- Pre-login: curated events show "Home Bar · By Invitation" badge (purple)
- Dashboard (logged in): curated event rows show "Home Bar" badge in the title line
- Cancelled events section: curated events show "Home Bar" badge
- Invitations section: curated events show "Home Bar" badge
- History section: curated events show "Home Bar" badge

In admin panel (`admin/index.html`):
- Event detail view for a curated event shows "Home Bar" badge

Confirm no "Curated" text appears anywhere in either UI. No JS console errors.

- [ ] **Step 7: Commit**

```bash
git add openbar.html admin/js/admin-main.js
git commit -m "fix: rename Curated → Home Bar in all user-facing strings"
```

---

### Task 5: Add slot meter to `home.html` event cards

The home page event cards currently show date + title + a type badge. After this task they will also show a meta row: pip meter for open events, "Home Bar · By Invitation" text for curated events. Requires adding a direct Supabase import (the page previously only called Supabase indirectly via `loadEvents()`).

**Files:**
- Modify: `home.html`

- [ ] **Step 1: Add imports**

Find the existing `<script type="module">` import block:
```js
    import { requirePasscode } from './js/auth.js'
    import { renderNav, renderFooter, initLang } from './js/nav.js'
    import { loadEvents, formatTimeRange } from './js/events.js'
```

Replace with:
```js
    import { requirePasscode } from './js/auth.js'
    import { renderNav, renderFooter, initLang } from './js/nav.js'
    import { loadEvents, formatTimeRange, renderSlotMeter } from './js/events.js'
    import { supabase } from './js/supabase-client.js'
```

- [ ] **Step 2: Add CSS to the inline `<style>` block**

Inside the existing `<style>` block (before `</style>`), append:

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
      width: 9px;
      height: 9px;
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

- [ ] **Step 3: Update `renderHomeEvents` to fetch slot data and render the meta row**

Find the current `renderHomeEvents` function body. It calls `await loadEvents()` and builds cards in a `forEach`. Replace the function with:

```js
    async function renderHomeEvents() {
      const today = new Date().toISOString().split('T')[0]

      const [allEvents, slotRes] = await Promise.all([
        loadEvents(),
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed').eq('admin_added', false)
      ])

      const slotsByEvent = {}
      ;(slotRes.data || []).forEach(r => {
        slotsByEvent[r.event_id] = (slotsByEvent[r.event_id] || 0) + r.guest_count
      })

      const upcoming = allEvents.filter(e => e.event_date >= today)

      const section = document.getElementById('home-events-section')
      const list = document.getElementById('home-events-list')

      if (!upcoming.length) return // section stays hidden

      list.innerHTML = ''
      upcoming.forEach(ev => {
        const isCurated = ev.event_type === 'curated'
        const isOpenBar = ev.event_type === 'open'
        const timeRange = formatTimeRange(ev.start_time, ev.end_time)
        const dateStr = escapeHtml(formatHomeEventDate(ev.event_date)) + (timeRange ? ' · ' + timeRange : '')
        const badgeText = isCurated ? 'Home Bar' : 'Open Bar'

        let metaHtml = ''
        if (isCurated) {
          metaHtml = `<div class="home-event-card-meta home-event-card-meta--invited">Home Bar · By Invitation</div>`
        } else {
          const used = slotsByEvent[ev.id] || 0
          const capacity = ev.capacity - (ev.admin_reserved || 0)
          metaHtml = `<div class="home-event-card-meta">${renderSlotMeter(used, capacity)}</div>`
        }

        const card = document.createElement(isOpenBar ? 'a' : 'div')
        card.className = 'home-event-card'
        if (isOpenBar) card.href = '/openbar.html'
        card.innerHTML = `
          <div>
            <div class="home-event-card-date">${dateStr}</div>
            <div class="home-event-card-title">${escapeHtml(ev.title)}</div>
            ${metaHtml}
          </div>
          <span class="home-event-card-badge">${badgeText}</span>
        `
        list.appendChild(card)
      })

      section.style.display = 'block'
    }
```

- [ ] **Step 4: Verify in browser**

Open `home.html`. Confirm:
- Open Bar upcoming events show a pip meter below the title (filled pips = confirmed guests, label shows seats remaining or "Full")
- Home Bar (curated) upcoming events show "Home Bar · By Invitation" text below the title — no pip meter
- The right-side badge shows "Home Bar" or "Open Bar" as before
- Open Bar cards are still clickable links to `/openbar.html`
- Home Bar cards are non-clickable divs
- If the slot query fails (test by temporarily breaking the query), cards render without a meter — no blank page or JS error
- No JS console errors

- [ ] **Step 5: Commit**

```bash
git add home.html
git commit -m "feat: show slot availability on home page event cards"
```
