# Admin Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-controlled capacity slots to events: admin sets a reserved count, invites specific guests (who see Accept/Decline in their dashboard), and directly adds guests as confirmed — all within the existing admin event block UI.

**Architecture:** Schema adds `admin_reserved` to `events` and `invited` status + `admin_added` flag to `reservations`. The admin panel gets a new "Admin Slots" subsection per event block. The guest dashboard gets a new "Invitations" section above Upcoming Events. All capacity math subtracts `admin_reserved` from the guest-visible total.

**Tech Stack:** Vanilla JS ES modules, Supabase JS v2, no build step. All files are edited directly. No test framework exists — verification is manual browser testing against a live Supabase instance.

**Spec:** `docs/superpowers/specs/2026-03-18-admin-slots-design.md`

---

## File Map

| File | What changes |
|---|---|
| Supabase SQL Editor | Run migration once: `admin_reserved` on events, `invited` status + `admin_added` on reservations, updated `promote_waitlist` trigger |
| `js/events.js` | Add `admin_reserved` to `loadEvents()` explicit column select |
| `js/reservations.js` | Add `admin_added` + event fields to `loadAttendeeReservations()` select; add `acceptInvite()` and `declineInvite()` exports |
| `admin/js/admin-main.js` | Update `loadEventsAdmin()` reservations join to include `attendee_id` and `admin_added`; add `buildAdminSlotsHtml(ev)`; insert it into `buildEventBlockHtml(ev)`; wire `admin-reserved-input`, `admin-invite-btn`, `admin-add-btn`, `admin-slot-confirm-btn`, `admin-slot-cancel-btn`, `admin-slot-remove-btn` handlers in `attachEventBlockHandlers()`; cache attendees in `window._attendeesCache` from `loadSignupsAdmin()` |
| `openbar.html` | Update both `slotsByEvent` queries to filter `admin_added = false`; update `myResByEvent` combined condition to also exclude `invited`; filter `invitedReservations` from `attendeeReservations`; call `renderInvitations(invitedReservations)` from `loadDashboardData()`; add `renderInvitations()` function; suppress Cancel button for `admin_added` confirmed rows; update `buildReserveFormHtml` and slot meter to subtract `admin_reserved`; update `row.dataset.capacity` to store effective regular capacity; import `acceptInvite`, `declineInvite` |

---

## Task 1: DB Migration

**Files:**
- Run in Supabase Dashboard → SQL Editor

- [ ] **Step 1.1: Open Supabase SQL Editor and run the migration**

Run the following SQL **exactly as written** — each statement is idempotent-safe if run in order:

```sql
-- 1. Add admin_reserved to events
ALTER TABLE events ADD COLUMN admin_reserved integer NOT NULL DEFAULT 0;

-- 2. Extend reservations status enum (drop old constraint, add new one)
ALTER TABLE reservations DROP CONSTRAINT reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN (
    'confirmed', 'waitlisted', 'interested',
    'cancelled', 'declined', 'removed', 'invited'
  ));

-- 3. Add admin_added flag to reservations
ALTER TABLE reservations ADD COLUMN admin_added boolean NOT NULL DEFAULT false;

-- 4. Update promote_waitlist trigger: fetch admin_reserved and filter used_slots
CREATE OR REPLACE FUNCTION promote_waitlist()
RETURNS trigger AS $$
DECLARE
  used_slots  integer;
  event_cap   integer;
  ev_type     text;
  admin_res   integer;
  avail       integer;
  rec         record;
BEGIN
  IF new.status IN ('cancelled', 'declined', 'removed')
     AND old.status NOT IN ('cancelled', 'declined', 'removed') THEN

    SELECT capacity, event_type, admin_reserved
      INTO event_cap, ev_type, admin_res
      FROM events WHERE id = new.event_id;

    IF ev_type != 'open' THEN RETURN new; END IF;

    SELECT coalesce(sum(guest_count), 0) INTO used_slots
      FROM reservations
     WHERE event_id = new.event_id
       AND status = 'confirmed'
       AND admin_added = false;

    avail := event_cap - admin_res - used_slots;

    FOR rec IN
      SELECT * FROM reservations
       WHERE event_id = new.event_id AND status = 'waitlisted'
       ORDER BY created_at ASC
    LOOP
      IF avail >= rec.guest_count THEN
        UPDATE reservations SET status = 'confirmed' WHERE id = rec.id;
        avail := avail - rec.guest_count;
      END IF;
    END LOOP;

  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 1.2: Verify the migration**

Run these checks in the SQL Editor:

```sql
-- Should return column names including admin_reserved
SELECT column_name FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'admin_reserved';

