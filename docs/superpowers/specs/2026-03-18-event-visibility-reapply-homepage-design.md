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
  - `r.events.event_date >= today` (past closed events fall into history, not cancelled display)
- Collect these as a separate `cancelledEvents` array
- Pass to a new `renderCancelledEvents(cancelledEvents)` function

**`openbar.html` — `renderCancelledEvents()`**
- Owns its own section heading ("Cancelled") — no heading is hardcoded in surrounding HTML
- If the array is empty, renders nothing at all (no heading, no container)
- If non-empty, renders a labelled read-only list below the upcoming events section within the same dashboard card
- Each row shows: date, title, event type badge, and a "Cancelled" badge
- No action buttons — no cancel, no reapply

**Past closed events and history:**
- Reservations on closed events where `event_date < today` are eligible for the existing `historyRows` filter (`status` in `['confirmed', 'removed', 'declined']`). These appear in the History card as normal, not in the Cancelled section. The Cancelled section only shows upcoming closed events.

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
- Updates the existing removed row instead of inserting, avoiding duplicate rows

**`openbar.html` — submit reservation handler**
- The in-memory `attendeeReservations` array (fetched at `loadDashboardData` time) is checked for a `removed` reservation on that event
- If found: call `reapplyReservation(existingRes.id, guestCount, message, status)` instead of `createReservation`
- If not found: call `createReservation(...)` as before
- Note: there is no DB-level unique constraint on `(event_id, attendee_id)`. The in-memory check is the guard against duplicates. The stale-data race window (admin removes guest after page load but before guest submits) is acceptable — in that scenario `createReservation` would insert a second row. This is a known edge case, handled in a future iteration if it becomes a real problem. Audit fields (`removed_by`, `updated_at`) are out of scope.

---

## Feature 3 — Home Page Events + Admin Notes

### Goal
Upcoming events appear as simple teaser cards on the home page. Open Bar events link to the Open Bar page; Home Bar (curated) events are informational only. Admins can attach private notes to each event.

### Schema change
Add a `notes` column to the `events` table:
```sql
ALTER TABLE events ADD COLUMN notes text;
```
Nullable, no default. Not returned by guest-facing queries (see `loadEvents()` change below).

### `js/events.js` — `loadEvents()` column selection
- Change `select('*')` to an explicit column list that excludes `notes`:
  ```js
  .select('id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time')
  ```
- Keeps notes out of all guest-facing data (pre-login list, dashboard, home page)
- The admin panel uses its own `supabase.from('events').select('*')` query in `loadEventsAdmin()`, which will include `notes` automatically after the migration

### `home.html` — new Upcoming Events section
- Inserted between the hero block and the about/stats section
- Fetches upcoming events via `loadEvents()`, filtered client-side to `event_date >= today` (the date filter is applied in `home.html`, not inside `loadEvents()`, consistent with how `openbar.html` and the dashboard apply it)
- If no upcoming events remain after the date filter: the entire section is hidden (no empty state rendered)
- **Open Bar events** (`event_type: 'open'`): card is an `<a>` tag linking to `/openbar.html`
- **Home Bar events** (`event_type: 'curated'`): card is a non-interactive `<div>` with a subtle "Home Bar" label; `cursor: default`
- Card content: gold Cinzel date line + Playfair Display title only — no slot meter, no CTA text
- Styling follows existing `.card` patterns

### Admin panel — Notes field
- Each event block in `buildEventBlockHtml()` gets a `<textarea>` for notes rendered inside the expanded body, below all attendee sections
- Populated from `ev.notes` (empty string if null) when the block renders
- Saves silently on `blur`: fires a Supabase `update({ notes: value })` on the event row, **no full `loadEventsAdmin()` re-render** (avoids collapsing all open event blocks)
- `Enter` key inserts a newline (normal textarea behaviour — no save-on-Enter)
- `Escape` does nothing (notes field loses focus naturally)
- The save handler is attached inside `attachEventBlockHandlers()`

---

## Files Changed

| File | Change |
|---|---|
| `js/events.js` | Add `.neq('status', 'closed')`; switch to explicit column select (excluding `notes`) |
| `js/reservations.js` | Add `reapplyReservation()` export |
| `openbar.html` | `myResByEvent` excludes `removed`; reapply logic in submit handler; `renderCancelledEvents()` in dashboard |
| `home.html` | New upcoming events section with teaser cards |
| `admin/js/admin-main.js` | Notes textarea per event block, silent auto-save on blur |
| Supabase DB | `ALTER TABLE events ADD COLUMN notes text` |

---

## Out of Scope
- No changes to reservation statuses when an event is closed (guests stay on roster)
- No email/notification on close or reopen
- Notes are not versioned or timestamped
- Home page event cards show no slot data, no guest count
- No audit fields (`removed_by`, `updated_at`) on reapply
- Race condition on reapply (admin removes after page load) deferred to future iteration
