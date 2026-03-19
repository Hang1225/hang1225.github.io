# Event Visibility, Guest Reapply & Home Page Events — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Three related improvements to event handling across the 二十五 site:

1. **Event closing** — closed events hidden from public; signed-up guests see them as "Cancelled" (read-only) in their dashboard
2. **Guest reapply** — guests removed from an event by admin can reapply through the normal reservation flow
3. **Home page events** — upcoming events shown as teaser cards on the home page, with admin notes field per event

---

## Feature 1 — Event Closing Visibility

### Goal
When admin closes an event, it disappears from the public pre-login view and the guest dashboard's upcoming list, but guests who had an active reservation still see it as a read-only "Cancelled" entry.

### Data model
No schema changes. The existing `status` field on `events` already supports `'open'`, `'closed'`, and `'cancelled'`. The admin Close/Reopen toggle continues to write `'closed'` / `'open'`.

### Changes

**`js/events.js` — `loadEvents()`**
- Add `.neq('status', 'closed')` filter alongside the existing `.neq('status', 'cancelled')`
- Effect: closed events no longer appear in the public pre-login event list or the dashboard upcoming fetch

**`openbar.html` — `loadDashboardData()`**
- After populating `myResByEvent` from `attendeeReservations`, scan for reservations where:
  - `r.events.status === 'closed'`
  - `r.status` is one of `['confirmed', 'waitlisted', 'interested']`
- Collect these as a separate `cancelledEvents` array
- Pass to a new `renderCancelledEvents(cancelledEvents)` function

**`openbar.html` — `renderCancelledEvents()`**
- Renders a read-only list below the upcoming events section (or within the same card)
- Each row shows: date, title, event type badge, and a "Cancelled" badge
- No action buttons — no cancel, no reapply
- If the array is empty, renders nothing

### Reopening
When admin sets status back to `'open'`, the event re-enters `loadEvents()` results and the guest's dashboard naturally shows it as an upcoming event again on next load. No special handling needed.

---

## Feature 2 — Guest Reapply After Removal

### Goal
A guest whose reservation was set to `'removed'` by admin can reapply to the event through the normal flow.

### Changes

**`openbar.html` — `myResByEvent` population**
- Exclude both `'cancelled'` and `'removed'` statuses when building `myResByEvent`
- Effect: a guest with a `removed` reservation sees the event as if they have no reservation — the Reserve / Express Interest button reappears

**`js/reservations.js` — new `reapplyReservation()`**
```js
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
- Updates the existing removed row instead of inserting, avoiding duplicate rows per `(event_id, attendee_id)`

**`openbar.html` — submit reservation handler**
- Before calling `createReservation`, check `attendeeReservations` for a `removed` reservation on that event
- If found: call `reapplyReservation(existingRes.id, guestCount, message, status)` instead
- If not found: call `createReservation(...)` as before

---

## Feature 3 — Home Page Events + Admin Notes

### Goal
Upcoming events appear as simple teaser cards on the home page. Open Bar events link to the Open Bar page; Home Bar (curated) events are informational only. Admins can attach private notes to each event.

### Schema change
Add a `notes` column to the `events` table:
```sql
ALTER TABLE events ADD COLUMN notes text;
```
Nullable, no default. Never included in guest-facing queries.

### `home.html` — new Upcoming Events section
- Inserted between the hero block and the about/stats section
- Fetches upcoming events via `loadEvents()` (already excludes cancelled + closed after Feature 1 change), filtered to `event_date >= today`
- If no upcoming events: section is hidden entirely (no empty state rendered)
- **Open Bar events** (`event_type: 'open'`): card is an `<a>` linking to `/openbar.html`
- **Home Bar events** (`event_type: 'curated'`): card is a `<div>`, non-clickable, with a subtle "Home Bar" label
- Card content: gold Cinzel date line + Playfair Display title — no slot meter, no CTA text
- Styling follows existing `.card` patterns; Open Bar cards get a pointer cursor, Home Bar cards get `cursor: default`

### Admin panel — Notes field
- Each event block in `loadEventsAdmin()` gets a `<textarea>` for notes (rendered inside the expanded body, below attendee lists)
- Auto-saves on `blur` (same pattern as alias click-to-edit)
- Populated from `ev.notes` when the block renders
- The `notes` field is included in the admin `loadEventsAdmin()` select (`*` already covers it after the column is added)
- Notes are **not** included in `loadEvents()` (guest-facing) or any guest query

---

## Files Changed

| File | Change |
|---|---|
| `js/events.js` | Add `.neq('status', 'closed')` to `loadEvents()` |
| `js/reservations.js` | Add `reapplyReservation()` export |
| `openbar.html` | `myResByEvent` excludes `removed`; reapply logic in submit handler; `renderCancelledEvents()` in dashboard |
| `home.html` | New upcoming events section with teaser cards |
| `admin/js/admin-main.js` | Notes textarea per event block, auto-save on blur |
| Supabase DB | `ALTER TABLE events ADD COLUMN notes text` |

---

## Out of Scope
- No changes to reservation statuses when an event is closed (guests stay on roster)
- No email/notification on close or reopen
- Notes are not versioned or timestamped
- Home page event cards show no slot data, no guest count