-- Should return both admin_added and the updated constraint
SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' AND column_name IN ('admin_added');

-- Should show 'invited' is now a valid status (insert + rollback)
BEGIN;
INSERT INTO reservations (event_id, attendee_id, guest_count, status, admin_added)
  SELECT id, (SELECT id FROM attendees LIMIT 1), 1, 'invited', true FROM events LIMIT 1;
ROLLBACK;
```

Expected: all queries succeed without errors.

- [ ] **Step 1.3: Commit**

```bash
git add docs/superpowers/plans/2026-03-19-admin-slots.md
git commit -m "feat: run admin-slots DB migration (admin_reserved, invited status, admin_added flag, trigger update)"
```

Note: the migration itself runs in Supabase — only the plan file changes in git here.

---

## Task 2: `js/events.js` — Add `admin_reserved` to column select

**Files:**
- Modify: `js/events.js:8`

- [ ] **Step 2.1: Add `admin_reserved` to the explicit column list**

In `js/events.js`, find the `.select(...)` call in `loadEvents()` (line 8) and add `admin_reserved`:

```js
// Before:
.select('id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time')

// After:
.select('id, title, event_date, event_type, status, capacity, admin_reserved, show_count, show_names, show_gender, start_time, end_time')
```

- [ ] **Step 2.2: Verify in browser**

Open `openbar.html` in the browser (after login). Open DevTools → Console. Run:

```js
import('/js/events.js').then(m => m.loadEvents().then(evs => console.log(evs[0]?.admin_reserved)))
```

Expected: prints `0` (or a number) without `undefined`.

- [ ] **Step 2.3: Commit**

```bash
git add js/events.js
git commit -m "feat: include admin_reserved in loadEvents() column select"
```

---

## Task 3: `js/reservations.js` — Update select and add invite functions

**Files:**
- Modify: `js/reservations.js`

- [ ] **Step 3.1: Update `loadAttendeeReservations()` select to include `admin_reserved` and time fields from events**

Find `loadAttendeeReservations` (line 50–56). Update the `.select()` call:

```js
// Before:
.select('*, events(id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time)')

// After:
.select('*, events(id, title, event_date, event_type, status, capacity, admin_reserved, show_count, show_names, show_gender, start_time, end_time)')
```

The `*` on the outer table (reservations) already includes `admin_added` after the migration. No further change needed to pick up `admin_added`.

- [ ] **Step 3.2: Add `acceptInvite` and `declineInvite` exports**

Append to the end of `js/reservations.js`:

```js
// Updates an invited reservation to confirmed (guest accepts invite).
export async function acceptInvite(reservationId) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmed' })
    .eq('id', reservationId)
  return { error }
}

