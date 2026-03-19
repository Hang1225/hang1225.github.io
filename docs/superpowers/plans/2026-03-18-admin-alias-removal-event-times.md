# Admin Enhancements: Alias Edit, Account Removal, Event Times

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alias click-to-edit, soft-delete account removal with confirmation, and start/end time fields to the admin panel, with time display propagated to guest-facing event cards.

**Architecture:** Five self-contained changes touching three files plus one SQL migration. The `formatTimeRange` helper lives in `js/events.js` and is imported by both the admin panel and `openbar.html`. All Supabase writes follow the existing inline pattern (no new modules).

**Tech Stack:** Vanilla JS ES modules, Supabase JS v2, HTML/CSS. No build step. No test framework — verification is manual in the browser.

---

## File Map

| File | Change |
|---|---|
| `docs/migrations/` | New SQL migration file |
| `js/events.js` | Add + export `formatTimeRange()` |
| `js/auth.js` | Add `removed_at` to SELECT; add disabled check |
| `openbar.html` | Handle `{ error: 'disabled' }` at two login call sites; show times on event cards |
| `admin/index.html` | Add modal HTML; add start/end time fields to create form |
| `admin/js/admin-main.js` | All Signups tab changes; all Events tab time changes |

---

## Task 1: DB Migration

**Files:**
- Create: `docs/migrations/004_alias_removal_event_times.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 004: add removed_at to attendees, start_time/end_time to events
-- Run in Supabase SQL editor

alter table attendees
  add column if not exists removed_at timestamptz default null;

alter table events
  add column if not exists start_time time default null,
  add column if not exists end_time   time default null;

-- To revert:
-- alter table attendees drop column if exists removed_at;
-- alter table events drop column if exists start_time, drop column if exists end_time;
```

- [ ] **Step 2: Run in Supabase SQL editor**

Open Supabase dashboard → SQL editor → paste and run. Verify no errors.

- [ ] **Step 3: Verify columns exist**

Run in SQL editor:
```sql
select column_name, data_type
from information_schema.columns
where table_name in ('attendees', 'events')
  and column_name in ('removed_at', 'start_time', 'end_time');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/004_alias_removal_event_times.sql
git commit -m "chore: migration 004 — removed_at, start_time, end_time columns"
```

---

## Task 2: `formatTimeRange` helper in `js/events.js`

**Files:**
- Modify: `js/events.js`

The existing file has only `loadEvents()`. Add the helper below it.

- [ ] **Step 1: Add `formatTimeRange` to `js/events.js`**

Append after `loadEvents()`:

```js
// Converts a Supabase `time` string ("HH:MM:SS") to 12-hour AM/PM display.
// Returns:
//   "7:00 PM – 9:30 PM"  when both start and end are set
//   "7:00 PM"            when only start is set
//   ""                   when start is null/falsy
export function formatTimeRange(start_time, end_time) {
  if (!start_time) return ''
  return end_time
    ? `${fmt12h(start_time)} – ${fmt12h(end_time)}`
    : fmt12h(start_time)
}

function fmt12h(timeStr) {
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr.padStart(2, '0')
  const period = h < 12 ? 'AM' : 'PM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}
```

- [ ] **Step 2: Manual smoke test**

Open browser console on any page that imports `js/events.js`, or create a throwaway `<script type="module">` snippet:
```js
import { formatTimeRange } from './js/events.js'
console.log(formatTimeRange('19:00:00', '21:30:00')) // "7:00 PM – 9:30 PM"
console.log(formatTimeRange('12:00:00', null))        // "12:00 PM"
console.log(formatTimeRange('00:15:00', '01:45:00')) // "12:15 AM – 1:45 AM"
console.log(formatTimeRange(null, null))              // ""
```

- [ ] **Step 3: Commit**

```bash
git add js/events.js
git commit -m "feat: add formatTimeRange helper to events.js"
```

---

## Task 3: Disabled account check in `js/auth.js` and `openbar.html`

**Files:**
- Modify: `js/auth.js` (lines 29–38)
- Modify: `openbar.html` (lines ~801–807 and ~837–838)

