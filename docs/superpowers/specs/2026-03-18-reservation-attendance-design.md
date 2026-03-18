# Open Bar — Reservation System & Attendance Tracking
**Date:** 2026-03-18

---

## Overview

Add a reservation system and attendance tracking to the Open Bar feature of ERSHU.25. Guests can reserve seats for named events (or express interest in curated events), view their reservation status and attendance history on their dashboard, and see a configurable guest list per event. The host manages events, reservations, and attendee gender data through the admin panel.

---

## Data Model

### New Table: `events`

```sql
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
```

### New Table: `reservations`

```sql
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
```

**Status semantics by event type:**

| Status | Open events | Curated events |
|---|---|---|
| `confirmed` | Auto-confirmed on insert (slots available) | Admin sets after reviewing interest |
| `waitlisted` | Auto-set on insert (slots full) | Not used |
| `interested` | Not used | Guest-submitted expression of interest |
| `cancelled` | Guest cancelled their own reservation | Guest withdrew interest |
| `declined` | Admin declined a waitlisted entry | Admin declined an interested guest |
| `removed` | Admin removed a confirmed reservation (no-show) | Admin removed a confirmed attendee |

**Notes:**
- `guest_count` is only meaningful for open events (1 = just me, 2 = me + 1 guest). For curated events it is not set at interest submission; the admin sets it when confirming. It defaults to 1.
- `message` is optional for both event types.
- One reservation per attendee per event is enforced at the application layer (check before insert).

### Modified Table: `attendees`

Add two columns:

```sql
alter table attendees
  add column gender            text
                  check (gender in ('male', 'female', 'non-binary') or gender is null),
  add column gender_visibility text not null default 'admin_only'
                  check (gender_visibility in ('admin_only', 'public'));
```

`gender` is optional at signup (`null` = prefer not to say). The admin can set or override it per attendee in the Signups tab, along with the visibility flag.

---

## Business Logic

### Open Events (first-come-first-served)

1. Guest clicks Reserve. Client reads `SELECT COALESCE(SUM(guest_count), 0) FROM reservations WHERE event_id = X AND status = 'confirmed'`.
2. If `used + guest_count ≤ capacity` → insert reservation with `status = 'confirmed'`.
3. Otherwise → insert with `status = 'waitlisted'`.
4. One reservation per attendee per event: client checks for an existing row before inserting.

**Note on race conditions:** At homebar scale (6 seats, small concurrent user base) a client-side slot check before insert is an accepted trade-off. No server-side RPC is used. In the worst case, a double-booking slightly exceeds capacity; the admin can remove the excess reservation.

### Curated Events (host-selected)

1. Guest submits with `status = 'interested'`, optional message, `guest_count` defaults to 1 (not presented to the guest).
2. Admin reviews all interested guests and sets each to `confirmed` or `declined`.
3. There is no automatic waitlist promotion for curated events — the host decides entirely.
4. One expression of interest per attendee per event is enforced client-side.

### DB Trigger: Waitlist Auto-Promotion (open events only)

Fires `AFTER UPDATE` on `reservations`. When a row's `status` transitions **to** `'cancelled'`, `'declined'`, or `'removed'` **from** any other value, and the associated event has `event_type = 'open'`:

1. Recalculate available slots: `capacity − SUM(guest_count WHERE status = 'confirmed')`.
2. Iterate waitlisted reservations for that event ordered by `created_at ASC`.
3. For each: if its `guest_count ≤ available`, promote it to `'confirmed'` and decrement `available`. If its `guest_count > available`, **skip it and continue** to the next — do not stop. Multiple promotions can occur in one trigger call.

```sql
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

    -- Only promote for open events
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
      -- Skip entries that don't fit; continue to next
    end loop;

  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_promote_waitlist
after update on reservations
for each row execute function promote_waitlist();
```

### Attendance History — Status Mapping

"Past event" means `event_date < current_date`.