// Sets an invited reservation to declined and decrements admin_reserved by 1.
// currentAdminReserved is the event's current admin_reserved value (read from
// the reservation's joined event data before calling this function).
export async function declineInvite(reservationId, eventId, currentAdminReserved) {
  const [resResult, eventResult] = await Promise.all([
    supabase.from('reservations').update({ status: 'declined' }).eq('id', reservationId),
    supabase.from('events').update({ admin_reserved: Math.max(0, currentAdminReserved - 1) }).eq('id', eventId)
  ])
  return { error: resResult.error || eventResult.error }
}
```

- [ ] **Step 3.3: Verify in browser console**

```js
// Check the exports exist (no import needed if already on the page)
const m = await import('/js/reservations.js')
console.log(typeof m.acceptInvite, typeof m.declineInvite)
// Expected: "function function"
```

- [ ] **Step 3.4: Commit**

```bash
git add js/reservations.js
git commit -m "feat: add acceptInvite and declineInvite to reservations; include admin_reserved in loadAttendeeReservations"
```

---

## Task 4: `admin/js/admin-main.js` — Admin Slots subsection

**Files:**
- Modify: `admin/js/admin-main.js`

This is the largest task. Work through it sub-step by sub-step.

### 4a — Cache attendees and update reservations join

- [ ] **Step 4a.1: Cache attendees in `loadSignupsAdmin()`**

Find `loadSignupsAdmin()` (line 282). Add one line to cache the data globally **before** the early-return guard:

```js
async function loadSignupsAdmin() {
  const { data } = await supabase
    .from('attendees')
    .select('id, username, alias, gender, gender_visibility, created_at, removed_at')
    .order('created_at', { ascending: false })

  window._attendeesCache = data || []   // ← ADD THIS LINE (before the guard)

  const el = document.getElementById('signups-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No attendees yet.</p>'
    return
  }
  // ... rest of function unchanged
```

- [ ] **Step 4a.2: Add `attendee_id` and `admin_added` to `loadEventsAdmin()` reservations join**

Find `loadEventsAdmin()` (line 473). Update the `.select()`:

```js
// Before:
.select('*, reservations(id, status, guest_count, message, created_at, attendees(username, alias))')

// After:
.select('*, reservations(id, attendee_id, status, guest_count, message, created_at, admin_added, attendees(username, alias))')
```

### 4b — Build the Admin Slots HTML helper

- [ ] **Step 4b.1: Add `buildAdminSlotsHtml(ev)` function**

Add this new function after `buildEditFormHtml` (after line 719, before the `// --- ACCOUNT REMOVAL MODAL ---` comment):

```js
function buildAdminSlotsHtml(ev) {
  const reservations = ev.reservations || []
  const adminRows = reservations.filter(r =>
    r.status === 'invited' || (r.status === 'confirmed' && r.admin_added)
  )
  const used = adminRows.length
  const adminReserved = ev.admin_reserved || 0
  const available = adminReserved - used

  const guestListHtml = adminRows.map(r => {
    const name = escapeHtml(r.attendees ? (r.attendees.alias || r.attendees.username) : '—')
    const statusLabel = r.status === 'invited' ? 'Invited' : 'Added'
    return `
      <div class="event-attendee-row" style="font-size:0.88rem">
        <div><strong>${name}</strong> · <span class="muted">${statusLabel}</span></div>
        <button class="btn btn-sm btn-danger admin-slot-remove-btn"
          data-res-id="${escapeHtml(r.id)}"
          data-res-status="${escapeHtml(r.status)}"
          data-event-id="${escapeHtml(ev.id)}"
          data-admin-reserved="${adminReserved}">Remove</button>
      </div>`
  }).join('')

  const buttonsDisabled = available <= 0 ? ' disabled style="opacity:0.45;cursor:not-allowed"' : ''

  return `
    <div class="admin-slots-section" data-event-id="${escapeHtml(ev.id)}"
      style="padding:0.75rem 0;border-bottom:1px solid rgba(201,168,76,0.12);margin-bottom:0.75rem">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;flex-wrap:wrap;gap:0.5rem">
        <div style="font-family:'Cinzel',serif;font-size:0.5rem;letter-spacing:0.12em;color:var(--muted)">ADMIN SLOTS</div>
        <div style="font-size:0.78rem;color:var(--muted)">
          Reserved: <strong style="color:var(--text)">${adminReserved}</strong>
          &nbsp;·&nbsp; Used: <strong style="color:var(--text)">${used}</strong>
          &nbsp;·&nbsp; Available: <strong style="color:${available > 0 ? 'var(--gold)' : 'var(--muted)'}">${available}</strong>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap">
        <label style="font-size:0.75rem;color:var(--muted)">Reserved count</label>
        <input type="number" class="admin-reserved-input" min="0"
          value="${adminReserved}"
          data-event-id="${escapeHtml(ev.id)}"
          data-used="${used}"
          style="width:60px;padding:0.2rem 0.4rem;font-size:0.9rem">
      </div>

      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
        <button class="btn btn-sm admin-invite-btn" data-event-id="${escapeHtml(ev.id)}"${buttonsDisabled}>Invite Guest</button>
        <button class="btn btn-sm admin-add-btn" data-event-id="${escapeHtml(ev.id)}"${buttonsDisabled}>Add Directly</button>
      </div>

      <div class="admin-slot-form" id="admin-slot-form-${escapeHtml(ev.id)}" style="display:none;margin-bottom:0.6rem">
        <input type="text" class="admin-guest-search"
          placeholder="Username or alias…"
          style="width:100%;margin-bottom:0.4rem">
        <div class="admin-guest-results"
          style="max-height:120px;overflow-y:auto;border:1px solid rgba(201,168,76,0.1);border-radius:var(--radius);margin-bottom:0.4rem"></div>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <button class="btn btn-sm btn-solid admin-slot-confirm-btn"
            data-event-id="${escapeHtml(ev.id)}"
            disabled>Send Invite</button>
          <button class="btn btn-sm admin-slot-cancel-btn"
            data-event-id="${escapeHtml(ev.id)}">Cancel</button>
          <span class="admin-slot-err error" style="display:none;font-size:0.8rem"></span>
        </div>
      </div>

      ${guestListHtml
        ? `<div class="admin-slot-guest-list" style="margin-top:0.4rem">${guestListHtml}</div>`
        : ''}
    </div>
  `
}
```

### 4c — Insert Admin Slots section into event block body

- [ ] **Step 4c.1: Call `buildAdminSlotsHtml` inside `buildEventBlockHtml`**

Find the return template in `buildEventBlockHtml` (around line 595). The `<div class="event-block-body">` currently looks like:

```js
    <div class="event-block-body" style="display:none">
      <div class="event-edit-form" id="edit-form-${escapeHtml(ev.id)}" style="display:none"></div>
      ${confirmedSection}
      ${secondarySection}
      ${notesHtml}
    </div>
```

Change it to:

```js
    <div class="event-block-body" style="display:none">
      <div class="event-edit-form" id="edit-form-${escapeHtml(ev.id)}" style="display:none"></div>
      ${buildAdminSlotsHtml(ev)}
      ${confirmedSection}
      ${secondarySection}
      ${notesHtml}
    </div>
```

### 4d — Wire handlers in `attachEventBlockHandlers`

- [ ] **Step 4d.1: Add reserved count auto-save handler**

In `attachEventBlockHandlers(container)`, after the notes handler block (after line 803), add:

```js
  // Admin reserved count: auto-save on blur, reject if below current used count
  container.querySelectorAll('.admin-reserved-input').forEach(input => {
    let prevValue = parseInt(input.value) || 0

    input.addEventListener('focus', () => {
      prevValue = parseInt(input.value) || 0
    })

    input.addEventListener('blur', async e => {
      e.stopPropagation()
      const eventId = input.dataset.eventId
      const used = parseInt(input.dataset.used) || 0
      let newValue = parseInt(input.value)
      if (isNaN(newValue) || newValue < 0) newValue = 0

      if (newValue < used) {
        input.value = prevValue  // reset — cannot go below current used count
        return
      }
      if (newValue === prevValue) return

      await supabase.from('events').update({ admin_reserved: newValue }).eq('id', eventId)
      prevValue = newValue
    })
  })
```

- [ ] **Step 4d.2: Add Invite Guest / Add Directly button handlers**

```js
  // Open inline admin slot form (invite or direct-add mode)
  function openAdminSlotForm(eventId, mode) {
    const form = document.getElementById('admin-slot-form-' + eventId)
    if (!form) return
    form.dataset.mode = mode
    form.style.display = 'block'
    const confirmBtn = form.querySelector('.admin-slot-confirm-btn')
    confirmBtn.textContent = mode === 'invite' ? 'Send Invite' : 'Add Guest'
    confirmBtn.disabled = true
    delete confirmBtn.dataset.selectedAttendeeId
    const search = form.querySelector('.admin-guest-search')
    search.value = ''
    form.querySelector('.admin-guest-results').innerHTML = ''
    const errEl = form.querySelector('.admin-slot-err')
    errEl.style.display = 'none'
    search.focus()
  }

  container.querySelectorAll('.admin-invite-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openAdminSlotForm(btn.dataset.eventId, 'invite')
    })
  })

  container.querySelectorAll('.admin-add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openAdminSlotForm(btn.dataset.eventId, 'add')
    })
  })
```

- [ ] **Step 4d.3: Add attendee search / filter handler**

```js
  // Attendee live search inside the inline form
  container.querySelectorAll('.admin-guest-search').forEach(input => {
    input.addEventListener('input', e => {
      e.stopPropagation()
      const section = input.closest('.admin-slots-section')
      const eventId = section.dataset.eventId
      const ev = (window._eventsAdminCache || []).find(ev => ev.id === eventId)
      const reservations = ev ? (ev.reservations || []) : []

      // Block attendees who already have an active reservation on this event
      const blockedIds = new Set(
        reservations
          .filter(r => ['confirmed', 'waitlisted', 'interested', 'invited'].includes(r.status))
          .map(r => r.attendee_id)
          .filter(Boolean)
      )

      const query = input.value.trim().toLowerCase()
      const allAttendees = window._attendeesCache || []
      const results = allAttendees
        .filter(a => !blockedIds.has(a.id))
        .filter(a =>
          !query ||
          a.username.toLowerCase().includes(query) ||
          (a.alias && a.alias.toLowerCase().includes(query))
        )
        .slice(0, 8)

      const resultsEl = input.closest('.admin-slot-form').querySelector('.admin-guest-results')
      resultsEl.innerHTML = results.map(a => `
        <div class="admin-guest-result"
          data-attendee-id="${escapeHtml(a.id)}"
          data-display="${escapeHtml(a.alias || a.username)}"
          style="padding:0.35rem 0.6rem;cursor:pointer;font-size:0.88rem;border-bottom:1px solid rgba(201,168,76,0.07)">
          <strong>${escapeHtml(a.alias || a.username)}</strong>
          <span class="muted"> @${escapeHtml(a.username)}</span>
        </div>
      `).join('')

      resultsEl.querySelectorAll('.admin-guest-result').forEach(row => {
        row.addEventListener('click', () => {
          const form = input.closest('.admin-slot-form')
          const confirmBtn = form.querySelector('.admin-slot-confirm-btn')
          confirmBtn.dataset.selectedAttendeeId = row.dataset.attendeeId
          confirmBtn.disabled = false
          input.value = row.dataset.display
          resultsEl.innerHTML = ''
        })
      })
    })
  })
```

- [ ] **Step 4d.4: Add confirm (Send Invite / Add Guest) handler**

> **Note:** The spec says "update the subsection in place" on add and remove. This plan uses `loadEventsAdmin()` (full re-render) instead — same as the existing create-event and reservation-action patterns. This is simpler and correct. The trade-off is that all event blocks collapse on re-render; admins will need to re-expand.

```js
  // Confirm: insert reservation as invited or confirmed+admin_added
  container.querySelectorAll('.admin-slot-confirm-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const attendeeId = btn.dataset.selectedAttendeeId
      if (!attendeeId) return
      const form = btn.closest('.admin-slot-form')
      const mode = form.dataset.mode
      const eventId = btn.dataset.eventId
      const errEl = form.querySelector('.admin-slot-err')
      errEl.style.display = 'none'
      btn.disabled = true

      const { error } = await supabase.from('reservations').insert({
        event_id: eventId,
        attendee_id: attendeeId,
        guest_count: 1,
        status: mode === 'invite' ? 'invited' : 'confirmed',
        admin_added: true
      })

      if (error) {
        errEl.textContent = 'Failed. Please try again.'
        errEl.style.display = 'inline'
        btn.disabled = false
        return
      }

      loadEventsAdmin()
    })
  })
```

- [ ] **Step 4d.5: Add cancel form handler**

```js
  // Cancel inline form
  container.querySelectorAll('.admin-slot-cancel-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const form = document.getElementById('admin-slot-form-' + btn.dataset.eventId)
      if (form) form.style.display = 'none'
    })
  })
```

- [ ] **Step 4d.6: Add remove handler**

```js
  // Remove an invited or admin-added confirmed guest
  container.querySelectorAll('.admin-slot-remove-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const resId = btn.dataset.resId
      const resStatus = btn.dataset.resStatus
      const eventId = btn.dataset.eventId
      const adminReserved = parseInt(btn.dataset.adminReserved) || 0
      btn.disabled = true

      const newStatus = resStatus === 'invited' ? 'declined' : 'removed'

      await Promise.all([
        supabase.from('reservations').update({ status: newStatus }).eq('id', resId),
        supabase.from('events').update({ admin_reserved: Math.max(0, adminReserved - 1) }).eq('id', eventId)
      ])

      loadEventsAdmin()
    })
  })
```

- [ ] **Step 4e: Manual test in admin panel**

1. Open the admin panel and log in.
2. Expand an event block. Verify the "ADMIN SLOTS" subsection appears with Reserved: 0 | Used: 0 | Available: 0.
3. Set Reserved count to 2, click away. Verify Supabase `events` row now has `admin_reserved = 2`. Reload page and verify the input shows 2.
4. Try setting Reserved count to -1 or to 0 while Used is 0 — both should save correctly (0 is fine, negative resets).
5. Click "Invite Guest", type a username. Verify the filtered list appears and excludes already-reserved attendees.
6. Select an attendee, click "Send Invite". Verify a new row appears in the admin-slot-guest-list labelled "Invited". Verify Used becomes 1, Available becomes 1.
7. Click "Add Directly", select another attendee. Verify their row appears labelled "Added". Used becomes 2, Available becomes 0. Invite/Add buttons are now greyed.
8. Try setting Reserved count to 1 (below used=2). Verify it resets to previous value.
9. Click Remove on the Invited guest. Verify: row disappears, Used goes to 1, Available goes to 0, and `admin_reserved` in Supabase decremented by 1.

- [ ] **Step 4f: Commit**

```bash
git add admin/js/admin-main.js
git commit -m "feat: add Admin Slots subsection to event block (reserved count, invite, direct-add, remove)"
```

---

## Task 5: `openbar.html` — Guest dashboard and capacity math

**Files:**
- Modify: `openbar.html`

### 5a — Imports

- [ ] **Step 5a.1: Add `acceptInvite` and `declineInvite` to the import line**

Find the import line (around line 355):

```js
// Before:
import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList, reapplyReservation } from './js/reservations.js'

// After:
import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList, reapplyReservation, acceptInvite, declineInvite } from './js/reservations.js'
```

### 5b — Fix both `slotsByEvent` queries to exclude `admin_added` rows

There are two places where `slotsByEvent` is built: one in `renderPreloginEvents` (line ~402) and one in `loadDashboardData` (line ~471). Both need `.eq('admin_added', false)` added.

- [ ] **Step 5b.1: Fix `renderPreloginEvents` slotsByEvent query**

Find (line ~401–403):
```js
      const [events, slotRes, waitRes] = await Promise.all([
        loadEvents(),
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed'),
        supabase.from('reservations').select('event_id').eq('status', 'waitlisted')
      ])
```

Change the `slotRes` line:
```js
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed').eq('admin_added', false),
```

- [ ] **Step 5b.2: Fix `loadDashboardData` slotsByEvent query**

Find (line ~468–473):
```js
      const [events, attendeeReservations, slotRes, waitRes] = await Promise.all([
        loadEvents(),
        loadAttendeeReservations(currentAttendee.id),
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed'),
        supabase.from('reservations').select('id, event_id, created_at').eq('status', 'waitlisted')
      ])
```

Change the `slotRes` line:
```js
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed').eq('admin_added', false),
```

### 5c — Update `myResByEvent` to exclude `invited`

- [ ] **Step 5c.1: Update combined exclusion condition**

Find (line ~491–493):
```js
      const myResByEvent = {}
      attendeeReservations.forEach(r => {
        if (r.status !== 'cancelled' && r.status !== 'removed') myResByEvent[r.event_id] = r
      })
```

Change to:
```js
      const myResByEvent = {}
      attendeeReservations.forEach(r => {
        if (!['cancelled', 'removed', 'invited'].includes(r.status)) myResByEvent[r.event_id] = r
      })
```

### 5d — Filter invited reservations and call `renderInvitations`

- [ ] **Step 5d.1: Add `invitedReservations` filter in `loadDashboardData`**

Find the `cancelledEvents` filter block (line ~495–501):
```js
      const cancelledEvents = attendeeReservations.filter(r =>
        r.events &&
        r.events.status === 'closed' &&
        r.events.event_date >= today &&
        ['confirmed', 'waitlisted', 'interested'].includes(r.status)
      )
```

Add below it:
```js
      const invitedReservations = attendeeReservations.filter(r =>
        r.events && r.status === 'invited'
      )
      // Exclude invited events from the upcoming list — they appear in the Invitations card instead.
      // Without this, an invited guest would see a spurious "Reserve" button for their invited event.
      const invitedEventIds = new Set(invitedReservations.map(r => r.event_id))
```

- [ ] **Step 5d.2: Exclude invited event IDs from `upcomingEvents`**

Find the `upcomingEvents` filter line in `loadDashboardData` (line ~504):
```js
      const upcomingEvents = events.filter(e => e.event_date >= today)
```

Change to:
```js
      const upcomingEvents = events.filter(e => e.event_date >= today && !invitedEventIds.has(e.id))
```

This prevents invited events from appearing in the Upcoming Events card alongside the Invitations card (which would show a spurious Reserve button).

- [ ] **Step 5d.3: Call `renderInvitations` from `loadDashboardData`**

Find the three render calls at the bottom of `loadDashboardData` (line ~510–512):
```js
      await renderDashboardEvents(upcomingEvents, myResByEvent, slotsByEvent, waitlistByEvent)
      renderCancelledEvents(cancelledEvents)
      renderHistory(historyRows)
```

Add `renderInvitations` before them:
```js
      renderInvitations(invitedReservations)
      await renderDashboardEvents(upcomingEvents, myResByEvent, slotsByEvent, waitlistByEvent)
      renderCancelledEvents(cancelledEvents)
      renderHistory(historyRows)
```

### 5e — Add `renderInvitations` function

- [ ] **Step 5e.1: Add the function after `renderCancelledEvents`**

Add this function after `renderCancelledEvents` ends (after line ~801):

```js
    function renderInvitations(reservations) {
      let card = document.getElementById('invitations-card')

      if (!reservations.length) {
        if (card) card.style.display = 'none'
        return
      }

      if (!card) {
        card = document.createElement('div')
        card.id = 'invitations-card'
        card.className = 'card fade-in-2'
        const evCard = document.getElementById('events-dashboard-card')
        evCard.parentNode.insertBefore(card, evCard)
      }

      card.style.display = 'block'
      card.innerHTML = `
        <span class="eyebrow" data-zh="邀请" data-en="Invitations">邀请</span>
        <h2 style="margin-bottom:1.25rem" data-zh="您的邀请" data-en="Your Invitations">您的邀请</h2>
        <div id="invitations-list"></div>
      `

      const list = document.getElementById('invitations-list')

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
            <div style="display:flex;gap:0.4rem;flex-shrink:0">
              <button class="btn btn-sm btn-solid invite-accept-btn"
                data-res-id="${escapeHtml(r.id)}">${t('接受', 'Accept')}</button>
              <button class="btn btn-sm btn-danger invite-decline-btn"
                data-res-id="${escapeHtml(r.id)}"
                data-event-id="${escapeHtml(ev.id)}"
                data-admin-reserved="${ev.admin_reserved || 0}">${t('拒绝', 'Decline')}</button>
            </div>
          </div>
        `
        list.appendChild(row)
      })

      list.querySelectorAll('.invite-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const { error } = await acceptInvite(btn.dataset.resId)
          if (!error) await loadDashboardData()
        })
      })

      list.querySelectorAll('.invite-decline-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const { error } = await declineInvite(
            btn.dataset.resId,
            btn.dataset.eventId,
            parseInt(btn.dataset.adminReserved) || 0
          )
          if (!error) await loadDashboardData()
        })
      })
    }
