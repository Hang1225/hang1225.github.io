# Reservation System & Attendance Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event reservation (open + curated), attendance history, and configurable gender-aware guest lists to the Open Bar feature.

**Architecture:** All business logic lives in client-side JS, matching existing patterns. Two new ES-module files (`js/events.js`, `js/reservations.js`) encapsulate all Supabase calls for events/reservations. A PostgreSQL trigger in Supabase handles waitlist promotion atomically. `openbar.html` and `admin/index.html` are updated inline; `admin/js/admin-main.js` gets new event management functions.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS SDK v2, PostgreSQL (Supabase), HTML/CSS — no build step, no test framework.

**Spec:** `docs/superpowers/specs/2026-03-18-reservation-attendance-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `js/events.js` | `loadEvents()` — fetch all non-cancelled events |
| Create | `js/reservations.js` | All reservation CRUD + guest list masking |
| Modify | `js/auth.js:31` | Extend `loginAttendee` select to include `gender`, `gender_visibility` |
| Modify | `openbar.html` | CSS additions; pre-login events section; dashboard Events + History cards |
| Modify | `admin/index.html` | Events tab HTML; Signups tab gender controls |
| Modify | `admin/js/admin-main.js` | Events tab JS; Signups gender save handlers |
| Create | `docs/migrations/2026-03-18-reservation-system.sql` | All DB changes (run once in Supabase SQL editor) |

---

## Task 1: Database Migration

**Files:**
- Create: `docs/migrations/2026-03-18-reservation-system.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Migration: Reservation System & Attendance Tracking
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Events table
create table events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_date    date not null,
  capacity      integer not null default 6,
  status        text not null default 'open'
                  check (status in ('open', 'closed', 'cancelled')),
  event_type    text not null default 'open'
                  check (event_type in ('open', 'curated')),
  show_count    boolean not null default false,
  show_names    boolean not null default false,
  show_gender   boolean not null default false,
  created_at    timestamptz default now()
);

-- 2. Reservations table
create table reservations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  attendee_id   uuid references attendees(id) on delete cascade,
  guest_count   integer not null default 1 check (guest_count in (1, 2)),
  message       text,
  status        text not null default 'confirmed'
                  check (status in (
                    'confirmed', 'waitlisted', 'interested',
                    'cancelled', 'declined', 'removed'
                  )),
  created_at    timestamptz default now()
);

-- 3. Extend attendees
alter table attendees
  add column gender text
    check (gender in ('male', 'female', 'non-binary') or gender is null),
  add column gender_visibility text not null default 'admin_only'
    check (gender_visibility in ('admin_only', 'public'));

-- 4. Enable RLS
alter table events enable row level security;
alter table reservations enable row level security;

-- 5. RLS: events
create policy "public read events"
  on events for select to anon
  using (status != 'cancelled');

create policy "admin full access events"
  on events for all to authenticated
  using (true);

-- 6. RLS: reservations
-- NOTE: Custom auth (username+PIN, no JWT) means row-level ownership
-- cannot be enforced at DB level. Client filters by attendee_id from session.
-- 'cancelled' is the only status a guest may write via update.
create policy "public insert reservations"
  on reservations for insert
  with check (status in ('confirmed', 'waitlisted', 'interested'));

create policy "anon read all reservations"
  on reservations for select
  using (true);

create policy "guest cancel reservation"
  on reservations for update
  using (true)
  with check (status = 'cancelled');

create policy "admin full access reservations"
  on reservations for all to authenticated
  using (true);

-- 7. Waitlist auto-promotion trigger (open events only)
create or replace function promote_waitlist()
returns trigger as $$
declare
  used_slots  integer;
  event_cap   integer;
  ev_type     text;
  avail       integer;
  rec         record;
begin
  if new.status in ('cancelled', 'declined', 'removed')
     and old.status not in ('cancelled', 'declined', 'removed') then

    select capacity, event_type into event_cap, ev_type
      from events where id = new.event_id;

    if ev_type != 'open' then return new; end if;

    select coalesce(sum(guest_count), 0) into used_slots
      from reservations
     where event_id = new.event_id and status = 'confirmed';

    avail := event_cap - used_slots;

    for rec in
      select * from reservations
       where event_id = new.event_id and status = 'waitlisted'
       order by created_at asc
    loop
      if avail >= rec.guest_count then
        update reservations set status = 'confirmed' where id = rec.id;
        avail := avail - rec.guest_count;
      end if;
      -- skip entries that don't fit; continue to next
    end loop;

  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_promote_waitlist
after update on reservations
for each row execute function promote_waitlist();
```

- [ ] **Step 2: Run the migration**

Go to Supabase Dashboard → SQL Editor → paste the full file contents → Run.

Expected: no errors. Check Table Editor — `events` and `reservations` tables appear. `attendees` table has `gender` and `gender_visibility` columns.

- [ ] **Step 3: Verify trigger exists**

In SQL Editor run:
```sql
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where trigger_name = 'trigger_promote_waitlist';
```
Expected: 1 row returned.

- [ ] **Step 4: Commit the migration file**

```bash
git add docs/migrations/2026-03-18-reservation-system.sql
git commit -m "feat: add events, reservations tables and waitlist trigger"
```

---

## Task 2: `js/events.js`

**Files:**
- Create: `js/events.js`

- [ ] **Step 1: Create the file**

```js
import { supabase } from './supabase-client.js'

// Returns all non-cancelled events ordered by event_date ASC.
// Includes all events (past + future) — callers filter by date as needed.
export async function loadEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true })
  return error ? [] : data
}
```

- [ ] **Step 2: Verify in browser console**

Open any page on the site (passcode required), open DevTools console, run:
```js
import('/js/events.js').then(m => m.loadEvents().then(console.log))
```
Expected: empty array `[]` (no events yet) — no errors.

- [ ] **Step 3: Commit**

```bash
git add js/events.js
git commit -m "feat: add loadEvents() module"
```

---

## Task 3: `js/reservations.js`

**Files:**
- Create: `js/reservations.js`

- [ ] **Step 1: Create the file**

```js
import { supabase } from './supabase-client.js'

// --- ADMIN ---

// Returns all reservations for an event with attendee data (admin use).
// Ordered by created_at ASC (waitlist position is determined by this order).
export async function loadEventReservations(eventId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, attendees(username, alias, gender, gender_visibility)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return error ? [] : data
}

// --- GUEST-FACING ---

