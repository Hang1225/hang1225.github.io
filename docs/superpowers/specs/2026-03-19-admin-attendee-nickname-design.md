# Admin Attendee Nickname — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Admins can set a private nickname for each attendee to help them remember who the person is. The nickname is admin-only — it is never returned by or shown in any guest-facing query or UI.

---

## Goal

Allow admins to attach a short private label to each attendee that appears in the Attendees tab and in event attendee lists within the admin panel.

---

## Schema Change

```sql
ALTER TABLE attendees ADD COLUMN nickname text;
```

Nullable, no default. Not included in any guest-facing query.

---

## UI Behaviour

### Attendees Tab

- Each attendee row gets an always-visible inline text field rendered below the name/username line
- Input: `<input type="text" class="nickname-input" data-attendee-id="${a.id}">`, placeholder `"Add nickname…"`
- Pre-populated from `a.nickname` (empty string if null)
- Auto-saves on `blur` via direct DB update — no full re-render (same pattern as event notes field, not the click-to-edit alias field):
  ```js
  supabase.from('attendees').update({ nickname: input.value.trim() || null }).eq('id', input.dataset.attendeeId)
  ```
- Field is rendered but `disabled` for removed attendees (consistent with gender select)
- No save button, no explicit error state (silent save)

### Event Attendee Lists

- In each event block's confirmed, waitlisted, and interested attendee rows, the admin sees a guest's name as: `DisplayName @username`
- If the guest has a non-empty nickname, append a muted span immediately after: `DisplayName @username (nickname)`
- Concrete HTML (nickname must go through `escapeHtml()`):
  ```js
  const nickname = r.attendees.nickname
  const nickSpan = nickname ? ` <span class="muted">(${escapeHtml(nickname)})</span>` : ''
  ```
- `nickSpan` is inserted immediately after `@handle` and before any other badge (e.g. `plusBadge` in confirmed rows, position `#N` in waitlisted rows):
  - Confirmed: `<strong>${name}</strong> <span class="muted">@${handle}</span>${nickSpan}${plusBadge}${msg}`
  - Waitlisted: `<strong ...>${name}</strong> <span class="muted">@${handle}</span>${nickSpan} <span ...>#${i+1}</span>${msg}`
  - Interested: `<strong>${name}</strong> <span class="muted">@${handle}</span>${nickSpan}${msg}`
- Only shown when nickname is non-empty (no empty parentheses rendered)

---

## Data Flow

### `loadSignupsAdmin()`

Add `nickname` to the existing select:

```js
.select('id, username, alias, nickname, gender, gender_visibility, created_at, removed_at')
```

### Event attendee join in `loadEventsAdmin()`

Add `nickname` to the existing `attendees(...)` join:

```js
attendees(username, alias, nickname)
```

All three attendee row render sites in the event block (confirmed, waitlisted, interested) already use the same pattern — each will include the nickname label.

---

## Files Changed

| File | Change |
|---|---|
| `admin/js/admin-main.js` | Add `nickname` to `loadSignupsAdmin` select; render nickname input per attendee row; wire blur auto-save; add `nickname` to event attendee join; append nickname label in event attendee row HTML |
| Supabase DB | `ALTER TABLE attendees ADD COLUMN nickname text` |

No guest-facing files are touched. No other files affected.

---

## Out of Scope

- Nickname visible to guests in any form
- Nickname shown in guest dashboard or home page
- Search or filter by nickname
- Nickname history or audit log
