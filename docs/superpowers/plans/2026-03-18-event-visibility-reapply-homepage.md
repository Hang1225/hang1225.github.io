# Event Visibility, Guest Reapply & Home Page Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide closed events from the public, let removed guests reapply, and show upcoming event teasers on the home page with admin notes.

**Architecture:** Pure client-side static site (HTML + ES modules) backed by Supabase. No build step. Changes touch 5 files + a one-line Supabase DB migration. Tasks are ordered so each can be verified independently in a browser before moving on.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS v2, HTML/CSS. No test runner — verification is manual browser inspection against a local dev server or live Supabase project.

---

## File Map

| File | What changes |
|---|---|
| `js/events.js` | Add `.neq('status','closed')`; explicit column select excluding `notes` |
| `js/reservations.js` | Add `reapplyReservation()`; add `start_time, end_time` to `loadAttendeeReservations` events join |
| `openbar.html` | Feature 1: `renderCancelledEvents()`; Feature 2: `myResByEvent` + reapply submit logic |
| `home.html` | New upcoming events section |
| `admin/js/admin-main.js` | Notes textarea per event block + silent blur save |

---

## Task 1: DB Migration — Add `notes` column

**Files:**
- No code files — Supabase dashboard only

- [ ] **Step 1: Run the migration in Supabase**

  Open the Supabase SQL editor for this project and run:
  ```sql
  ALTER TABLE events ADD COLUMN notes text;
  ```

- [ ] **Step 2: Verify**

  In the Supabase Table Editor, open the `events` table. Confirm a `notes` column of type `text` is present and nullable. Optionally set a value on one row to confirm it saves.

- [ ] **Step 3: Commit note**

  No code to commit yet. Add a comment in the git log:
  ```bash
  git commit --allow-empty -m "chore: applied Supabase migration — events.notes text column added"
  ```

---

## Task 2: `js/events.js` — Exclude closed events + explicit column select

**Files:**
- Modify: `js/events.js`

- [ ] **Step 1: Read the current file**

  Open `js/events.js`. The `loadEvents()` function currently has:
  ```js
  .select('*')
  .neq('status', 'cancelled')
  ```

- [ ] **Step 2: Apply the changes**

  Replace that query with:
  ```js
  .select('id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time')
  .neq('status', 'cancelled')
  .neq('status', 'closed')
  ```

  The full updated `loadEvents()`:
  ```js
  export async function loadEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time')
      .neq('status', 'cancelled')
      .neq('status', 'closed')
      .order('event_date', { ascending: true })
    return error ? [] : data
  }
  ```

- [ ] **Step 3: Verify**

  Open `openbar.html` in the browser. In Supabase, temporarily set an open event's status to `'closed'`. Reload the page — the event should disappear from the pre-login events list. Restore the status to `'open'` and confirm it reappears.

- [ ] **Step 4: Commit**

  ```bash
  git add js/events.js
  git commit -m "fix: exclude closed events from loadEvents; switch to explicit column select"
  ```

---

## Task 3: `js/reservations.js` — Add `reapplyReservation()`

**Files:**
- Modify: `js/reservations.js`

- [ ] **Step 1: Read the current file**

  Open `js/reservations.js`. The last export is `cancelReservation`.

- [ ] **Step 2: Update `loadAttendeeReservations()` — add `start_time, end_time` to events join**

  Find `loadAttendeeReservations` in `js/reservations.js`:
  ```js
  .select('*, events(id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender)')
  ```
  Replace with:
  ```js
  .select('*, events(id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time)')
  ```
  This ensures `renderCancelledEvents()` (Task 4) has the time fields it needs to call `formatTimeRange`.

- [ ] **Step 3: Append `reapplyReservation()` export**

  Add after `cancelReservation`:
  ```js
  // Updates a previously-removed reservation back to an active status.
  // Use instead of createReservation when the attendee already has a removed row
  // for this event, to avoid duplicate rows.
  export async function reapplyReservation(reservationId, guestCount, message, status) {
    const { data, error } = await supabase
      .from('reservations')
      .update({ guest_count: guestCount, message: message || null, status })
      .eq('id', reservationId)
      .select()
      .single()
    return { data, error }
  }
  ```