- [ ] **Step 1: Update `loginAttendee()` in `js/auth.js`**

Replace the existing `loginAttendee` function (lines 27–38):

```js
export async function loginAttendee(username, pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('attendees')
    .select('id, username, alias, credits, gender, gender_visibility, removed_at')
    .eq('username', username.toLowerCase())
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  if (data.removed_at) return { error: 'disabled' }
  sessionStorage.setItem(ATTENDEE_KEY, JSON.stringify(data))
  return data
}
```

- [ ] **Step 2: Update login handler in `openbar.html` (~line 801)**

Find the sign-in handler block (around line 801). Replace:
```js
      const attendee = await loginAttendee(username, pin)
      if (attendee) { showDashboard(attendee) }
      else {
        const errEl = document.getElementById('login-error')
        errEl.textContent = t('用户名或密码错误', 'Incorrect username or password')
        errEl.style.display = 'block'
      }
```
With:
```js
      const attendee = await loginAttendee(username, pin)
      if (attendee?.error === 'disabled') {
        const errEl = document.getElementById('login-error')
        errEl.textContent = t('账户已被禁用，请联系主人', 'Account disabled. Please contact the host.')
        errEl.style.display = 'block'
      } else if (attendee) {
        showDashboard(attendee)
      } else {
        const errEl = document.getElementById('login-error')
        errEl.textContent = t('用户名或密码错误', 'Incorrect username or password')
        errEl.style.display = 'block'
      }
```

- [ ] **Step 3: Update self-signup login call in `openbar.html` (~line 837)**

Find the self-signup handler's login call (around line 837). Replace:
```js
      const attendee = await loginAttendee(username, pin)
      if (attendee) showDashboard(attendee)
```
With:
```js
      const attendee = await loginAttendee(username, pin)
      if (attendee && !attendee.error) showDashboard(attendee)
```

- [ ] **Step 4: Manual test**

In Supabase SQL editor, temporarily disable a test attendee:
```sql
update attendees set removed_at = now() where username = '<test-user>';
```
Try logging in as that attendee on `openbar.html`. Expected: "Account disabled. Please contact the host." message shown, no dashboard.

Restore after testing:
```sql
update attendees set removed_at = null where username = '<test-user>';
```

- [ ] **Step 5: Commit**

```bash
git add js/auth.js openbar.html
git commit -m "feat: block login for disabled accounts (removed_at check)"
```

---

## Task 4: Signups tab — alias edit, account removal, confirmation modal

**Files:**
- Modify: `admin/index.html` (add modal HTML + CSS)
- Modify: `admin/js/admin-main.js` (loadSignupsAdmin query, row rendering, all event handlers, modal logic)

### Step group A: HTML + CSS scaffolding

- [ ] **Step 1: Add confirmation modal HTML to `admin/index.html`**

Insert before the `<script type="module">` tag at line 286 (i.e., between line 285 `</div>` and line 286 `<script>`):

```html
<!-- Account removal confirmation modal -->
<div id="remove-attendee-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center">
  <div class="card" style="max-width:380px;width:90%;padding:1.5rem">
    <p style="margin-bottom:1rem" id="remove-modal-msg"></p>
    <div style="display:flex;gap:0.75rem;justify-content:flex-end">
      <button class="btn btn-outline btn-sm" id="remove-modal-cancel">Cancel</button>
      <button class="btn btn-danger btn-sm" id="remove-modal-confirm">Remove Account</button>
    </div>
  </div>
</div>
```

Note: The outer `div` has only `display:none` in its inline style (no `display:flex`). The JS sets `style.display = 'flex'` to show it and `style.display = 'none'` to hide it. Do NOT add `display:flex` to the static HTML attribute — it would override `display:none` and the modal would be permanently visible.

- [ ] **Step 2: Add CSS for disabled attendee rows and alias edit to `admin/index.html`**

Append to the `<style>` block (after the `.vis-opt.active` rule, before `</style>`):