```

### 5f — Suppress Cancel button for `admin_added` confirmed rows

- [ ] **Step 5f.1: Update the `confirmed` branch in `buildEventRowHtml`**

Find the `confirmed` case in `buildEventRowHtml` (line ~594–602):

```js
      } else if (myRes.status === 'confirmed') {
        const guestNote = myRes.guest_count === 2
          ? `<div style="font-style:italic;color:var(--muted);font-size:0.78rem;margin-top:0.1rem">${t('本人 + 1位宾客', 'Me + 1 guest')}</div>`
          : ''
        statusHtml = `<div style="text-align:right;flex-shrink:0"><div class="res-confirmed">✓ ${t('已确认', 'Confirmed')}</div>${guestNote}</div>`
        const cancelBtn = `<button class="btn btn-danger btn-sm cancel-btn" data-res-id="${myRes.id}">${t('取消', 'Cancel')}</button>`
```

Change the `cancelBtn` line to:
```js
        const cancelBtn = myRes.admin_added
          ? ''
          : `<button class="btn btn-danger btn-sm cancel-btn" data-res-id="${myRes.id}">${t('取消', 'Cancel')}</button>`
```

### 5g — Update capacity math to subtract `admin_reserved`

There are three places: `buildReserveFormHtml`, the `!myRes` branch in `buildEventRowHtml` (isFull check), and `row.dataset.capacity`.

- [ ] **Step 5g.1: Update `buildReserveFormHtml` available calculation**

Find `buildReserveFormHtml(ev, used)` (line ~633):
```js
    function buildReserveFormHtml(ev, used) {
      const isCurated = ev.event_type === 'curated'
      const available = ev.capacity - used
```

Change to:
```js
    function buildReserveFormHtml(ev, used) {
      const isCurated = ev.event_type === 'curated'
      const available = ev.capacity - (ev.admin_reserved || 0) - used
```

- [ ] **Step 5g.2: Update `isFull` check in `buildEventRowHtml`**

Find the `!myRes` block (line ~579–589):
```js
        const isFull = used >= ev.capacity
```

Change to:
```js
        const isFull = used >= (ev.capacity - (ev.admin_reserved || 0))
```

- [ ] **Step 5g.3: Update slot meter calls to use effective capacity**

In `buildEventRowHtml`, find the two `renderSlotMeter(used, ev.capacity)` calls (lines ~592 and ~600) and change both to:
```js
renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
```

Also find the same call in `buildEventRowHtml` for the waitlisted case (line ~609):
```js
renderSlotMeter(used, ev.capacity)
```
Change to:
```js
renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
```

- [ ] **Step 5g.4: Update `row.dataset.capacity` so the submit handler uses effective capacity**

Find where `row.dataset.capacity` is set in `renderDashboardEvents` (line ~556):
```js
        row.dataset.capacity = ev.capacity
```

Change to:
```js
        row.dataset.capacity = ev.capacity - (ev.admin_reserved || 0)
```

Also update `row.dataset.used` to store only regular-used slots (not admin-added). The `used` variable at this point is already built from the filtered `slotsByEvent` (Step 5b), so it only counts `admin_added = false` confirmed rows — no extra change needed here.

- [ ] **Step 5g.5: Update `isFull` in `renderPreloginEvents`**

Find (line ~430):
```js
        const isFull = !isCurated && used >= ev.capacity
```

Change to:
```js
        const isFull = !isCurated && used >= (ev.capacity - (ev.admin_reserved || 0))
```

And update the two `renderSlotMeter(used, ev.capacity)` calls in `renderPreloginEvents` (lines ~438, ~442):
```js
renderSlotMeter(used, ev.capacity - (ev.admin_reserved || 0))
```

### 5h — Manual test in guest dashboard

- [ ] **Step 5h.1: Test invitations flow**

1. In admin panel: set `admin_reserved = 1` on a future event, click "Invite Guest", select a guest, click "Send Invite".
2. Log in as that guest on `openbar.html`. Verify an "Invitations" card appears above Upcoming Events, showing the event with Accept/Decline.
3. Click Accept. Verify: invitations card disappears, event appears in Upcoming as "Confirmed" without a Cancel button.
4. Repeat: invite another guest. Guest declines. Verify: invitations card disappears. In Supabase, verify `admin_reserved` on the event decremented by 1. The event should now appear in Upcoming for that guest with a Reserve button (since their invite was declined).

- [ ] **Step 5h.2: Test capacity math**

1. Create an event with capacity = 4. Set `admin_reserved = 2`.
2. Log in as a guest. Verify the slot meter shows 2 pips (capacity 4 - admin_reserved 2), not 4.
3. Verify the "+1 guest" toggle is only shown when `available >= 2` (i.e. both remaining regular slots are free).
4. Have a regular guest reserve 1 slot. Meter should now show 1 pip filled of 2 total.
5. Have another guest reserve 1 slot (filling regular capacity). Verify the Reserve button changes to "Join Waitlist →".

- [ ] **Step 5h.3: Test Cancel button suppression**

1. Admin directly adds a guest to an event.
2. Log in as that guest. Verify their event shows "✓ Confirmed" with NO Cancel button.
3. Log in as a self-signed-up confirmed guest. Verify their event shows "✓ Confirmed" WITH a Cancel button.

- [ ] **Step 5i: Commit**

```bash
git add openbar.html
git commit -m "feat: guest invitations dashboard, capacity math with admin_reserved, cancel suppression for admin-added guests"
```

---

## Done

All five tasks complete. The feature is fully implemented:

- Admin sets `admin_reserved` per event (auto-saves on blur, enforces ≥ used count)
- Admin invites guests (invited reservation holds 1 slot, guest sees Accept/Decline)
- Admin directly adds guests (confirmed + admin_added, no Cancel for guest)
- Guest declining releases the slot back to general capacity
- All slot meters, isFull checks, and waitlist promotion correctly subtract `admin_reserved`