| Reservation status | Appears in guest history? | Guest sees |
|---|---|---|
| `confirmed` (past event) | Yes | **Attended** |
| `removed` (admin-removed) | Yes | **No-show** |
| `declined` (curated, past) | Yes | **Not Selected** |
| `cancelled` (guest-cancelled) | No | — |
| `waitlisted` (past event) | No | — (the event closed without them getting a spot) |
| `interested` (curated, past, never confirmed) | No | — |

The `removed` status is used exclusively by the admin. The `cancelled` status is used exclusively by the guest. This distinction drives the history logic — no additional field is needed to know who performed the action.

---

## Guest List Display

Each event has three independent boolean flags (set at creation, editable after):

| Flag | What it shows to guests |
|---|---|
| `show_count` | "N guests confirmed" |
| `show_names` | Attendee alias or username per row |
| `show_gender` | Gender badge per row |

Any combination is valid including none (hidden). When `show_gender = true`, only attendees with `gender_visibility = 'public'` show a gender badge; others render as `—`. When `show_names = false`, attendees render as "Guest ◆". +1 guests are not listed individually — the primary guest's row shows a "+1" badge.

---

## Gender

- Optional at signup. `null` = prefer not to say. UI shows four options: "Prefer not to say" (default), "Male", "Female", "Non-binary".
- Admin can set or override gender per attendee in the Signups tab, with context showing the guest's self-reported value.
- Each attendee has `gender_visibility`: `'admin_only'` (default) or `'public'`.
- `'admin_only'`: gender visible only in the admin panel, never in guest-facing lists.
- `'public'`: gender shown in event guest lists when `show_gender = true`.

---

## Pre-Login Visibility

The events listing is visible to all passcode-holders on `openbar.html` before login. It renders **below the auth card** (login/signup form), inside `#auth-section`, in its own `.card` block preceded by a `.rule` divider. It shows all events with `status != 'cancelled'`, ordered by `event_date ASC`.

Each pre-login event card shows:
- Title, date
- Slot meter (filled pips out of capacity) for open events
- "Full · Waitlist open" + count when at capacity
- "Curated · By Invitation" badge for curated events
- Disabled CTA: "Sign In to Reserve" / "Sign In to Express Interest" / "Sign In to Join Waitlist"

---

## Pages & Components

### `openbar.html`

**Pre-login section** (`#auth-section`): renders events listing below the login/signup card.

**Post-login dashboard** (`#dashboard-section`, Option B layout):

- **Events card** — all events with `status != 'cancelled'` and `event_date >= today`, ordered `event_date ASC`. Each row shows: date, title, slot meter (open events), type badge (curated), and the guest's reservation status inline if they have one.
  - Confirmed: ✓ Confirmed, guest_count note, Cancel button, optional message echo.
  - Waitlisted: ⏳ Waitlist #N, Leave Waitlist button.
  - Interested (curated): ✦ Interest Submitted, Withdraw button, optional message echo.
  - No reservation: Reserve → (open) or Express Interest → (curated) button.
  - Reserve form (open): guest count toggle (Just me / Me + 1 guest), optional message textarea, Confirm + Cancel buttons.
  - Interest form (curated): optional message textarea, explanatory note ("Host will review and select attendees"), Submit + Cancel buttons.
  - Guest list section (when any show_* flag is true): rendered below reservation actions per event row, respecting the show_count / show_names / show_gender flags.

- **Attendance History card** — reservations joined to events where `event_date < today`, showing status badge per the mapping table above. Events with no reservation row are not shown.

- **Wishlist card** — existing, unchanged.

### `admin/index.html` — Events Tab (new)

**Create Event form** at top:
- Fields: title (text), date (date input), capacity (number, default 6), event type (select: Open / Curated), display checkboxes (Count / Names / Gender, each independent).
- On submit: inserts into `events`, refreshes list.

