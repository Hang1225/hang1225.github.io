# Admin Slots — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Admins can reserve a block of slots on an event, invite specific guests (pending invite holds one slot), and directly add guests (bypassing the invite flow). All admin-held slots count against total event capacity. Guests see pending invitations in their dashboard and can accept or decline.

---

## Goal

Give admins per-event capacity control: hold anonymous slots (e.g. for offline +1 arrangements), send named invitations that hold a slot until the guest responds, and force-confirm guests without requiring them to apply.

---

## Schema Changes

### `events` table
```sql
ALTER TABLE events ADD COLUMN admin_reserved integer NOT NULL DEFAULT 0;
```
Stores the total number of slots admin is holding for this event. Admin sets this manually. It reduces the capacity available to regular signups.

### `reservations` table
```sql
-- Extend status enum
ALTER TABLE reservations DROP CONSTRAINT reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN (
    'confirmed', 'waitlisted', 'interested',
    'cancelled', 'declined', 'removed', 'invited'
  ));

-- Flag admin-created rows
ALTER TABLE reservations ADD COLUMN admin_added boolean NOT NULL DEFAULT false;
```

- `invited` rows: always `guest_count = 1`, `admin_added = true`
- Direct-add rows: `status = 'confirmed'`, `admin_added = true`, `guest_count = 1`
- `admin_added = false` on all existing and guest-created rows (default)

---

## Capacity Math

| Term | Formula |
|---|---|
| Regular slots used | `sum(guest_count WHERE status='confirmed' AND admin_added=false)` |
| Admin slots used | `count(status='invited') + count(status='confirmed' AND admin_added=true)` |
| Regular available | `capacity − admin_reserved − regular slots used` |
| Admin available (anonymous holds) | `admin_reserved − admin slots used` |

**Invariant:** admin cannot invite or add guests when `admin slots used >= admin_reserved`. The Invite/Add buttons are disabled in that state.

**`promote_waitlist` trigger** must be updated to subtract `admin_reserved` from available slots:
```sql
-- Before:
avail := event_cap - used_slots;
-- After:
select capacity, event_type, admin_reserved into event_cap, ev_type, admin_res
  from events where id = new.event_id;
avail := event_cap - admin_res - used_slots;
```

The `invited` status is never promoted by this trigger — it is not a guest-initiated queued status.

---

## Admin Panel UI

A new **"Admin Slots"** subsection is added to each event block body, between the edit form area and the existing attendee sections.

### Header row
Always visible when the block is expanded:
```
Admin Slots    Reserved: 3 | Used: 2 | Available: 1
```
- **Reserved** = `ev.admin_reserved`
- **Used** = count of `invited` + count of `confirmed AND admin_added`
- **Available** = Reserved − Used (anonymous holds for offline +1s etc.)

### Reserved count control
- `<input type="number" min="0">` prepopulated with `ev.admin_reserved`
- Auto-saves on `blur`: silent Supabase `update({ admin_reserved: value })`, no full re-render
- Client-side validation: cannot be set below current Used count; if attempted, reset to previous value

### Action buttons
- **Invite Guest** and **Add Directly** — both disabled (greyed) when `admin available = 0`
- Clicking either opens an inline form below the buttons (only one form open at a time)

### Inline guest form
Shared structure for both actions:
- Text input: admin types username or alias
- Live-filtered against the attendees list (already loaded in admin context via `loadEventsAdmin` join)
- Excludes attendees with an existing non-cancelled, non-declined reservation on this event
- Confirm button: **"Send Invite"** (invite action) or **"Add Guest"** (direct-add action)
- Cancel link: dismisses form, no Supabase call

### Admin-added guest list
Listed below the form area, one row per `invited` or `confirmed admin_added` reservation:
```
[name]  ·  Invited / Added  ·  [Remove]
```
- **Remove (invited):** `update({ status: 'declined' })` + `update({ admin_reserved: admin_reserved - 1 })` on the event
- **Remove (confirmed admin_added):** `update({ status: 'removed' })` + `update({ admin_reserved: admin_reserved - 1 })` on the event
- No full re-render on remove — update the subsection in place

---

## Guest Dashboard

A new **"Invitations"** section appears at the top of the guest dashboard (above Upcoming Events). Rendered only when the guest has one or more `invited` reservations.

### Invitation card
- Date + title (gold Cinzel / Playfair Display, matching existing event card style)
- Event type badge
- **Accept** and **Decline** buttons

### Accept
- `update({ status: 'confirmed' })` on the reservation row
- Card removed from Invitations section; event appears in Upcoming on next dashboard load

### Decline
- `update({ status: 'declined' })` on the reservation row
- `update({ admin_reserved: admin_reserved - 1 })` on the event row (releases slot to general capacity)
- Card removed from Invitations section

### Data loading
- `loadAttendeeReservations()` already returns all reservation rows including `invited` — no query change needed
- Guest dashboard filters `invited` rows into a separate `invitedEvents` array
- `invited` rows excluded from `myResByEvent` so the Reserve button does not appear for events the guest is already invited to

---

## Data Flow

### Admin invites a guest
1. Admin sets `admin_reserved` ≥ 1 (or increases it)
2. Admin opens Invite form, types username, confirms
3. Client checks: `admin slots used < admin_reserved` (guard)
4. `insert` into `reservations`: `{ event_id, attendee_id, guest_count: 1, status: 'invited', admin_added: true }`
5. Admin slots subsection updates in place (no full re-render)
6. Guest sees invitation in dashboard on next load

### Admin adds a guest directly
1. Same guard check
2. `insert` into `reservations`: `{ event_id, attendee_id, guest_count: 1, status: 'confirmed', admin_added: true }`
3. Admin slots subsection updates in place

### Guest accepts
1. `update({ status: 'confirmed' })` on reservation row
2. Invitation card removed from dashboard

### Guest declines
1. `update({ status: 'declined' })` on reservation row
2. `update({ admin_reserved: admin_reserved - 1 })` on event row
3. Invitation card removed from dashboard

---

## Files Changed

| File | Change |
|---|---|
| `admin/js/admin-main.js` | Add `buildAdminSlotsHtml(ev)` helper; wire reserved-count auto-save, invite/add inline forms, remove handlers in `attachEventBlockHandlers()`; include `admin_reserved` in `loadEventsAdmin()` query |
| `js/events.js` | Add `admin_reserved` to explicit column select in `loadEvents()` |
| `js/reservations.js` | Add `acceptInvite(reservationId)` and `declineInvite(reservationId, eventId, currentAdminReserved)` exports |
| `openbar.html` | Filter `invited` into `invitedEvents`; exclude `invited` from `myResByEvent`; add `renderInvitations(invitedEvents)`; wire Accept/Decline handlers |
| Supabase DB | Migration: `admin_reserved` on events, `invited` status + `admin_added` on reservations, updated `promote_waitlist` trigger |

---

## Out of Scope
- Invite notifications (email, push) — admin communicates offline
- +1 option on invites or direct-adds — admin adjusts `admin_reserved` manually to account for +1s
- Invite expiry / auto-decline after N days
- Audit log for admin slot actions
- Bulk invite
