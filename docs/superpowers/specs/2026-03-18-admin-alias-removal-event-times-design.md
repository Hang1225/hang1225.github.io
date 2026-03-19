# Admin Enhancements: Alias Edit, Account Removal, Event Times
**Date:** 2026-03-18

---

## Overview

Three additions to the admin panel and related guest-facing surfaces:

1. **Alias edit** — admin can update an attendee's display alias inline in the Signups tab.
2. **Account removal (soft delete)** — admin can disable an attendee's account with confirmation; the attendee's data and reservation history are preserved.
3. **Event start/end times** — events can have a start time (required) and optional end time, displayed to guests in 12-hour format.

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

- `start_time`: required in the create form, optional at the DB level for backward compatibility with existing events.
- `end_time`: always optional. `null` means "flexible end time" — not displayed to guests.

---

## Business Logic

### Alias Edit

- Admin clicks an attendee's alias text in the Signups tab; it converts to an `<input>` pre-filled with the current value.
- **Save:** blur or Enter → `UPDATE attendees SET alias = ? WHERE id = ?`.
- **Cancel:** Escape → reverts to original text with no DB call.
- No uniqueness validation (alias is free-form; username is already unique).

### Account Removal (Soft Delete)

- Admin clicks "Remove Account" in an attendee row → confirmation modal appears.
- Modal copy: *"Remove [alias]'s account? They will no longer be able to log in. This cannot be easily undone."* with Cancel and Confirm buttons.
- On confirm: `UPDATE attendees SET removed_at = now() WHERE id = ?`.
- Disabled attendees remain visible in the Signups tab (grayed out, controls non-interactive), with a "Restore" button.
- Restore: `UPDATE attendees SET removed_at = null WHERE id = ?`.
- **Login check in `auth.js`:** after fetching the attendee row, if `removed_at` is non-null, reject login and display *"Account disabled. Please contact the host."* No session is created.

### Event Times

- **Start time:** required in the Create Event form. Two `<select>` dropdowns — hour (12 AM – 11 PM, 12-hour) and minute (00, 15, 30, 45). Combined into a `HH:MM:SS` value (`time` type) on submit.
- **End time:** same dropdowns with a "Flexible" option prepended as the default. If left at default, `end_time` is stored as `null`.
- **Display format:** 12-hour with AM/PM. Examples:
  - Both set: "7:00 PM – 9:30 PM"
  - Start only: "7:00 PM"
- Existing events with no `start_time` render without a time string (graceful degradation).

---

## UI Changes

### Signups Tab — Attendee Row

- **Alias:** renders as styled text with an edit-cursor on hover. Clicking replaces it with an `<input>`. Blur/Enter saves; Escape cancels.
- **Gender selector and visibility toggle:** unchanged.
- **Remove Account button:** destructive style, end of row.
- **Disabled state:** entire row grayed out; alias input, gender selector, visibility toggle, and Remove button are replaced by a "Restore" button only.

### Confirmation Modal

- Single modal element in the DOM, reused for all removal confirmations.
- Displays attendee alias in the warning message.
- Buttons: Cancel (dismisses) and Confirm (triggers soft delete).

### Events Tab — Create Event Form

- After the existing date field:
  - **Start Time:** label + hour `<select>` + minute `<select>` (required).
  - **End Time:** label + hour `<select>` + minute `<select>`, with "Flexible" as the first/default option for both dropdowns (optional).

### Events Tab — Event List

- Each event header includes the time alongside the date: e.g., *"Mar 20 · 7:00 PM – 9:30 PM"* or *"Mar 20 · 7:00 PM"*. Events without a start time show date only.

### Guest-Facing (openbar.html)

- Pre-login events listing and post-login dashboard Events card both show the time range (or start-only) on each event card, in the same format as the admin list.

---

## JS Changes

### `js/auth.js` — `loginAttendee()`

- After fetching the attendee row, check `removed_at`. If non-null, return an error object (e.g., `{ error: 'disabled' }`) instead of setting session state.
- The login UI renders *"Account disabled. Please contact the host."* for this error code.

### `admin/js/admin-main.js`

- **`loadSignupsAdmin()`:**
  - Render alias as click-to-edit text. Attach click handler to enter edit mode; blur/Enter to save; Escape to cancel.
  - Render "Remove Account" button. Attach click handler to open confirmation modal with attendee alias.
  - Render disabled rows (non-null `removed_at`) grayed out with a "Restore" button.
  - Attach restore handler.
- **Confirmation modal:**
  - Add modal HTML (single instance). Open/close logic in JS.
  - On confirm: call soft-delete update, refresh the row.
- **`loadEventsAdmin()` / Create Event form:**
  - Add start time and end time `<select>` pairs.
  - On submit: read selected hour/minute, compose `HH:MM:00` string for `start_time`; compose or pass `null` for `end_time` if "Flexible" selected.
  - Update event header rendering to include formatted time string.

### `js/events.js` — `loadEvents()`

- Already returns full event rows. No query change needed — `start_time` and `end_time` are included automatically.

### `openbar.js` (dashboard + pre-login rendering)

- Update event card rendering to display time range when `start_time` is present.
- Helper: `formatTimeRange(start_time, end_time)` → 12-hour string.

---

## Out of Scope

- Admin editing other attendee fields (username, PIN, message).
- Hard delete of attendees.
- Bulk removal of attendees.
- Notifying an attendee when their account is disabled.
- Start time enforcement (i.e., blocking reservations before the event starts).
- Timezone handling (times are stored and displayed as-is, no tz conversion).