// Returns masked guest list data for a single event according to its display flags.
// Returns null if no display flags are set (guest list hidden).
// showGender only reveals gender for attendees with gender_visibility = 'public'.
export async function loadEventGuestList(eventId, showCount, showNames, showGender) {
  if (!showCount && !showNames && !showGender) return null

  const { data, error } = await supabase
    .from('reservations')
    .select('id, guest_count, attendees(alias, username, gender, gender_visibility)')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })

  if (error) return null
  const confirmed = data || []

  return {
    count: showCount
      ? confirmed.reduce((sum, r) => sum + r.guest_count, 0)
      : null,
    guests: confirmed.map(r => ({
      name: showNames ? (r.attendees.alias || r.attendees.username) : null,
      gender: showGender && r.attendees.gender_visibility === 'public'
        ? r.attendees.gender
        : null,
      guestCount: r.guest_count
    }))
  }
}

// Returns all reservations for a given attendee, joined with event data.
// Used for both the dashboard (upcoming) and history (past).
export async function loadAttendeeReservations(attendeeId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, events(id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender)')
    .eq('attendee_id', attendeeId)
  return error ? [] : data
}

// Inserts a reservation. status must be 'confirmed', 'waitlisted', or 'interested'.
// For open events: guestCount is 1 or 2. For curated: guestCount is 1 (default).
// message is optional (pass null if empty).
export async function createReservation(eventId, attendeeId, guestCount, message, status) {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      event_id: eventId,
      attendee_id: attendeeId,
      guest_count: guestCount,
      message: message || null,
      status
    })
    .select()
    .single()
  return { data, error }
}

// Sets reservation status to 'cancelled'. Used by both open-event cancellation
// and curated-event interest withdrawal.
export async function cancelReservation(reservationId) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
  return { error }
}
```

- [ ] **Step 2: Verify in browser console**

```js
import('/js/reservations.js').then(m =>
  m.loadAttendeeReservations('00000000-0000-0000-0000-000000000000').then(console.log)
)
```
Expected: `[]` — no errors.

- [ ] **Step 3: Commit**

```bash
git add js/reservations.js
git commit -m "feat: add reservations module (loadEventReservations, loadEventGuestList, createReservation, cancelReservation)"
```

---

## Task 4: Update `js/auth.js`

**Files:**
- Modify: `js/auth.js:31`

The `loginAttendee` function currently selects `id, username, alias, credits`. Extend it to include `gender` and `gender_visibility` so the session object contains these fields for any future guest-facing gender logic.

- [ ] **Step 1: Edit the select on line 31**

Change:
```js
    .select('id, username, alias, credits')
```
To:
```js
    .select('id, username, alias, credits, gender, gender_visibility')
```

- [ ] **Step 2: Verify login still works**

Open `openbar.html` in browser. Log in with an existing attendee account. Open DevTools → Application → Session Storage → look for key `hb_attendee`. Expected: the stored JSON now contains `gender: null, gender_visibility: "admin_only"` alongside existing fields.

- [ ] **Step 3: Commit**

```bash
git add js/auth.js
git commit -m "feat: extend loginAttendee to include gender and gender_visibility"
```

---

## Task 5: `openbar.html` — CSS + pre-login events section

**Files:**
- Modify: `openbar.html`

This task adds the CSS for all new event/reservation UI components and the pre-login events listing that appears below the login form for all passcode-holders.

- [ ] **Step 1: Add CSS to the `<style>` block in `openbar.html`**

Append the following inside the existing `<style>` block (after the last existing rule):

```css
/* ---- EVENTS (pre-login public cards) ---- */
.event-public-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 1.35rem;
  margin-bottom: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  position: relative;
}
.event-public-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(201,168,76,0.025), transparent 55%);
  pointer-events: none;
  border-radius: var(--radius);
}
.event-date {
  font-family: 'Cinzel', serif;
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  color: var(--gold);
  margin-bottom: 0.12rem;
}
.event-title-text {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  color: var(--cream);
}
.event-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
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
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-left: 0.3rem;
}
.badge-curated {
  background: rgba(184,156,216,0.12);
  border: 1px solid rgba(184,156,216,0.3);
  color: #B89CD8;
}