- [ ] **Step 4: Verify**

  No UI change yet — these changes will be exercised in Tasks 4 and 5. Open `openbar.html` in the browser and confirm the JS module loads without console errors.

- [ ] **Step 5: Commit**

  ```bash
  git add js/reservations.js
  git commit -m "feat: add reapplyReservation(); add start_time/end_time to attendee reservations join"
  ```

---

## Task 4: `openbar.html` — Feature 1: Cancelled events in dashboard

**Files:**
- Modify: `openbar.html` (the inline `<script type="module">`)

This task wires up the "Cancelled" section that appears in a logged-in guest's dashboard when they have a reservation on a closed event.

- [ ] **Step 1: Update the import line**

  Find the existing import:
  ```js
  import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList } from './js/reservations.js'
  ```
  No change needed here yet — `reapplyReservation` is imported in Task 5.

- [ ] **Step 2: Update `loadDashboardData()` — collect cancelled events**

  Inside `loadDashboardData()`, after the block that builds `myResByEvent`:

  ```js
  // This attendee's reservations indexed by event_id
  const myResByEvent = {}
  attendeeReservations.forEach(r => {
    if (r.status !== 'cancelled') myResByEvent[r.event_id] = r
  })
  ```

  Add immediately after:
  ```js
  // Collect upcoming closed events where this guest has an active reservation
  const today = new Date().toISOString().split('T')[0]  // already defined above — reuse it
  const cancelledEvents = attendeeReservations.filter(r =>
    r.events &&
    r.events.status === 'closed' &&
    r.events.event_date >= today &&
    ['confirmed', 'waitlisted', 'interested'].includes(r.status)
  )
  ```

  Note: `today` is already defined earlier in `loadDashboardData()` — do not re-declare it, just use the existing variable.

- [ ] **Step 3: Pass `cancelledEvents` to render calls**

  Update the final line of `loadDashboardData()`:
  ```js
  // Before:
  await renderDashboardEvents(upcomingEvents, myResByEvent, slotsByEvent, waitlistByEvent)
  renderHistory(historyRows)

  // After:
  await renderDashboardEvents(upcomingEvents, myResByEvent, slotsByEvent, waitlistByEvent)
  renderCancelledEvents(cancelledEvents)
  renderHistory(historyRows)
  ```