```css
    /* Disabled (removed) attendee rows */
    .attendee-row-disabled {
      opacity: 0.45;
    }
    /* Alias click-to-edit */
    .alias-text {
      cursor: pointer;
      border-bottom: 1px dashed var(--border);
    }
    .alias-text:hover {
      border-bottom-color: var(--gold);
      color: var(--gold);
    }
```

### Step group B: JS changes in `admin-main.js`

- [ ] **Step 3: Update `loadSignupsAdmin()` SELECT to include `removed_at`**

At line 256, change:
```js
    .select('id, username, alias, gender, gender_visibility, created_at')
```
To:
```js
    .select('id, username, alias, gender, gender_visibility, created_at, removed_at')
```

- [ ] **Step 4: Update row rendering in `loadSignupsAdmin()` to support disabled rows, click-to-edit alias, and Remove/Restore buttons**

Replace the entire `data.forEach(a => { ... })` block (lines 266–301) with:

```js
  data.forEach(a => {
    const row = document.createElement('div')
    const isDisabled = !!a.removed_at
    row.className = 'item-row' + (isDisabled ? ' attendee-row-disabled' : '')

    const genderVal = a.gender || ''
    const visVal    = a.gender_visibility || 'admin_only'
    const selfLabel = !a.gender
      ? `<span class="muted" style="font-size:0.78rem;font-style:italic"> (prefers not to say)</span>`
      : ''

    // data-alias uses escapeHtml() for HTML attribute safety (e.g. quotes in alias names).
    // dataset.alias in JS automatically un-decodes HTML entities, so input.value receives the literal string.
    const aliasDisplay = isDisabled
      ? `<strong>${escapeHtml(a.alias || a.username)}</strong>`
      : `<strong class="alias-text" data-attendee-id="${a.id}" data-alias="${escapeHtml(a.alias || '')}">${escapeHtml(a.alias || a.username)}</strong>`

    // data-alias in the remove button stores the display name for the modal message
    const actionBtn = isDisabled
      ? `<button class="btn btn-sm btn-outline restore-btn" data-attendee-id="${a.id}">Restore</button>`
      : `<button class="btn btn-sm btn-danger remove-btn" data-attendee-id="${a.id}" data-alias="${escapeHtml(a.alias || a.username)}">Remove Account</button>`

    row.innerHTML = `
      <div>
        ${aliasDisplay}
        <span class="muted"> @${escapeHtml(a.username)}</span>${selfLabel}
        <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
      <div class="gender-controls">
        <select class="gender-select" data-attendee-id="${a.id}"${isDisabled ? ' disabled' : ''}>
          <option value=""${genderVal === '' ? ' selected' : ''}>Prefer not to say</option>
          <option value="male"${genderVal === 'male' ? ' selected' : ''}>Male</option>
          <option value="female"${genderVal === 'female' ? ' selected' : ''}>Female</option>
          <option value="non-binary"${genderVal === 'non-binary' ? ' selected' : ''}>Non-binary</option>
        </select>
        <div class="vis-toggle">
          <button class="vis-opt${visVal === 'admin_only' ? ' active' : ''}" data-attendee-id="${a.id}" data-vis="admin_only"${isDisabled ? ' disabled' : ''}>Admin only</button>
          <button class="vis-opt${visVal === 'public' ? ' active' : ''}" data-attendee-id="${a.id}" data-vis="public"${isDisabled ? ' disabled' : ''}>Visible to all</button>
        </div>
        ${actionBtn}
      </div>
    `
    el.appendChild(row)
  })
```

Key note: `data-alias` on `.alias-text` is stored via `escapeHtml()` for HTML attribute safety. When the click handler reads `span.dataset.alias`, the browser automatically un-decodes HTML entities, so `input.value` receives the literal alias string (e.g., `"` not `&quot;`). The `data-alias` on `.remove-btn` is also entity-encoded and is read via `btn.dataset.alias` as decoded text for the modal message.

- [ ] **Step 5: Add alias click-to-edit handler and Remove/Restore handlers in `loadSignupsAdmin()`**

Insert these handlers before the closing `}` of `loadSignupsAdmin()` (on line 322, after the `.vis-opt` block ends):