/* ---- EVENT ROWS (dashboard Events card) ---- */
.event-row {
  padding: 1rem 0;
  border-bottom: 1px solid rgba(201,168,76,0.07);
}
.event-row:last-child { border-bottom: none; padding-bottom: 0; }
.event-row-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.res-confirmed { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.1em; color: var(--green); }
.res-waitlisted { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.1em; color: #C9A030; }
.res-interested { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.1em; color: #B89CD8; }
.event-note { font-style: italic; color: var(--muted); font-size: 0.83rem; margin-top: 0.45rem; }
.event-note span { color: var(--text); }
.btn-ghost { border-color: var(--border); color: var(--muted); background: transparent; }
.badge-green { background: rgba(106,158,120,0.12); border-color: rgba(106,158,120,0.3); color: var(--green); }
.badge-red   { background: rgba(192,96,96,0.12);   border-color: rgba(192,96,96,0.3);   color: #c06060; }
.badge-muted { background: rgba(106,94,74,0.1);    border-color: rgba(106,94,74,0.25);  color: var(--muted); }

/* ---- INLINE RESERVATION FORM ---- */
.inline-form {
  display: none;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(201,168,76,0.08);
}
.form-sublabel {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  color: var(--muted);
  display: block;
  margin-bottom: 0.35rem;
}
.guest-toggle { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.65rem; }
.guest-opt {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  background: transparent;
}
.guest-opt.active { border-color: var(--gold); color: var(--gold); background: rgba(201,168,76,0.07); }
textarea.event-message {
  width: 100%;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(201,168,76,0.14);
  border-radius: var(--radius);
  padding: 0.65rem 1rem;
  color: var(--text);
  font-family: 'Cormorant Garamond', serif;
  font-size: 1rem;
  margin-bottom: 0.75rem;
  resize: vertical;
  min-height: 68px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
textarea.event-message:focus {
  border-color: var(--gold-dim);
  background: rgba(201,168,76,0.04);
}
textarea.event-message::placeholder { color: var(--muted); font-style: italic; }
.form-hint { font-style: italic; color: var(--muted); font-size: 0.85rem; margin-bottom: 0.7rem; }

/* ---- HISTORY ---- */
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0;
  border-bottom: 1px solid rgba(201,168,76,0.07);
  gap: 1rem;
  flex-wrap: wrap;
}
.history-row:last-child { border-bottom: none; }
.history-date {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  color: var(--muted);
  margin-bottom: 0.1rem;
}

/* ---- GUEST LIST DISPLAY ---- */
.event-guest-list {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(201,168,76,0.07);
}
.event-guest-label {
  font-family: 'Cinzel', serif;
  font-size: 0.48rem;
  letter-spacing: 0.14em;
  color: var(--muted);
  display: block;
  margin-bottom: 0.45rem;
}
.guest-pills { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.guest-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.24rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.88rem;
  color: var(--text);
}
.g-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.42rem;
  letter-spacing: 0.06em;
  padding: 0.08rem 0.32rem;
  border-radius: 2px;
  display: inline-block;
}
.g-m { background: rgba(100,140,200,0.15); border: 1px solid rgba(100,140,200,0.3); color: #8AABE0; }
.g-f { background: rgba(200,120,160,0.15); border: 1px solid rgba(200,120,160,0.3); color: #D888B0; }
.g-nb { background: rgba(140,160,120,0.15); border: 1px solid rgba(140,160,120,0.3); color: #A0BE90; }
.g-hidden { background: rgba(106,94,74,0.1); border: 1px solid rgba(106,94,74,0.2); color: var(--muted); }
```

- [ ] **Step 2: Add pre-login events HTML to `#auth-section`**

In `openbar.html`, locate the closing `</div>` of `<div class="auth-container fade-in-2">` (around line 108). After it, before the closing `</div>` of `#auth-section`, insert:

```html
      <div class="rule fade-in-3"><span>◆</span></div>
      <div id="events-prelogin" class="fade-in-4">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:0.75rem">
          <span class="eyebrow" data-zh="即将举办" data-en="Upcoming Events" style="margin-bottom:0">即将举办</span>
          <span style="font-style:italic;color:var(--muted);font-size:0.88rem" data-zh="登录后预订" data-en="Sign in to reserve">登录后预订</span>
        </div>
        <div id="events-prelogin-list"></div>
      </div>
```

- [ ] **Step 3: Add pre-login events imports and rendering to the inline `<script type="module">`**

In the `<script type="module">` block, add the imports after the existing ones. Note: `supabase` is already imported at line 138 of `openbar.html` (`import { supabase } from './js/supabase-client.js'`) — do **not** add a duplicate import; the new functions that call `supabase` directly will use this existing import.

```js
    import { loadEvents } from './js/events.js'
    import { createReservation, cancelReservation, loadAttendeeReservations, loadEventGuestList } from './js/reservations.js'
```

Then add these helper functions and the `renderPreloginEvents` call. Add them **before** the `// Auth tabs` comment:

```js
    // ---- HELPERS ----

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

    function renderGenderBadge(gender) {
      if (!gender) return `<span class="g-badge g-hidden">—</span>`
      const cls = { male: 'g-m', female: 'g-f', 'non-binary': 'g-nb' }[gender] || 'g-hidden'
      const label = { male: 'M', female: 'F', 'non-binary': 'NB' }[gender] || '—'
      return `<span class="g-badge ${cls}">${label}</span>`
    }

    function formatEventDate(dateStr) {
      // dateStr is 'YYYY-MM-DD' — append time to avoid timezone shift
      const d = new Date(dateStr + 'T12:00:00')
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
      return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    }

    // ---- PRE-LOGIN EVENTS ----

    async function renderPreloginEvents() {
      const today = new Date().toISOString().split('T')[0]

      const [events, slotRes, waitRes] = await Promise.all([
        loadEvents(),
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed'),
        supabase.from('reservations').select('event_id').eq('status', 'waitlisted')
      ])

      // Aggregate slot usage and waitlist counts
      const slotsByEvent = {}
      ;(slotRes.data || []).forEach(r => {
        slotsByEvent[r.event_id] = (slotsByEvent[r.event_id] || 0) + r.guest_count
      })
      const waitByEvent = {}
      ;(waitRes.data || []).forEach(r => {
        waitByEvent[r.event_id] = (waitByEvent[r.event_id] || 0) + 1
      })

      const upcoming = events.filter(e => e.event_date >= today)
      const container = document.getElementById('events-prelogin-list')

      if (!upcoming.length) {
        container.innerHTML = `<p class="muted" style="font-style:italic">${t('暂无即将举办的活动', 'No upcoming events')}</p>`
        return
      }

      container.innerHTML = ''
      upcoming.forEach(ev => {
        const used = slotsByEvent[ev.id] || 0
        const waitCount = waitByEvent[ev.id] || 0
        const isCurated = ev.event_type === 'curated'
        const isFull = !isCurated && used >= ev.capacity

        let slotHtml = ''
        let ctaKey = ''
        if (isCurated) {
          slotHtml = `<span class="badge badge-curated">${t('策划活动 · 邀请制', 'Curated · By Invitation')}</span>`
          ctaKey = t('登录后表达意愿', 'Sign In to Express Interest')
        } else if (isFull) {
          slotHtml = renderSlotMeter(used, ev.capacity)
          if (waitCount) slotHtml += ` <span class="badge" style="margin-left:0.3rem">${waitCount} ${t('人等候', 'on waitlist')}</span>`
          ctaKey = t('登录加入等候', 'Sign In to Join Waitlist')
        } else {
          slotHtml = renderSlotMeter(used, ev.capacity)
          ctaKey = t('登录预订', 'Sign In to Reserve')
        }

        const card = document.createElement('div')
        card.className = 'event-public-card'
        card.innerHTML = `
          <div>
            <div class="event-date">${escapeHtml(formatEventDate(ev.event_date))}</div>
            <div class="event-title-text">${escapeHtml(ev.title)}</div>
            <div class="event-meta">${slotHtml}</div>
          </div>
          <button class="btn btn-sm" style="opacity:0.55;cursor:default;border-color:var(--border);color:var(--muted)">${escapeHtml(ctaKey)}</button>
        `
        container.appendChild(card)
      })
    }

    renderPreloginEvents()
```

- [ ] **Step 4: Verify in browser**

Open `openbar.html`. Below the login/signup form, the events section should appear. With no events in the DB yet: "No upcoming events" message. Create a test event in Supabase Table Editor (set `event_date` to a future date, `status = 'open'`, `event_type = 'open'`). Reload — it should appear with an empty slot meter and "Sign In to Reserve" button.

- [ ] **Step 5: Commit**

```bash
git add openbar.html
git commit -m "feat: add pre-login events listing to openbar page"
```

---

## Task 6: `openbar.html` — Dashboard Events card + History card

**Files:**
- Modify: `openbar.html`

Adds the Events card (Option B: events + inline reservation status) and Attendance History card to the post-login dashboard, before the existing Wishlist card.

- [ ] **Step 1: Add Events and History card HTML to `#dashboard-section`**

In `openbar.html`, locate the `<div class="rule"><span>◆</span></div>` inside `#dashboard-section`. After the rule, **before** the existing Wishlist card (`<div class="card fade-in-2">...`), insert:

```html
        <div class="card fade-in-2" id="events-dashboard-card">
          <span class="eyebrow" data-zh="即将举办" data-en="Upcoming Events">即将举办</span>
          <h2 style="margin-bottom:1.25rem" data-zh="活动预订" data-en="Upcoming Events">活动预订</h2>
          <div id="events-dashboard-list"></div>
        </div>

        <div class="card fade-in-3" id="history-card">
          <span class="eyebrow" data-zh="过往记录" data-en="History">过往记录</span>
          <h2 style="margin-bottom:1.25rem" data-zh="出席记录" data-en="Attendance History">出席记录</h2>
          <div id="history-list"></div>
        </div>
```

Also update the existing Wishlist card's class from `fade-in-2` to `fade-in-4`.

- [ ] **Step 2: Add dashboard events + history JS to the inline script**

Add the following functions inside the `<script type="module">` block. Place them after `renderPreloginEvents()` and before `// Restore session`:

```js
    // ---- DASHBOARD EVENTS + HISTORY ----

    async function loadDashboardData() {
      const today = new Date().toISOString().split('T')[0]

      const [events, attendeeReservations, slotRes, waitRes] = await Promise.all([
        loadEvents(),
        loadAttendeeReservations(currentAttendee.id),
        supabase.from('reservations').select('event_id, guest_count').eq('status', 'confirmed'),
        supabase.from('reservations').select('id, event_id, created_at').eq('status', 'waitlisted')
      ])

      // Slot usage by event (all attendees)
      const slotsByEvent = {}
      ;(slotRes.data || []).forEach(r => {
        slotsByEvent[r.event_id] = (slotsByEvent[r.event_id] || 0) + r.guest_count
      })

      // Waitlist positions by event (sorted by created_at ASC, position = index + 1)
      const waitlistByEvent = {}
      ;(waitRes.data || []).forEach(r => {
        if (!waitlistByEvent[r.event_id]) waitlistByEvent[r.event_id] = []
        waitlistByEvent[r.event_id].push(r)
      })
      Object.values(waitlistByEvent).forEach(arr => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)))

      // This attendee's reservations indexed by event_id
      const myResByEvent = {}
      attendeeReservations.forEach(r => { myResByEvent[r.event_id] = r })

      // Split: upcoming events for Events card, past reservations for History card
      const upcomingEvents = events.filter(e => e.event_date >= today)
      const historyRows = attendeeReservations
        .filter(r => r.events && r.events.event_date < today &&
          ['confirmed', 'removed', 'declined'].includes(r.status))
        .sort((a, b) => b.events.event_date.localeCompare(a.events.event_date))

      await renderDashboardEvents(upcomingEvents, myResByEvent, slotsByEvent, waitlistByEvent)
      renderHistory(historyRows)
    }

    async function renderDashboardEvents(events, myResByEvent, slotsByEvent, waitlistByEvent) {
      const container = document.getElementById('events-dashboard-list')
      if (!events.length) {
        container.innerHTML = `<p class="muted" style="font-style:italic">${t('暂无活动', 'No upcoming events')}</p>`
        return
      }

      container.innerHTML = ''

      for (const ev of events) {
        const myRes = myResByEvent[ev.id] || null
        const used = slotsByEvent[ev.id] || 0
        const isCurated = ev.event_type === 'curated'

        // Guest list section (if any show_* flag is set)
        let guestListHtml = ''
        if (ev.show_count || ev.show_names || ev.show_gender) {
          const gl = await loadEventGuestList(ev.id, ev.show_count, ev.show_names, ev.show_gender)
          if (gl) {
            let inner = ''
            if (ev.show_count && gl.count !== null) {
              const countLabel = `${gl.count} ${t('位确认', 'confirmed')}`
              inner += `<span class="event-guest-label">${t('出席', "WHO'S COMING")} · ${escapeHtml(countLabel)}</span>`
            }
            if ((ev.show_names || ev.show_gender) && gl.guests.length) {
              const pills = gl.guests.map(g => {
                const name = escapeHtml(g.name || 'Guest ◆')
                const gBadge = ev.show_gender ? ` ${renderGenderBadge(g.gender)}` : ''
                const plus = g.guestCount === 2 ? ` <span class="badge" style="font-size:0.44rem">+1</span>` : ''
                return `<span class="guest-pill">${name}${gBadge}${plus}</span>`
              }).join('')
              inner += `<div class="guest-pills">${pills}</div>`
            }
            if (inner) guestListHtml = `<div class="event-guest-list">${inner}</div>`
          }
        }

        const row = document.createElement('div')
        row.className = 'event-row'
        row.dataset.eventId = ev.id
        row.dataset.eventType = ev.event_type
        row.dataset.capacity = ev.capacity
        row.dataset.used = used

        row.innerHTML = buildEventRowHtml(ev, myRes, used, isCurated, guestListHtml, waitlistByEvent)
        container.appendChild(row)
      }

      // Attach all interaction handlers
      attachEventRowHandlers(container)
    }

    function buildEventRowHtml(ev, myRes, used, isCurated, guestListHtml, waitlistByEvent) {
      const dateStr = escapeHtml(formatEventDate(ev.event_date))
      const titleStr = escapeHtml(ev.title)
      const curatedBadge = isCurated
        ? ` <span class="badge badge-curated" style="font-size:0.46rem;vertical-align:middle">${t('策划', 'Curated')}</span>`
        : ''

      // Status / action (right side of header)
      let statusHtml = ''
      let metaHtml = ''

      if (!myRes) {
        // No reservation yet
        if (isCurated) {
          statusHtml = `<button class="btn btn-sm interest-btn" data-event-id="${ev.id}" style="border-color:#B89CD8;color:#B89CD8">${t('表达意愿 →', 'Express Interest →')}</button>`
        } else {
          const isFull = used >= ev.capacity
          if (isFull) {
            statusHtml = `<button class="btn btn-sm reserve-btn" data-event-id="${ev.id}">${t('加入等候 →', 'Join Waitlist →')}</button>`
          } else {
            statusHtml = `<button class="btn btn-sm reserve-btn" data-event-id="${ev.id}">${t('预订 →', 'Reserve →')}</button>`
          }
        }
        if (!isCurated) {
          metaHtml = `<div class="event-meta" style="margin-top:0.45rem">${renderSlotMeter(used, ev.capacity)}</div>`
        }
      } else if (myRes.status === 'confirmed') {
        const guestNote = myRes.guest_count === 2
          ? `<div style="font-style:italic;color:var(--muted);font-size:0.78rem;margin-top:0.1rem">${t('本人 + 1位宾客', 'Me + 1 guest')}</div>`
          : ''
        statusHtml = `<div style="text-align:right;flex-shrink:0"><div class="res-confirmed">✓ ${t('已确认', 'Confirmed')}</div>${guestNote}</div>`
        const cancelBtn = `<button class="btn btn-danger btn-sm cancel-btn" data-res-id="${myRes.id}">${t('取消', 'Cancel')}</button>`
        const slotMeter = isCurated ? '' : renderSlotMeter(used, ev.capacity)
        const noteHtml = myRes.message ? `<div class="event-note">${t('备注', 'Your note')}: <span>${escapeHtml(myRes.message)}</span></div>` : ''
        metaHtml = `<div class="event-meta" style="margin-top:0.45rem">${slotMeter}${cancelBtn}</div>${noteHtml}`
      } else if (myRes.status === 'waitlisted') {
        const waitQueue = waitlistByEvent[ev.id] || []
        const waitPos = waitQueue.findIndex(r => r.id === myRes.id) + 1
        const posLabel = waitPos > 0 ? ` #${waitPos}` : ''
        statusHtml = `<div style="text-align:right;flex-shrink:0"><div class="res-waitlisted">⏳ ${t('等候中', 'Waitlist')}${posLabel}</div></div>`
        const cancelBtn = `<button class="btn btn-danger btn-sm cancel-btn" data-res-id="${myRes.id}">${t('退出等候', 'Leave Waitlist')}</button>`
        metaHtml = `<div class="event-meta" style="margin-top:0.45rem">${renderSlotMeter(used, ev.capacity)}${cancelBtn}</div>`
      } else if (myRes.status === 'interested') {
        statusHtml = `<div style="text-align:right;flex-shrink:0"><div class="res-interested">✦ ${t('已提交意愿', 'Interest Submitted')}</div><div style="font-style:italic;color:var(--muted);font-size:0.78rem;margin-top:0.1rem">${t('等待主持人确认', 'Awaiting host selection')}</div></div>`
        const cancelBtn = `<button class="btn btn-danger btn-sm cancel-btn" data-res-id="${myRes.id}">${t('撤回', 'Withdraw')}</button>`
        const noteHtml = myRes.message ? `<div class="event-note">${t('备注', 'Your note')}: <span>${escapeHtml(myRes.message)}</span></div>` : ''
        metaHtml = `<div class="event-meta" style="margin-top:0.45rem">${cancelBtn}</div>${noteHtml}`
      }

      return `
        <div class="event-row-header">
          <div>
            <div class="event-date">${dateStr}</div>
            <div class="event-title-text">${titleStr}${curatedBadge}</div>
          </div>
          ${statusHtml}
        </div>
        ${metaHtml}
        ${guestListHtml}
        <div class="inline-form" id="form-${ev.id}">
          ${buildReserveFormHtml(ev, used)}
        </div>
      `
    }

    function buildReserveFormHtml(ev, used) {
      const isCurated = ev.event_type === 'curated'
      const available = ev.capacity - used
      const guestToggle = isCurated ? '' : `
        <span class="form-sublabel">${t('出席人数', 'GUESTS ATTENDING')}</span>
        <div class="guest-toggle">
          <button class="guest-opt active" data-count="1">${t('仅本人', 'Just me')}</button>
          ${available >= 2 ? `<button class="guest-opt" data-count="2">${t('本人 + 1位宾客', 'Me + 1 guest')}</button>` : ''}
          <span class="muted" style="font-style:italic;font-size:0.8rem">${available} ${t('位可用', 'seats available')}</span>
        </div>
      `
      const hint = isCurated
        ? `<p class="form-hint">${t('主持人将审核所有意愿并确认出席名单。', 'The host will review expressions of interest and confirm attendees.')}</p>`
        : ''
      const msgLabel = `<span class="form-sublabel">${t('备注', 'NOTE')} <span style="font-style:italic;font-family:'Cormorant Garamond',serif;letter-spacing:0;text-transform:none;font-size:0.9rem;color:var(--muted)"> — ${t('可选', 'optional')}</span></span>`
      const ctaText = isCurated ? t('提交意愿', 'Submit Interest') : t('确认预订', 'Confirm Reservation')
      // Curated CTA gets a purple inline style; open CTA gets btn-solid class
      const ctaExtraAttr = isCurated ? 'style="background:rgba(184,156,216,0.1);border-color:#B89CD8;color:#B89CD8"' : ''
      const ctaExtraClass = isCurated ? '' : ' btn-solid'

      return `
        ${guestToggle}
        ${msgLabel}
        <textarea class="event-message" placeholder="${t('给主持人留言（可选）', 'Leave a note for the host (optional)')}"></textarea>
        ${hint}
        <div style="display:flex;gap:0.5rem">
          <button ${ctaExtraAttr} class="btn${ctaExtraClass} btn-sm submit-res-btn" data-event-id="${ev.id}" data-event-type="${ev.event_type}">${ctaText}</button>
          <button class="btn btn-ghost btn-sm cancel-form-btn" data-event-id="${ev.id}">${t('取消', 'Cancel')}</button>
        </div>
        <span class="error res-error" style="display:none"></span>
      `
    }

    function attachEventRowHandlers(container) {
      // Show inline reservation/interest form
      container.querySelectorAll('.reserve-btn, .interest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = btn.dataset.eventId
          document.getElementById('form-' + eventId).style.display = 'block'
          btn.style.display = 'none'
        })
      })

      // Hide form
      container.querySelectorAll('.cancel-form-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = btn.dataset.eventId
          document.getElementById('form-' + eventId).style.display = 'none'
          const row = btn.closest('.event-row')
          const showBtn = row.querySelector('.reserve-btn, .interest-btn')
          if (showBtn) showBtn.style.display = ''
        })
      })

      // Guest count toggle (open events)
      container.querySelectorAll('.guest-toggle').forEach(toggle => {
        toggle.querySelectorAll('.guest-opt').forEach(opt => {
          opt.addEventListener('click', () => {
            toggle.querySelectorAll('.guest-opt').forEach(o => o.classList.remove('active'))
            opt.classList.add('active')
          })
        })
      })

      // Submit reservation / interest
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

          btn.disabled = false
          if (error) {
            errEl.textContent = t('操作失败，请重试', 'Something went wrong. Please try again.')
            errEl.style.display = 'block'
            return
          }

          // Reload dashboard to reflect new reservation
          await loadDashboardData()
        })
      })

      // Cancel / withdraw
      container.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true
          const { error } = await cancelReservation(btn.dataset.resId)
          btn.disabled = false
          if (!error) await loadDashboardData()
        })
      })
    }

    function renderHistory(rows) {
      const container = document.getElementById('history-list')
      if (!rows.length) {
        container.innerHTML = `<p class="muted" style="font-style:italic">${t('暂无出席记录', 'No attendance history yet')}</p>`
        return
      }
      container.innerHTML = ''
      rows.forEach(r => {
        const ev = r.events
        const statusMap = {
          confirmed: { label: t('已出席', 'Attended'), cls: 'badge-green' },
          removed:   { label: t('缺席', 'No-show'),   cls: 'badge-red'   },
          declined:  { label: t('未入选', 'Not Selected'), cls: 'badge-muted' }
        }
        const { label, cls } = statusMap[r.status] || { label: r.status, cls: 'badge-muted' }
        const curatedBadge = ev.event_type === 'curated'
          ? ` <span class="badge badge-curated" style="font-size:0.42rem;vertical-align:middle">Curated</span>`
          : ''
        const row = document.createElement('div')
        row.className = 'history-row'
        row.innerHTML = `
          <div>
            <div class="history-date">${escapeHtml(formatEventDate(ev.event_date))}</div>
            <div style="color:var(--cream)">${escapeHtml(ev.title)}${curatedBadge}</div>
          </div>
          <span class="badge ${cls}">${label}</span>
        `
        container.appendChild(row)
      })
    }
