# Admin Enhancements: Alias Edit, Account Removal, Event Times
**Date:** 2026-03-18

---

## Overview

Three additions to the admin panel and related guest-facing surfaces:

1. **Alias edit** — admin can update an attendee's display alias inline in the Signups tab.
2. **Account removal (soft delete)** — admin can disable an attendee's account with confirmation; the attendee's data and reservation history are preserved.
3. **Event start/end times** — events can have a start time (required in the create form) and optional end time, displayed to guests in 12-hour format.

---

## Data Model Changes

### `attendees` table

```sql
alter table attendees add column removed_at timestamptz default null;
```

- `null` = active account.
- Non-null = disabled; stores the timestamp of removal.
- Reservation history is fully preserved on soft delete (no cascade).

### `events` table

```sql
alter table events
  add column start_time time default null,
  add column end_time   time default null;
```

- `start_time`: required in the Create Event form, `null` at the DB level for backward compatibility with existing events (which render without a time string).
- `end_time`: always optional. `null` means "flexible end time" — not displayed to guests.
- These fields are **only settable at event creation**; the existing event list does not have an edit form for these fields.

---

## Business Logic

### Alias Edit

- Admin clicks an attendee's alias text in the Signups tab; it converts to an `<input>` pre-filled with the current value.
- **Save:** blur or Enter → `UPDATE attendees SET alias = ? WHERE id = ?`.
- **Cancel:** Escape → reverts to original text with no DB call.
- No uniqueness validation (alias is free-form; username is already unique).

### Account Removal (Soft Delete)

- Admin clicks "Remove Account" in an attendee row → confirmation modal appears.
- Modal copy: *"Remove [alias]'s account? They will no longer be able to log in. This cannot be easily undone."* with Cancel and Confirm buttons. Pressing Escape dismisses the modal (same as Cancel).
- On confirm: `UPDATE attendees SET removed_at = now() WHERE id = ?`. After success, call `loadSignupsAdmin()` to redraw the full list (consistent with existing patterns in `admin-main.js`).
- Disabled attendee rows are grayed out. The alias is shown as plain text (not click-to-edit). The gender selector and visibility toggle are shown in read-only (disabled) state for reference. The "Remove Account" button is replaced by a "Restore" button.
- Restore: `UPDATE attendees SET removed_at = null WHERE id = ?`. After success, call `loadSignupsAdmin()`.

**Login check in `js/auth.js` — `loginAttendee()`:**
- The existing SELECT must be updated to include `removed_at`:
  ```js
  .select('id, username, alias, credits, gender, gender_visibility, removed_at')
  ```
- After confirming the PIN matches, check `attendee.removed_at`. If non-null, return `{ error: 'disabled' }` instead of the attendee object.
- The call sites in the inline `<script>` in `openbar.html` (lines ~801 and ~837) currently check `if (!attendee)` for bad credentials. Update these to also handle the `{ error: 'disabled' }` case:
  - `if (!attendee)` → bad credentials → show existing error message.
  - `if (attendee?.error === 'disabled')` → show *"Account disabled. Please contact the host."*
  - Otherwise → valid session, proceed as normal.

### Event Times

**Create Event form:**
- **Start time (required):** A label "Start Time" followed by two `<select>` elements — hour and minute.
  - Hour options: 12 AM, 1 AM, 2 AM, … 11 AM, 12 PM, 1 PM, … 11 PM (24 options).
  - Option values use 24-hour notation: 12 AM → `"00"`, 1 AM → `"01"`, … 11 AM → `"11"`, 12 PM → `"12"`, 1 PM → `"13"`, … 11 PM → `"23"`.
  - Minute options: `00`, `15`, `30`, `45`.
  - On submit: combine as `HH:MM:00` string for the `start_time` column. No default; the form requires both selects to be set.
- **End time (optional):** A label "End Time" followed by a single `<select>` for the overall end-time choice.
  - First option: `"Flexible"` (value `""`), selected by default.
  - Remaining options: all 24-hour/minute combinations, same labels and values as start time (e.g., "12 AM 00", "12 AM 15", …).
  - Alternatively implemented as a "Flexible" checkbox that, when unchecked, reveals the hour + minute sub-selects. Either approach is acceptable as long as the UX makes the optional nature obvious and only one combined value is submitted.
  - On submit: if "Flexible" / no end time selected, store `null`. Otherwise store `HH:MM:00`.