```js
  // Alias click-to-edit
  el.querySelectorAll('.alias-text').forEach(span => {
    span.addEventListener('click', () => {
      const id = span.dataset.attendeeId
      const current = span.dataset.alias  // raw alias value, safe to use as input.value
      const input = document.createElement('input')
      input.value = current
      input.style.cssText = 'width:auto;padding:0.1rem 0.3rem;font-size:inherit;font-family:inherit'
      span.replaceWith(input)
      input.focus()

      async function save() {
        const newAlias = input.value.trim() || null
        await supabase.from('attendees').update({ alias: newAlias }).eq('id', id)
        loadSignupsAdmin()
      }
      input.addEventListener('blur', save)
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save() }
        if (e.key === 'Escape') { loadSignupsAdmin() }
      })
    })
  })

  // Remove Account button → open modal
  el.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openRemoveModal(btn.dataset.attendeeId, btn.dataset.alias)
    })
  })

  // Restore button
  el.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('attendees').update({ removed_at: null }).eq('id', btn.dataset.attendeeId)
      loadSignupsAdmin()
    })
  })
```

- [ ] **Step 6: Add modal open/close/confirm logic at the bottom of `admin-main.js`** (after `attachEventBlockHandlers`, before end of file)

```js
// --- ACCOUNT REMOVAL MODAL ---
let _removeTargetId = null

function openRemoveModal(attendeeId, alias) {
  _removeTargetId = attendeeId
  document.getElementById('remove-modal-msg').textContent =
    `Remove ${alias}'s account? They will no longer be able to log in. This cannot be easily undone.`
  document.getElementById('remove-attendee-modal').style.display = 'flex'
}

function closeRemoveModal() {
  document.getElementById('remove-attendee-modal').style.display = 'none'
  _removeTargetId = null
}

document.getElementById('remove-modal-cancel').addEventListener('click', closeRemoveModal)
document.getElementById('remove-modal-confirm').addEventListener('click', async () => {
  if (!_removeTargetId) return
  await supabase.from('attendees').update({ removed_at: new Date().toISOString() }).eq('id', _removeTargetId)
  closeRemoveModal()
  loadSignupsAdmin()
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('remove-attendee-modal').style.display !== 'none') {
    closeRemoveModal()
  }
})
```

- [ ] **Step 7: Manual test — alias edit**

Open admin panel → Signups tab. Click an attendee's alias. Verify input appears pre-filled with the current alias. Type a new alias, press Enter. Verify the list reloads with the new alias. Click alias again, press Escape. Verify nothing changed.

- [ ] **Step 8: Manual test — remove and restore**

Click "Remove Account" on an attendee. Verify modal appears with their name. Click Cancel. Verify nothing changed. Click "Remove Account" again, then Confirm. Verify row reloads grayed out with Restore button and controls disabled. Try logging in as that attendee on `openbar.html` — expected: disabled message. Click Restore in admin. Verify row reloads as active. Try logging in again — expected: success.

- [ ] **Step 9: Manual test — Escape dismisses modal**

Open the modal, press Escape. Verify modal closes without making any change.

- [ ] **Step 10: Commit**

```bash
git add admin/index.html admin/js/admin-main.js
git commit -m "feat: alias click-to-edit and soft-delete account removal in Signups tab"
```

---

## Task 5: Event times — create form and admin event list display

**Files:**
- Modify: `admin/index.html` (add start/end time fields to Create Event form)
- Modify: `admin/js/admin-main.js` (import `formatTimeRange`; read times on submit; render times in event headers)

### Time select helpers

Both the Create Event form and the time rendering share hour/minute logic. Define helpers once in `admin-main.js`.

- [ ] **Step 1: Add `formatTimeRange` import and time-select helpers to `admin-main.js`**

At the top of `admin-main.js`, after the existing imports (line 2), add:

```js
import { formatTimeRange } from '../../js/events.js'
```

Then, after the `escapeHtml` function definition (after line 12), add the helpers. Place these before any other function definitions so they are available everywhere in the module:

```js
// Generates <option> elements for a 12-hour hour select.
// Option values are 24-hour strings ("00"–"23"); labels are "12 AM", "1 AM", … "11 PM"
function hourOptions(selectedVal = '') {
  const labels = [
    '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM',
    '6 AM','7 AM','8 AM','9 AM','10 AM','11 AM',
    '12 PM','1 PM','2 PM','3 PM','4 PM','5 PM',
    '6 PM','7 PM','8 PM','9 PM','10 PM','11 PM'
  ]
  return labels.map((label, i) => {
    const val = String(i).padStart(2, '0')
    return `<option value="${val}"${val === selectedVal ? ' selected' : ''}>${label}</option>`
  }).join('')
}