```

- [ ] **Step 3: Call `loadDashboardData()` inside `showDashboard()`**

In the existing `showDashboard(attendee)` function, find the line `currentAttendee = attendee` and add `loadDashboardData()` on the very next line. Do **not** touch the existing wishlist logic below. The targeted change is:

```js
      currentAttendee = attendee
      loadDashboardData()   // ← insert this line after currentAttendee assignment
```

The rest of `showDashboard` — including all wishlist code — remains exactly as-is.

- [ ] **Step 4: Verify in browser**

Log into an attendee account on `openbar.html`. The dashboard should show:
- **Events card** — test event appears. "Reserve →" button works: clicking expands form with guest count toggle (if open event) and optional note textarea. Submitting creates a reservation (check Supabase `reservations` table). Page reloads and shows "✓ Confirmed" with a Cancel button.
- **History card** — empty for now ("No attendance history yet").
- **Wishlist card** — still works as before.

Create a reservation, then update its status to `'removed'` in Supabase and change the `event_date` to yesterday. Reload — it should appear in History as "No-show".

- [ ] **Step 5: Commit**

```bash
git add openbar.html
git commit -m "feat: add Events card and Attendance History card to Open Bar dashboard"
```

---

## Task 7: `admin/index.html` — Events tab HTML

**Files:**
- Modify: `admin/index.html`

Adds the Events tab button and panel HTML. All event list content is rendered by JS in Task 8.

- [ ] **Step 1: Add the Events tab button**

In `admin/index.html`, find the `.tab-bar` div (around line 62). Add the Events button as the **first** button (before Menu):

```html
      <button class="tab-btn" data-tab="events">Events</button>