**Event list** ordered by `event_date DESC`:
- Each event block: header with date, title, slot meter, status badge, inline display-option checkboxes (editable), Open/Close toggle, expanded body.
- **Open event body**: Confirmed section (attendee name, @username, guest_count badge, message, Remove button) + Waitlist section (position by `created_at`, message, Decline button).
- **Curated event body**: Expressions of Interest section (attendee name, @username, message, Confirm + Decline buttons) + Confirmed section (name, Remove button).

### `admin/index.html` — Signups Tab (updated)

Each attendee row gains:
- Gender selector: Prefer not to say / Male / Female / Non-binary (reflects current `gender` value, saves on change).
- Self-reported label shown as context when admin value differs or when guest chose "Prefer not to say".
- Visibility toggle: Admin only / Visible to all (reflects `gender_visibility`, saves on change).

---

## RLS Policies

```sql
-- Events: anon (passcode-holders) can read non-cancelled events; admin has full access
create policy "public read events"
  on events for select to anon
  using (status != 'cancelled');

create policy "admin full access events"
  on events for all to authenticated
  using (true);

-- Reservations: any client can insert with a constrained status
create policy "public insert reservations"
  on reservations for insert
  with check (status in ('confirmed', 'waitlisted', 'interested'));

-- Reservations: any client can read all rows
-- Note: the custom auth model (username+PIN, not Supabase JWT) means row-level
-- ownership cannot be enforced via auth.uid(). All reservation rows are readable
-- by any passcode-holder. Client-side filtering by attendee_id from the session
-- is the mitigation. This is an accepted trade-off at this scale.
create policy "anon read all reservations"
  on reservations for select
  using (true);

-- Reservations: any client can update a row's status to 'cancelled' only
-- Note: same auth limitation applies — a client with a known reservation UUID
-- could cancel another guest's reservation. Accepted trade-off. UUIDs are not
-- exposed in the UI, and the impact is low (admin can re-confirm).
create policy "guest cancel reservation"
  on reservations for update
  using (true)
  with check (status = 'cancelled');

create policy "admin full access reservations"
  on reservations for all to authenticated
  using (true);

alter table events enable row level security;
alter table reservations enable row level security;
```

---

## JS Changes

### New: `js/events.js`

```js
// Returns all non-cancelled events ordered by event_date ASC
export async function loadEvents() { ... }
```

### New: `js/reservations.js`

```js
// Returns all reservations for a given event (for admin panel — full rows)
export async function loadEventReservations(eventId) { ... }

// Returns guest-facing reservation data for a given event,
// applying show_count / show_names / show_gender masking
export async function loadEventGuestList(eventId, showCount, showNames, showGender) { ... }

// Returns all reservations for the current attendee (for dashboard + history)
export async function loadAttendeeReservations(attendeeId) { ... }

// Insert a reservation (open event: confirmed or waitlisted; curated: interested)
export async function createReservation(eventId, attendeeId, guestCount, message, status) { ... }

// Update reservation status to 'cancelled' (guest cancels / withdraws interest)
export async function cancelReservation(reservationId) { ... }
```

### Updated: `js/auth.js` — `loginAttendee()`

The existing `loginAttendee` SELECT should be extended to include `gender` and `gender_visibility` in the returned session object, for use in any future guest-facing gender display logic.

### Updated: `admin/js/admin-main.js`

- Add `loadEventsAdmin()` function and Events tab handler.
- Update `loadSignupsAdmin()` to render gender selector + visibility toggle per attendee row, and attach save handlers.
- Add `showAdmin()` call to `loadEventsAdmin()`.

---

## Out of Scope

- Email or push notifications (e.g., when promoted from waitlist).
- Recurring / template events.
- Attendee-facing ability to change reservation message after submitting.
- Admin manually promoting a waitlisted guest on open events (auto-promotion via trigger handles this).
- Enforcing attendee_id ownership on reservation updates at the database layer (see RLS note above).