// Compose "HH:MM:00" from two string values from select elements.
// Returns null if either is empty (the placeholder option has value "").
function composeTime(hour, minute) {
  if (hour === '' || hour == null) return null
  if (minute === '' || minute == null) return null
  return `${hour}:${minute}:00`
}
```

Then add the hour dropdown population block. Place it at module top-level, after the `composeTime` definition (still before `showAdmin`):

```js
// Populate hour dropdowns for Create Event form (runs once on page load)
;['event-start-hour', 'event-end-hour'].forEach(id => {
  const sel = document.getElementById(id)
  if (!sel) return
  const isEnd = id === 'event-end-hour'
  sel.innerHTML = (isEnd ? '<option value="">Flexible</option>' : '<option value="">Hour</option>') + hourOptions()
})
```

- [ ] **Step 2: Add Start Time and End Time fields to the Create Event form in `admin/index.html`**

In `admin/index.html`, the Create Event form has a title/date `form-row` ending at line 173. Insert a new `form-row` immediately after (before the event-type/capacity row at line 175):

```html
        <div class="form-row" style="margin-bottom:0.5rem">
          <div>
            <label>Start Time</label>
            <div style="display:flex;gap:0.4rem">
              <select id="event-start-hour" style="width:auto">
                <option value="">Hour</option>
              </select>
              <select id="event-start-min" style="width:auto">
                <option value="">Min</option>
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
            </div>
          </div>
          <div>
            <label>End Time <span class="muted" style="font-size:0.78rem">(optional)</span></label>
            <div style="display:flex;gap:0.4rem">
              <select id="event-end-hour" style="width:auto">
                <option value="">Flexible</option>
              </select>
              <select id="event-end-min" style="width:auto">
                <option value="">—</option>
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
            </div>
          </div>
        </div>
```

Note: The hour `<select>` elements start with only a placeholder option in HTML. The JS in Step 1 populates the 24 hour options at page load.

- [ ] **Step 3: Update the `create-event-btn` handler to read and submit start/end times**

In `admin-main.js`, find the `create-event-btn` click handler (around line 337). After the existing variable declarations (after `showGender` and `statusEl`), add:

```js
  const startHour  = document.getElementById('event-start-hour').value
  const startMin   = document.getElementById('event-start-min').value
  const endHour    = document.getElementById('event-end-hour').value
  const endMin     = document.getElementById('event-end-min').value
  const start_time = composeTime(startHour, startMin)
  // end_time: only compose if end hour is selected; if hour is empty, store null.
  // If hour is selected but minute is blank, composeTime also returns null (silently no end time).
  const end_time   = endHour ? composeTime(endHour, endMin) : null
```

Update the validation condition to also require a start time:
```js
  if (!title || !date || isNaN(capacity) || capacity < 1 || !start_time) {
    statusEl.textContent = 'Title, date, capacity, and start time are required.'
    statusEl.className = 'error'
    return
  }
```

Update the `supabase.from('events').insert(...)` call to include times:
```js
  const { error } = await supabase.from('events').insert({
    title, event_date: date, capacity, event_type: type,
    show_count: showCount, show_names: showNames, show_gender: showGender,
    status: 'open', start_time, end_time
  })
```

After the success block, reset the time selects:
```js
  document.getElementById('event-start-hour').value = ''
  document.getElementById('event-start-min').value = ''
  document.getElementById('event-end-hour').value = ''
  document.getElementById('event-end-min').value = ''