```

- [ ] **Step 2: Add the Events tab panel**

In `admin/index.html`, just before the `<!-- MENU TAB -->` comment, insert the Events panel:

```html
    <!-- EVENTS TAB -->
    <div class="tab-panel" id="tab-events">
      <h2>Event Management</h2>

      <!-- Create event form -->
      <div class="card" style="margin-bottom:1.5rem">
        <h3 style="margin-bottom:0.75rem">Create New Event</h3>
        <div class="form-row" style="margin-bottom:0.5rem">
          <div><label>Title</label><input type="text" id="event-title" placeholder="e.g. Spring Opening Night"></div>
          <div><label>Date</label><input type="date" id="event-date"></div>
        </div>
        <div class="form-row" style="margin-bottom:0.5rem">
          <div>
            <label>Event Type</label>
            <select id="event-type">
              <option value="open">Open — first come, first served</option>
              <option value="curated">Curated — host selects attendees</option>
            </select>
          </div>
          <div>
            <label>Capacity</label>
            <input type="number" id="event-capacity" value="6" min="1" max="99" style="width:100%">
          </div>
        </div>
        <div style="margin-bottom:0.75rem">
          <label>Guest List — show to guests</label>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.25rem">
            <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;color:var(--text);margin:0;font-family:inherit;letter-spacing:0;text-transform:none">
              <input type="checkbox" id="show-count"> Count
            </label>
            <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;color:var(--text);margin:0;font-family:inherit;letter-spacing:0;text-transform:none">
              <input type="checkbox" id="show-names"> Names
            </label>
            <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;color:var(--text);margin:0;font-family:inherit;letter-spacing:0;text-transform:none">
              <input type="checkbox" id="show-gender"> Gender
            </label>
          </div>
        </div>
        <button class="btn" id="create-event-btn">Create Event</button>
        <p id="event-create-status" style="margin-top:0.5rem"></p>
      </div>

      <!-- Events list (rendered by JS) -->
      <div id="events-admin-list"></div>
    </div>