**Display format (12-hour AM/PM):**
- Both times set: "7:00 PM – 9:30 PM"
- Start time only: "7:00 PM"
- No start time (legacy events): no time string shown.
- A `formatTimeRange(start_time, end_time)` helper handles this formatting. It is defined in `js/events.js` (already imported by `openbar.html`) and also imported by `admin/js/admin-main.js` for consistent rendering in the event list header.

---

## UI Changes

### Signups Tab — Attendee Row

- **Alias:** renders as styled text with an edit-cursor on hover. Clicking replaces it with an `<input>`. Blur/Enter saves; Escape cancels.
- **Gender selector and visibility toggle:** unchanged.
- **Remove Account button:** destructive style, at the end of the row.
- **Disabled state:** entire row grayed out. Alias shown as plain text (not click-to-edit). Gender selector and visibility toggle rendered with `disabled` attribute (values visible for reference). Remove Account button replaced by "Restore" button.

### Confirmation Modal

- Single modal element in the DOM, reused for all removal confirmations.
- Displays attendee alias in the warning message.
- Buttons: Cancel (dismisses) and Confirm (triggers soft delete). Pressing Escape also dismisses.

### Events Tab — Create Event Form

- After the existing date field:
  - **Start Time:** label + hour `<select>` + minute `<select>` (required).
  - **End Time:** label + single `<select>` with "Flexible" as default, followed by all time options; OR a "Flexible" checkbox that reveals hour + minute selects when unchecked.

### Events Tab — Event List

- Each event header includes the time alongside the date using `formatTimeRange`: e.g., *"Mar 20 · 7:00 PM – 9:30 PM"* or *"Mar 20 · 7:00 PM"*. Events without `start_time` show date only.

### Guest-Facing (`openbar.html` inline script)

- Pre-login events listing and post-login dashboard Events card both display the time string on each event card using the same `formatTimeRange` helper imported from `js/events.js`.

---

## JS Changes

### `js/auth.js` — `loginAttendee()`

- Add `removed_at` to the SELECT: `.select('id, username, alias, credits, gender, gender_visibility, removed_at')`.
- After PIN match, if `attendee.removed_at` is non-null, return `{ error: 'disabled' }`.
- The session object stored on successful login does not need to include `removed_at`.

### `openbar.html` — inline `<script>` (login call sites)

- Both login handlers (sign-in and sign-up flows, ~lines 801 and 837) check the return value of `loginAttendee()`.
- Add a branch: `if (attendee?.error === 'disabled')` → display *"Account disabled. Please contact the host."* and return.
- Existing `if (!attendee)` branch handles bad credentials as before.

### `admin/js/admin-main.js`

- **`loadSignupsAdmin()` query:** add `removed_at` to the SELECT.
- **Row rendering:** check `a.removed_at` to determine disabled state; render accordingly (grayed row, disabled controls, Restore vs. Remove button).
- **Alias click-to-edit:** attach click handler on alias text; swap to `<input>`; blur/Enter saves via Supabase update + reverts to text; Escape cancels.
- **Confirmation modal:** add single modal HTML element. Open on "Remove Account" click, passing attendee alias and id. Cancel/Escape closes. Confirm calls soft-delete update then `loadSignupsAdmin()`.
- **Restore handler:** calls `UPDATE attendees SET removed_at = null WHERE id = ?` then `loadSignupsAdmin()`.
- **Create Event form:** add start time and end time controls; compose `HH:MM:00` or `null` on submit.
- **Event list rendering:** import and use `formatTimeRange` from `js/events.js` when rendering event headers.

### `js/events.js`

- Add and export `formatTimeRange(start_time, end_time)`:
  - Converts a `HH:MM:SS` time string to 12-hour AM/PM format.
  - Returns `"H:MM AM/PM – H:MM AM/PM"` when both are set, `"H:MM AM/PM"` when only start is set, `""` when start is null.
- `loadEvents()` query already returns `*`; no query change needed.

### `js/openbar.js`

- No changes needed (wishlist only).

---

## Out of Scope

- Admin editing other attendee fields (username, PIN).
- Hard delete of attendees.
- Bulk removal of attendees.
- Notifying an attendee when their account is disabled.
- Editing `start_time` / `end_time` on existing events after creation.
- Start time enforcement (blocking reservations before an event starts).
- Timezone handling (times are stored and displayed as-is, no tz conversion).