```

- [ ] **Step 4: Update `buildEventBlockHtml()` to display time in event header**

In `admin-main.js`, in `buildEventBlockHtml(ev)`, find the event date line (line 491):
```js
        <div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.1em;font-family:'Cinzel',serif">${escapeHtml(ev.event_date)}</div>
```
Replace with:
```js
        <div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.1em;font-family:'Cinzel',serif">
          ${escapeHtml(ev.event_date)}${formatTimeRange(ev.start_time, ev.end_time) ? ' · ' + formatTimeRange(ev.start_time, ev.end_time) : ''}
        </div>
```

`formatTimeRange` output contains only alphanumeric characters, spaces, colons, and dashes — no HTML-special characters, so no escaping is needed.

- [ ] **Step 5: Manual test — create event with times**

Open Admin → Events tab. Fill in the form with Start Time = 7 PM / 00, End Time = 9 PM / 30. Submit. Verify the event header shows "· 7:00 PM – 9:30 PM". Create another event with Start Time = 7 PM / 00, End Time left at Flexible. Verify header shows "· 7:00 PM" only. Create another with Start Time = 7 PM / 00 and end hour = 9 PM but end minute left at "—". Verify end time is silently omitted (shows "· 7:00 PM" only — this is expected behavior). Verify old events (no start_time) show no time string.

- [ ] **Step 6: Commit**

```bash
git add admin/index.html admin/js/admin-main.js
git commit -m "feat: add start/end time fields to event creation and display in admin event list"
```

---

## Task 6: Guest-facing event time display (`openbar.html`)

**Files:**
- Modify: `openbar.html` (import `formatTimeRange`; update pre-login and dashboard event rendering)

- [ ] **Step 1: Import `formatTimeRange` in `openbar.html`**

In the inline `<script type="module">` block (around line 354), replace:
```js
    import { loadEvents } from './js/events.js'
```
With:
```js
    import { loadEvents, formatTimeRange } from './js/events.js'
```

- [ ] **Step 2: Add time display to pre-login event cards (`renderPreloginEvents`)**

In `renderPreloginEvents()` (around line 450), find the `event-date` div:
```js
            <div class="event-date">${escapeHtml(formatEventDate(ev.event_date))}</div>
```
Replace with:
```js
            <div class="event-date">${escapeHtml(formatEventDate(ev.event_date))}${formatTimeRange(ev.start_time, ev.end_time) ? ' · ' + formatTimeRange(ev.start_time, ev.end_time) : ''}</div>
```

`formatTimeRange` output does not contain HTML-special characters, so no escaping is needed for the time suffix.

- [ ] **Step 3: Add time display to dashboard event cards (`buildEventRowHtml`)**

The dashboard event HTML is built in `buildEventRowHtml()` at line 557. At line 558, `dateStr` is defined as already-escaped:
```js
      const dateStr = escapeHtml(formatEventDate(ev.event_date))
```

Add the time suffix to `dateStr` on the same line:
```js
      const dateStr = escapeHtml(formatEventDate(ev.event_date)) +
        (formatTimeRange(ev.start_time, ev.end_time) ? ' · ' + formatTimeRange(ev.start_time, ev.end_time) : '')
```

`dateStr` is then used at line 609 as `${dateStr}` inside a template literal — no change needed there.

- [ ] **Step 4: Manual test**

Visit `openbar.html` without logging in. Verify upcoming events with a start time show "Date · Time" (or "Date · Time – Time"). Log in as a guest. Verify dashboard Events card shows the same time format. Verify events without `start_time` (legacy events) show no time string.

- [ ] **Step 5: Commit**

```bash
git add openbar.html
git commit -m "feat: display event start/end times on guest-facing event cards"
```

---

## Done

All five features implemented:
1. DB columns added (migration 004)
2. `formatTimeRange` helper in `js/events.js`
3. Disabled account blocks login with clear message
4. Signups tab: alias click-to-edit + soft-delete with modal + restore
5. Events: time fields in create form, displayed in admin list and guest cards