```

- [ ] **Step 3: Add Events tab CSS to `admin/index.html` `<style>` block**

Append to the existing `<style>` block inside `admin/index.html`:

```css
    /* ---- EVENTS ADMIN ---- */
    .event-block {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 0.75rem;
      overflow: hidden;
    }
    .event-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 1.1rem;
      gap: 1rem;
      flex-wrap: wrap;
      cursor: pointer;
    }
    .event-block-header:hover { background: rgba(201,168,76,0.025); }
    .event-block-body {
      border-top: 1px solid var(--border);
      padding: 0.65rem 1.1rem;
      background: rgba(0,0,0,0.12);
    }
    .event-section-label {
      font-size: 0.75rem;
      color: var(--muted);
      font-style: italic;
      padding: 0.4rem 0 0.2rem;
    }
    .event-attendee-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 0.45rem 0;
      border-bottom: 1px solid rgba(201,168,76,0.06);
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .event-attendee-row:last-child { border-bottom: none; }
    .attendee-msg { font-style: italic; color: var(--muted); font-size: 0.82rem; margin-top: 0.1rem; }
    .btn-approve { background: rgba(80,160,80,0.15); color: #7ecf7e; border-color: rgba(80,160,80,0.3); }
    .btn-approve:hover { background: rgba(80,160,80,0.25); }
    .display-opts-inline {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .display-opts-inline label {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.78rem;
      color: var(--muted);
      margin: 0;
      font-family: inherit;
      letter-spacing: 0;
      text-transform: none;
      cursor: pointer;
    }
    /* Gender controls in Signups tab */
    .gender-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .gender-controls select {
      font-size: 0.82rem;
      padding: 0.2rem 0.4rem;
      width: auto;
      margin: 0;
    }
    .vis-toggle {
      display: flex;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .vis-opt {
      font-size: 0.72rem;
      padding: 0.2rem 0.5rem;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
    }
    .vis-opt.active {
      background: rgba(201,168,76,0.1);
      color: var(--gold);
    }
```

- [ ] **Step 4: Verify HTML renders**

Open `admin/index.html`, log in. An "Events" tab button should appear. Clicking it shows the create form. The list area is empty (JS not wired yet).

- [ ] **Step 5: Commit**

```bash
git add admin/index.html
git commit -m "feat: add Events tab HTML to admin panel"
```

---

## Task 8: `admin/js/admin-main.js` — Events tab JS

**Files:**
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Wire up create event handler**

Append to the bottom of `admin/js/admin-main.js`:

```js
document.getElementById('create-event-btn').addEventListener('click', async () => {
  const title    = document.getElementById('event-title').value.trim()
  const date     = document.getElementById('event-date').value
  const capacity = parseInt(document.getElementById('event-capacity').value)
  const type     = document.getElementById('event-type').value
  const showCount  = document.getElementById('show-count').checked
  const showNames  = document.getElementById('show-names').checked
  const showGender = document.getElementById('show-gender').checked
  const statusEl = document.getElementById('event-create-status')

  if (!title || !date || isNaN(capacity) || capacity < 1) {
    statusEl.textContent = 'Title, date, and capacity are required.'
    statusEl.className = 'error'
    return
  }

  const { error } = await supabase.from('events').insert({
    title, event_date: date, capacity, event_type: type,
    show_count: showCount, show_names: showNames, show_gender: showGender,
    status: 'open'
  })

  if (error) {
    statusEl.textContent = 'Failed to create event.'
    statusEl.className = 'error'
    return
  }

  statusEl.textContent = 'Event created!'
  statusEl.className = 'success'
  document.getElementById('event-title').value = ''
  document.getElementById('event-date').value = ''
  document.getElementById('event-capacity').value = '6'
  document.getElementById('event-type').value = 'open'
  document.getElementById('show-count').checked = false
  document.getElementById('show-names').checked = false
  document.getElementById('show-gender').checked = false
  loadEventsAdmin()
})
```

- [ ] **Step 2: Add `loadEventsAdmin` and event rendering**

Append immediately after Step 1's code block, at the bottom of `admin/js/admin-main.js`:

```js
// ============================================================
// EVENTS TAB
// ============================================================

async function loadEventsAdmin() {
  const { data: events } = await supabase
    .from('events')
    .select('*, reservations(id, status, guest_count, message, created_at, attendees(username, alias))')
    .order('event_date', { ascending: false })

  const container = document.getElementById('events-admin-list')
  if (!events || events.length === 0) {
    container.innerHTML = '<p class="muted">No events yet.</p>'
    return
  }

  container.innerHTML = ''
  events.forEach(ev => {
    const block = document.createElement('div')
    block.className = 'event-block'
    block.innerHTML = buildEventBlockHtml(ev)
    container.appendChild(block)
  })

  attachEventBlockHandlers(container)
}

function buildEventBlockHtml(ev) {
  const reservations = ev.reservations || []
  const confirmed = reservations.filter(r => r.status === 'confirmed')
  const waitlisted = reservations.filter(r => r.status === 'waitlisted')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const interested = reservations.filter(r => r.status === 'interested')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const usedSlots = confirmed.reduce((s, r) => s + r.guest_count, 0)
  const isCurated = ev.event_type === 'curated'
  const typeBadge = isCurated
    ? `<span class="badge" style="border-color:rgba(184,156,216,0.3);color:#B89CD8;font-size:0.7rem">Curated</span>`
    : `<span class="badge" style="font-size:0.7rem">Open</span>`

  const slotInfo = isCurated
    ? `${confirmed.length} confirmed`
    : `${usedSlots} / ${ev.capacity} slots`

  const displayOpts = `
    <div class="display-opts-inline" style="margin-left:0.5rem">
      <span style="font-size:0.72rem;color:var(--muted)">Show:</span>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_count"${ev.show_count ? ' checked' : ''}> Count</label>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_names"${ev.show_names ? ' checked' : ''}> Names</label>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_gender"${ev.show_gender ? ' checked' : ''}> Gender</label>
    </div>`

  const statusBadge = ev.status === 'open'
    ? `<span class="badge" style="color:var(--green);border-color:rgba(106,158,120,0.3);font-size:0.7rem">Open</span>`
    : `<span class="badge" style="font-size:0.7rem">${escapeHtml(ev.status)}</span>`

  const toggleLabel = ev.status === 'open' ? 'Close' : 'Reopen'

  // Confirmed section
  const confirmedRows = confirmed.map(r => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const plusBadge = r.guest_count === 2 ? `<span class="badge" style="margin-left:0.3rem;font-size:0.65rem">+1</span>` : ''
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong>${name}</strong> <span class="muted">@${handle}</span>${plusBadge}${msg}</div>
        <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="remove">Remove</button>
      </div>`
  }).join('')

  // Waitlist section (open events)
  const waitlistRows = waitlisted.map((r, i) => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong style="color:var(--muted)">${name}</strong> <span class="muted">@${handle}</span> <span style="font-size:0.75rem;color:#C9A030;margin-left:0.3rem">#${i + 1}</span>${msg}</div>
        <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="decline">Decline</button>
      </div>`
  }).join('')

  // Interested section (curated events)
  const interestedRows = interested.map(r => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong>${name}</strong> <span class="muted">@${handle}</span>${msg}</div>
        <div style="display:flex;gap:0.4rem;flex-shrink:0">
          <button class="btn btn-sm btn-approve res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="confirm">Confirm</button>
          <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="decline">Decline</button>
        </div>
      </div>`
  }).join('')

  const confirmedSection = confirmedRows
    ? `<div class="event-section-label">Confirmed${isCurated ? '' : ` — ${usedSlots} slots used`}</div>${confirmedRows}`
    : `<div class="event-section-label">Confirmed</div><p class="muted" style="font-size:0.85rem;padding:0.3rem 0">None yet.</p>`

  const secondarySection = isCurated
    ? (interestedRows
        ? `<div class="event-section-label" style="margin-top:0.5rem">Expressions of Interest</div>${interestedRows}`
        : `<div class="event-section-label" style="margin-top:0.5rem">Expressions of Interest</div><p class="muted" style="font-size:0.85rem;padding:0.3rem 0">None yet.</p>`)
    : (waitlistRows
        ? `<div class="event-section-label" style="margin-top:0.5rem">Waitlist</div>${waitlistRows}`
        : '')

  return `
    <div class="event-block-header" data-event-id="${escapeHtml(ev.id)}">
      <div>
        <div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.1em;font-family:'Cinzel',serif">${escapeHtml(ev.event_date)}</div>
        <div style="font-size:1.05rem;color:var(--cream);margin-top:0.1rem">${escapeHtml(ev.title)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span style="font-size:0.78rem;color:var(--muted)">${escapeHtml(slotInfo)}</span>
        ${typeBadge}
        ${statusBadge}
        ${displayOpts}
        <button class="btn btn-sm toggle-status-btn" data-event-id="${escapeHtml(ev.id)}" data-current="${escapeHtml(ev.status)}">${toggleLabel}</button>
      </div>
    </div>
    <div class="event-block-body" style="display:none">
      ${confirmedSection}
      ${secondarySection}
    </div>
  `
}

function attachEventBlockHandlers(container) {
  // Expand / collapse
  container.querySelectorAll('.event-block-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return
      const body = header.nextElementSibling
      body.style.display = body.style.display === 'none' ? 'block' : 'none'
    })
  })

  // Toggle event status (open ↔ closed)
  container.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const newStatus = btn.dataset.current === 'open' ? 'closed' : 'open'
      await supabase.from('events').update({ status: newStatus }).eq('id', btn.dataset.eventId)
      loadEventsAdmin()
    })
  })

  // Display option checkboxes (auto-save on change)
  container.querySelectorAll('.disp-opt').forEach(cb => {
    cb.addEventListener('change', async e => {
      e.stopPropagation()
      const update = { [cb.dataset.field]: cb.checked }
      await supabase.from('events').update(update).eq('id', cb.dataset.eventId)
    })
  })

  // Reservation actions (confirm / decline / remove)
  container.querySelectorAll('.res-action-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const { action, resId } = btn.dataset
      let newStatus = ''
      if (action === 'confirm') newStatus = 'confirmed'
      else if (action === 'decline') newStatus = 'declined'
      else if (action === 'remove')  newStatus = 'removed'

      if (!newStatus) return
      btn.disabled = true
      await supabase.from('reservations').update({ status: newStatus }).eq('id', resId)
      loadEventsAdmin()
    })
  })
}
```

- [ ] **Step 3: Add `loadEventsAdmin()` to `showAdmin()`**

In the existing `showAdmin()` function, find the line `document.getElementById('admin-view').style.display = 'block'` and add `loadEventsAdmin()` on the very next line. The targeted change is:

```js
  document.getElementById('admin-view').style.display = 'block'
  loadEventsAdmin()       // ← insert this line; the rest of the function is unchanged
```

The remaining calls (`loadMenuAdmin()`, `loadPendingComments()`, etc.) stay exactly as-is below this insertion.

- [ ] **Step 4: Verify in admin panel**

Open `admin/index.html`. Click Events tab. Create a test event (Open, future date, capacity 6, no display options). It should appear in the list. Click the event header — it expands to show "Confirmed: None yet." Go to `openbar.html`, reserve a spot as an attendee. Back in admin, reload Events tab — the confirmed attendee should appear with a Remove button. Click Remove — attendee disappears, trigger fires (no waitlist to promote yet). Test with the waitlist: create two attendees, have both reserve — second one should be waitlisted. Remove first — trigger should auto-promote the second to confirmed. Verify in Supabase `reservations` table.

- [ ] **Step 5: Commit**

```bash
git add admin/js/admin-main.js
git commit -m "feat: add Events tab JS to admin panel (create, expand, confirm/decline/remove reservations)"
```

---

## Task 9: Admin Signups Tab — Gender Controls

**Files:**
- Modify: `admin/js/admin-main.js`

Updates `loadSignupsAdmin()` to show a gender selector and visibility toggle per attendee row, with auto-save on change.

- [ ] **Step 1: Replace `loadSignupsAdmin()` in `admin-main.js`**

Find the existing `loadSignupsAdmin()` function and replace its body:

```js
async function loadSignupsAdmin() {
  const { data } = await supabase
    .from('attendees')
    .select('id, username, alias, gender, gender_visibility, created_at')
    .order('created_at', { ascending: false })

  const el = document.getElementById('signups-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No attendees yet.</p>'
    return
  }

  el.innerHTML = ''
  data.forEach(a => {
    const row = document.createElement('div')
    row.className = 'item-row'

    const genderVal = a.gender || ''
    const visVal    = a.gender_visibility || 'admin_only'
    // Note: the spec mentions showing a "self-reported vs admin-override" label.
    // The data model has only one `gender` column — there is no separate self-reported column.
    // Once the admin changes it, the original value is gone. We show the "(prefers not to say)"
    // label only when gender is null (the guest's default). This is the maximum precision
    // the current schema supports.
    const selfLabel = !a.gender
      ? `<span class="muted" style="font-size:0.78rem;font-style:italic"> (prefers not to say)</span>`
      : ''

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(a.alias || a.username)}</strong>
        <span class="muted"> @${escapeHtml(a.username)}</span>${selfLabel}
        <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
      <div class="gender-controls">
        <select class="gender-select" data-attendee-id="${escapeHtml(a.id)}">
          <option value=""${genderVal === '' ? ' selected' : ''}>Prefer not to say</option>
          <option value="male"${genderVal === 'male' ? ' selected' : ''}>Male</option>
          <option value="female"${genderVal === 'female' ? ' selected' : ''}>Female</option>
          <option value="non-binary"${genderVal === 'non-binary' ? ' selected' : ''}>Non-binary</option>
        </select>
        <div class="vis-toggle">
          <button class="vis-opt${visVal === 'admin_only' ? ' active' : ''}" data-attendee-id="${escapeHtml(a.id)}" data-vis="admin_only">Admin only</button>
          <button class="vis-opt${visVal === 'public' ? ' active' : ''}" data-attendee-id="${escapeHtml(a.id)}" data-vis="public">Visible to all</button>
        </div>
      </div>
    `
    el.appendChild(row)
  })

  // Gender select: auto-save on change
  el.querySelectorAll('.gender-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const update = { gender: sel.value || null }
      await supabase.from('attendees').update(update).eq('id', sel.dataset.attendeeId)
    })
  })

  // Visibility toggle: auto-save on click
  el.querySelectorAll('.vis-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const siblings = btn.closest('.vis-toggle').querySelectorAll('.vis-opt')
      siblings.forEach(s => s.classList.remove('active'))
      btn.classList.add('active')
      await supabase.from('attendees')
        .update({ gender_visibility: btn.dataset.vis })
        .eq('id', btn.dataset.attendeeId)
    })
  })
}
```

- [ ] **Step 2: Verify in admin panel**

Open `admin/index.html` → Signups tab. Each attendee row should show a gender dropdown and Admin only / Visible to all toggle. Change a gender and reload — the new value should persist (check Supabase `attendees` table). Toggle visibility and verify it saves. Attendees who haven't set gender show "(prefers not to say)".

- [ ] **Step 3: Verify guest list display in openbar.html**

1. In admin: set an attendee's gender to "Female", visibility to "Visible to all".
2. Set another attendee's gender to "Male", visibility to "Admin only".
3. Create an event with `show_names = true` and `show_gender = true`. Have both attendees reserve.
4. Log in as either attendee on `openbar.html`. The event row guest list should show: the "Female" attendee with an `F` badge; the "Male" attendee with a `—` badge (admin-only gender, not revealed).

- [ ] **Step 4: Commit**

```bash
git add admin/js/admin-main.js
git commit -m "feat: add per-attendee gender and visibility controls to Signups tab"
```

---

## Done

At this point all features are implemented:
- ✅ Open events: reserve, waitlist, cancel, auto-promotion via trigger
- ✅ Curated events: express interest, withdraw, host confirms/declines
- ✅ Guest count toggle (+1) on open event reservations
- ✅ Optional message on all reservations
- ✅ Pre-login events listing on openbar.html
- ✅ Dashboard Events card with inline reservation status and forms
- ✅ Attendance History card (Attended / No-show / Not Selected)
- ✅ Admin Events tab: create events, manage reservations, toggle display options
- ✅ Per-attendee gender assignment with admin-only / public visibility
- ✅ Guest list display respecting show_count / show_names / show_gender per event
