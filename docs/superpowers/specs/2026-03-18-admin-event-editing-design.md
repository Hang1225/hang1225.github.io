# Admin Event Editing — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Admins can currently create events but cannot edit them after creation. This spec adds an inline edit form to each event block in the admin panel, covering all core event fields.

---

## Goal

Allow admins to edit event title, date, type, capacity, and start/end times directly within the existing event block UI, without leaving the Events tab.

---

## UI Behaviour

### Edit button
- A small "Edit" button is added to the event block header, beside the existing Close/Reopen toggle button
- Clicking "Edit" expands the event block (if collapsed) and reveals the edit form at the top of the block body, above the attendee sections
- While the form is open, the "Edit" button is replaced by nothing (or disabled) to prevent double-open

### Edit form fields
| Field | Input type | Notes |
|---|---|---|
| Title | `<input type="text">` | Required |
| Date | `<input type="date">` | Required |
| Start hour | `<select>` (same hour options as create form) | Required |
| Start minute | `<select>` (same minute options as create form) | Required |
| End hour | `<select>` (same hour options, with "Flexible" empty option) | Optional |
| End minute | `<select>` | Optional, only relevant if end hour is set |
| Event type | `<select>` with options "Open Bar" and "Home Bar" | Disabled + labelled "(locked — reservations exist)" if the event has any reservations of any status |
| Capacity | `<input type="number">` | Only shown when event type is "Open Bar" (`event_type: 'open'`). Hidden for Home Bar events. |

### Display options (show count / names / gender)
Already present as inline auto-saving checkboxes in the event block header. Not duplicated in the edit form.

### Save / Cancel
- **"Save Changes"** button: validates required fields (title, date, start time), calls Supabase `update` on the event row, then re-renders that single event block in place (calls `loadEventsAdmin()` which rebuilds the full list — existing behaviour)
- **"Cancel"** button: hides the form, no Supabase call, no re-render

### Event type lock logic
- Before rendering the edit form, check `ev.reservations` (already available in the `loadEventsAdmin` join) for any entries — if `ev.reservations.length > 0`, the event type `<select>` is rendered with `disabled` attribute and a note: `(locked — reservations exist)`
- If no reservations: type select is enabled and all options are available
- Capacity field visibility is driven by the currently-selected event type value in the form (re-evaluated on type change via a `change` listener)

---

## Data Flow

1. Admin clicks "Edit" on an event block
2. Edit form is rendered/shown inside the block body with current event values pre-populated
3. Admin makes changes and clicks "Save Changes"
4. Client validates: title non-empty, date non-empty, start time non-empty
5. Compose `start_time` and `end_time` from selects (same `composeTime()` helper already in `admin-main.js`)
6. Call `supabase.from('events').update({...}).eq('id', eventId)`
7. On success: call `loadEventsAdmin()` to re-render the full events list (same pattern as create event)
8. On error: show inline error message below the Save button

---

## Files Changed

| File | Change |
|---|---|
| `admin/js/admin-main.js` | Add "Edit" button to `buildEventBlockHtml()`; add `buildEditFormHtml(ev)` helper; wire up edit/save/cancel handlers in `attachEventBlockHandlers()` |

No schema changes. No other files affected.

---

## Out of Scope
- Editing display options (already inline in header)
- Bulk editing multiple events
- Edit history / audit log
- Changing capacity below the current number of confirmed slots (no validation for this edge case — admin responsibility)