- [ ] **Step 4: Add `renderCancelledEvents()` function**

  Add this new function after `renderDashboardEvents` (before `renderHistory`):

  ```js
  function renderCancelledEvents(reservations) {
    // Find or create the container — it lives inside the same dashboard card as upcoming events
    let container = document.getElementById('events-cancelled-list')
    if (!container) {
      // Inject a container below the upcoming events card
      const card = document.getElementById('events-dashboard-card')
      const wrapper = document.createElement('div')
      wrapper.id = 'events-cancelled-wrapper'
      wrapper.style.marginTop = '1.5rem'
      wrapper.innerHTML = `
        <div style="font-family:'Cinzel',serif;font-size:0.52rem;letter-spacing:0.14em;color:var(--muted);margin-bottom:0.75rem">CANCELLED</div>
        <div id="events-cancelled-list"></div>
      `
      card.appendChild(wrapper)
      container = document.getElementById('events-cancelled-list')
    }

    const wrapper = document.getElementById('events-cancelled-wrapper')

    if (!reservations.length) {
      if (wrapper) wrapper.style.display = 'none'
      return
    }

    wrapper.style.display = 'block'
    container.innerHTML = ''

    reservations.forEach(r => {
      const ev = r.events
      const timeRange = formatTimeRange(ev.start_time, ev.end_time)
      const dateStr = escapeHtml(formatEventDate(ev.event_date)) + (timeRange ? ' · ' + timeRange : '')
      const isCurated = ev.event_type === 'curated'
      const typeBadge = isCurated
        ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('策划', 'Home Bar')}</span>`
        : ''

      const row = document.createElement('div')
      row.className = 'event-row'
      row.innerHTML = `
        <div class="event-row-header">
          <div>
            <div class="event-date">${dateStr}</div>
            <div class="event-title-text">${escapeHtml(ev.title)}${typeBadge}</div>
          </div>
          <span class="badge badge-red" style="font-size:0.5rem;align-self:flex-start">${t('已取消', 'Cancelled')}</span>
        </div>
      `
      container.appendChild(row)
    })
  }
  ```

  Note: `formatEventDate`, `formatTimeRange`, `escapeHtml`, and `t` are all already defined in the same script block — no imports needed.

- [ ] **Step 5: Verify**

  1. In Supabase: set an event to `'closed'` that has a confirmed reservation for a test attendee
  2. Log in as that attendee on `openbar.html`
  3. Confirm the event does NOT appear in the Upcoming Events section
  4. Confirm it DOES appear in a "Cancelled" section below upcoming events with a red "Cancelled" badge
  5. Set the event back to `'open'` — reload — confirm it moves back to Upcoming Events and the Cancelled section disappears

- [ ] **Step 6: Commit**

  ```bash
  git add openbar.html
  git commit -m "feat: show closed events as Cancelled in guest dashboard (Feature 1)"
  ```

---

## Task 5: `openbar.html` — Feature 2: Guest reapply after removal

**Files:**
- Modify: `openbar.html` (inline script)

- [ ] **Step 1: Update the import to include `reapplyReservation`**

  Find:
  ```js
  import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList } from './js/reservations.js'
  ```
  Replace with:
  ```js
  import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList, reapplyReservation } from './js/reservations.js'
  ```

- [ ] **Step 2: Update `myResByEvent` to exclude `removed` status**

  Find the block in `loadDashboardData()`:
  ```js
  const myResByEvent = {}
  attendeeReservations.forEach(r => {
    if (r.status !== 'cancelled') myResByEvent[r.event_id] = r
  })
  ```
  Replace with:
  ```js
  const myResByEvent = {}
  attendeeReservations.forEach(r => {
    if (r.status !== 'cancelled' && r.status !== 'removed') myResByEvent[r.event_id] = r
  })
  ```

- [ ] **Step 3: Update the submit reservation handler to handle reapply**

  Find the submit handler inside `attachEventRowHandlers`:
  ```js
  container.querySelectorAll('.submit-res-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const eventId = btn.dataset.eventId
      const eventType = btn.dataset.eventType
      const form = document.getElementById('form-' + eventId)
      const message = form.querySelector('textarea.event-message').value.trim()
      const errEl = form.querySelector('.res-error')
      errEl.style.display = 'none'
      btn.disabled = true

      let guestCount = 1
      let status = 'interested'

      if (eventType === 'open') {
        const activeOpt = form.querySelector('.guest-opt.active')
        guestCount = activeOpt ? parseInt(activeOpt.dataset.count) : 1

        // Determine status: confirmed or waitlisted
        const row = btn.closest('.event-row')
        const used = parseInt(row.dataset.used) || 0
        const capacity = parseInt(row.dataset.capacity) || 6
        status = (used + guestCount <= capacity) ? 'confirmed' : 'waitlisted'
      }

      const { error } = await createReservation(
        eventId, currentAttendee.id, guestCount, message || null, status
      )
  ```

  Replace the final `createReservation` call and everything after with:
  ```js
      // Check if this attendee has a previously-removed reservation for this event
      const removedRes = attendeeReservations.find(
        r => r.event_id === eventId && r.status === 'removed'
      )

      const { error } = removedRes
        ? await reapplyReservation(removedRes.id, guestCount, message || null, status)
        : await createReservation(eventId, currentAttendee.id, guestCount, message || null, status)
  ```

  Leave the rest of the handler (error display, `loadDashboardData()` call) unchanged.

- [ ] **Step 4: Verify**

  1. In Supabase: set a guest's reservation on an upcoming open event to `'removed'`
  2. Log in as that guest on `openbar.html`
  3. Confirm the event shows the "Reserve →" button (as if no reservation exists)
  4. Click Reserve, fill in the form, submit
  5. In Supabase, confirm the existing reservation row was UPDATED (not a new row inserted) and its status is now `'confirmed'` or `'waitlisted'`
  6. Confirm the dashboard now shows the guest as confirmed/waitlisted

- [ ] **Step 5: Commit**

  ```bash
  git add openbar.html
  git commit -m "feat: allow removed guests to reapply to events (Feature 2)"
  ```

---

## Task 6: `home.html` — Upcoming events teaser section

**Files:**
- Modify: `home.html`

- [ ] **Step 1: Add the events container to the HTML**

  In `home.html`, find the hero section closing tag:
  ```html
    </div>

    <div class="fade-in-2">
  ```

  Insert the new events section between them:
  ```html
    </div>

    <div id="home-events-section" class="fade-in-2" style="display:none;margin-bottom:2.5rem">
      <span class="eyebrow" data-zh="即将举办" data-en="Upcoming">即将举办</span>
      <div id="home-events-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.75rem"></div>
    </div>

    <div class="fade-in-2">
  ```

- [ ] **Step 2: Add card styles**

  Inside `home.html`'s `<style>` block, add:
  ```css
  .home-event-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    text-decoration: none;
    color: inherit;
  }
  a.home-event-card { cursor: pointer; }
  a.home-event-card:hover { border-color: var(--gold-dim); }
  .home-event-card-date {
    font-family: 'Cinzel', serif;
    font-size: 0.54rem;
    letter-spacing: 0.16em;
    color: var(--gold);
    margin-bottom: 0.15rem;
  }
  .home-event-card-title {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    color: var(--cream);
  }
  .home-event-card-badge {
    font-family: 'Cinzel', serif;
    font-size: 0.48rem;
    letter-spacing: 0.1em;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0.2rem 0.5rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 3: Add the script logic**

  In `home.html`'s `<script type="module">`, add these imports at the top alongside existing ones:
  ```js
  import { loadEvents, formatTimeRange } from './js/events.js'
  ```

  Then add this function and call at the end of the script block (before the closing `</script>`):
  ```js
  function escapeHtml(str) {
    if (!str) return ''
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')
  }

  function formatHomeEventDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }

  async function renderHomeEvents() {
    const today = new Date().toISOString().split('T')[0]
    const allEvents = await loadEvents()
    const upcoming = allEvents.filter(e => e.event_date >= today)

    const section = document.getElementById('home-events-section')
    const list = document.getElementById('home-events-list')

    if (!upcoming.length) return // section stays hidden

    list.innerHTML = ''
    upcoming.forEach(ev => {
      const isOpenBar = ev.event_type === 'open'
      const timeRange = formatTimeRange(ev.start_time, ev.end_time)
      const dateStr = escapeHtml(formatHomeEventDate(ev.event_date)) + (timeRange ? ' · ' + timeRange : '')
      const badgeText = isOpenBar ? 'Open Bar' : 'Home Bar'

      const card = document.createElement(isOpenBar ? 'a' : 'div')
      card.className = 'home-event-card'
      if (isOpenBar) card.href = '/openbar.html'
      card.innerHTML = `
        <div>
          <div class="home-event-card-date">${dateStr}</div>
          <div class="home-event-card-title">${escapeHtml(ev.title)}</div>
        </div>
        <span class="home-event-card-badge">${badgeText}</span>
      `
      list.appendChild(card)
    })

    section.style.display = 'block'
  }

  renderHomeEvents()
  ```

- [ ] **Step 4: Verify**

  1. Open `home.html` in the browser
  2. If there are upcoming open events: confirm a card appears with the correct date/title and a link badge "Open Bar" that navigates to `/openbar.html` when clicked
  3. If there are upcoming curated events: confirm a card appears with a "Home Bar" badge and is NOT clickable (cursor is default, no navigation)
  4. Temporarily set all upcoming events to past dates in Supabase — reload — confirm the events section is hidden entirely
  5. Restore dates

- [ ] **Step 5: Commit**

  ```bash
  git add home.html
  git commit -m "feat: show upcoming event teasers on home page (Feature 3)"
  ```

---

## Task 7: `admin/js/admin-main.js` — Notes field per event

**Files:**
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Add notes textarea to `buildEventBlockHtml()`**

  Find the end of `buildEventBlockHtml()` where the body is assembled:
  ```js
  return `
    <div class="event-block-header" ...>
      ...
    </div>
    <div class="event-block-body" style="display:none">
      ${confirmedSection}
      ${secondarySection}
    </div>
  `
  ```

  Replace with:
  ```js
  const notesHtml = `
    <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid rgba(201,168,76,0.08)">
      <div style="font-family:'Cinzel',serif;font-size:0.5rem;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.4rem">NOTES</div>
      <textarea
        class="event-notes-input"
        data-event-id="${escapeHtml(ev.id)}"
        placeholder="Private admin notes…"
        style="width:100%;min-height:60px;background:rgba(255,255,255,0.02);border:1px solid rgba(201,168,76,0.1);border-radius:var(--radius);padding:0.5rem 0.75rem;color:var(--text);font-family:'Cormorant Garamond',serif;font-size:0.95rem;resize:vertical;outline:none"
      >${escapeHtml(ev.notes || '')}</textarea>
    </div>
  `

  return `
    <div class="event-block-header" data-event-id="${escapeHtml(ev.id)}">
      ...
    </div>
    <div class="event-block-body" style="display:none">
      ${confirmedSection}
      ${secondarySection}
      ${notesHtml}
    </div>
  `
  ```

  Important: keep the existing header HTML intact — only replace the closing `</div>` of the body to append `${notesHtml}`.

- [ ] **Step 2: Attach notes blur save in `attachEventBlockHandlers()`**

  At the end of `attachEventBlockHandlers(container)`, before the closing `}`, add:
  ```js
  // Notes: silent auto-save on blur (no full reload)
  container.querySelectorAll('.event-notes-input').forEach(textarea => {
    textarea.addEventListener('blur', async () => {
      await supabase
        .from('events')
        .update({ notes: textarea.value.trim() || null })
        .eq('id', textarea.dataset.eventId)
    })
  })
  ```

- [ ] **Step 3: Verify**

  1. Open the admin panel, go to the Events tab
  2. Expand an event block — confirm a "NOTES" label and textarea appear at the bottom
  3. Type something in the textarea, click elsewhere to trigger blur
  4. In Supabase, confirm the `notes` column on that event row contains the typed text
  5. Reload the admin panel — confirm the notes text is still present in the textarea
  6. Clear the textarea and blur — confirm the Supabase row now has `null` in `notes`

- [ ] **Step 4: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: add per-event admin notes field with silent auto-save"
  ```

---

## Final Verification Checklist

Run through these end-to-end scenarios after all tasks are complete:

- [ ] Close an event → disappears from `/openbar.html` pre-login list and from dashboard upcoming events
- [ ] Close an event with a signed-up guest → guest sees "Cancelled" row in dashboard; no action buttons
- [ ] Close an event with a past-dated reservation → guest sees it in History (not Cancelled section)
- [ ] Reopen a closed event → guest's dashboard shows it in Upcoming again
- [ ] Admin removes a guest → guest can log in and sees Reserve button on that event
- [ ] Removed guest reapplies → Supabase shows 1 row updated (not a second row inserted)
- [ ] Home page shows upcoming events as teasers; Open Bar card links to `/openbar.html`; Home Bar card is not clickable
- [ ] Home page with no upcoming events → events section is fully hidden
- [ ] Admin notes save silently on blur; expand/collapse state of other events is preserved after save
- [ ] `loadEvents()` does not return `notes` field (check Network tab in browser DevTools)
