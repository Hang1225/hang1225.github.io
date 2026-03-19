# Admin Attendee Nickname — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only nickname field to each attendee that shows in the Attendees tab and in event attendee lists inside the admin panel.

**Architecture:** Single file change — `admin/js/admin-main.js` — plus one DB migration. The nickname input is always-visible, saves silently on blur (no re-render), and is disabled for removed attendees. In event attendee rows the nickname appears as a muted parenthetical after the @handle.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS v2. No test runner — verification is manual browser inspection.

---

## File Map

| File | What changes |
|---|---|
| `admin/js/admin-main.js` | Add `nickname` to `loadSignupsAdmin` select; add nickname input to attendee row HTML; wire blur auto-save handler; add `nickname` to `loadEventsAdmin` attendees join; prepend `nickSpan` in all three event attendee row templates |
| Supabase DB | `ALTER TABLE attendees ADD COLUMN nickname text` |

---

## Task 1: DB migration — add nickname column

**Files:**
- Supabase DB (manual SQL execution)

- [ ] **Step 1: Run the migration**

  In the Supabase SQL editor, execute:
  ```sql
  ALTER TABLE attendees ADD COLUMN nickname text;
  ```

- [ ] **Step 2: Verify**

  Run in the SQL editor:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'attendees' AND column_name = 'nickname';
  ```
  Expected: one row, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

  ```bash
  git commit --allow-empty -m "feat: add nickname column to attendees table (migration applied)"
  ```

---

## Task 2: Attendees tab — nickname input and auto-save

**Files:**
- Modify: `admin/js/admin-main.js`

This task adds the nickname field to the Attendees tab: the select query, the rendered HTML, and the blur save handler.

- [ ] **Step 1: Add `nickname` to `loadSignupsAdmin` select**

  Find (line ~285):
  ```js
  .select('id, username, alias, gender, gender_visibility, created_at, removed_at')
  ```

  Replace with:
  ```js
  .select('id, username, alias, nickname, gender, gender_visibility, created_at, removed_at')
  ```

- [ ] **Step 2: Add the nickname input to the attendee row HTML**

  Find (inside the `row.innerHTML = \`` template, after the `${selfLabel}` line and the date div):
  ```js
      <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
    </div>
  ```

  Replace with:
  ```js
      <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
      <input type="text" class="nickname-input" data-attendee-id="${a.id}"
        value="${escapeHtml(a.nickname || '')}"
        placeholder="Add nickname…"
        style="margin-top:0.3rem;font-size:0.8rem;width:100%;max-width:220px"
        ${isDisabled ? 'disabled' : ''}>
    </div>
  ```

- [ ] **Step 3: Add the blur auto-save handler**

  Find (after the restore-btn handler block, before the closing `}` of `loadSignupsAdmin`):
  ```js
  // Restore button
  el.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('attendees').update({ removed_at: null }).eq('id', btn.dataset.attendeeId)
      loadSignupsAdmin()
    })
  })
  }
  ```

  Replace with:
  ```js
  // Restore button
  el.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('attendees').update({ removed_at: null }).eq('id', btn.dataset.attendeeId)
      loadSignupsAdmin()
    })
  })

  // Nickname input — auto-save on blur, no re-render
  el.querySelectorAll('.nickname-input').forEach(input => {
    input.addEventListener('blur', async () => {
      const value = input.value.trim()
      await supabase.from('attendees')
        .update({ nickname: value || null })
        .eq('id', input.dataset.attendeeId)
    })
  })
  }
  ```

- [ ] **Step 4: Verify**

  1. Open the admin panel → Attendees tab
  2. Confirm each active attendee row shows a text input below the name/date with placeholder "Add nickname…"
  3. Confirm disabled attendees (removed) show the input as disabled
  4. Type a nickname into an input, click elsewhere — confirm no re-render occurs
  5. Reload the page — confirm the nickname is pre-populated (saved to Supabase)
  6. Clear the field, blur — confirm `nickname` is set to `null` in the Supabase row (not empty string)

- [ ] **Step 5: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: add nickname input to attendees tab with auto-save"
  ```

---

## Task 3: Event attendee lists — show nickname in attendee rows

**Files:**
- Modify: `admin/js/admin-main.js`

This task adds `nickname` to the event attendee join query and renders it as a muted label in all three attendee row types (confirmed, waitlisted, interested).

- [ ] **Step 1: Add `nickname` to the attendees join in `loadEventsAdmin`**

  Find (line ~477):
  ```js
  .select('*, reservations(id, attendee_id, status, guest_count, message, created_at, admin_added, attendees(username, alias))')
  ```

  Replace with:
  ```js
  .select('*, reservations(id, attendee_id, status, guest_count, message, created_at, admin_added, attendees(username, alias, nickname))')
  ```

- [ ] **Step 2: Add `nickSpan` to the confirmed row template**

  Find (inside the `confirmedRows` map):
  ```js
  const plusBadge = r.guest_count === 2 ? `<span class="badge" style="margin-left:0.3rem;font-size:0.65rem">+1</span>` : ''
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  return `
    <div class="event-attendee-row">
      <div><strong>${name}</strong> <span class="muted">@${handle}</span>${plusBadge}${msg}</div>
  ```

  Replace with:
  ```js
  const plusBadge = r.guest_count === 2 ? `<span class="badge" style="margin-left:0.3rem;font-size:0.65rem">+1</span>` : ''
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  const nickSpan = r.attendees.nickname ? ` <span class="muted">(${escapeHtml(r.attendees.nickname)})</span>` : ''
  return `
    <div class="event-attendee-row">
      <div><strong>${name}</strong> <span class="muted">@${handle}</span>${nickSpan}${plusBadge}${msg}</div>
  ```

- [ ] **Step 3: Add `nickSpan` to the waitlisted row template**

  Find (inside the `waitlistRows` map):
  ```js
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  return `
    <div class="event-attendee-row">
      <div><strong style="color:var(--muted)">${name}</strong> <span class="muted">@${handle}</span> <span style="font-size:0.75rem;color:#C9A030;margin-left:0.3rem">#${i + 1}</span>${msg}</div>
  ```

  Replace with:
  ```js
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  const nickSpan = r.attendees.nickname ? ` <span class="muted">(${escapeHtml(r.attendees.nickname)})</span>` : ''
  return `
    <div class="event-attendee-row">
      <div><strong style="color:var(--muted)">${name}</strong> <span class="muted">@${handle}</span>${nickSpan} <span style="font-size:0.75rem;color:#C9A030;margin-left:0.3rem">#${i + 1}</span>${msg}</div>
  ```

- [ ] **Step 4: Add `nickSpan` to the interested row template**

  Find (inside the `interestedRows` map):
  ```js
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  return `
    <div class="event-attendee-row">
      <div><strong>${name}</strong> <span class="muted">@${handle}</span>${msg}</div>
  ```

  Replace with:
  ```js
  const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
  const nickSpan = r.attendees.nickname ? ` <span class="muted">(${escapeHtml(r.attendees.nickname)})</span>` : ''
  return `
    <div class="event-attendee-row">
      <div><strong>${name}</strong> <span class="muted">@${handle}</span>${nickSpan}${msg}</div>
  ```

- [ ] **Step 5: Verify**

  1. Set a nickname for an attendee in the Attendees tab (Task 2 must be done first)
  2. Navigate to the Events tab, expand an event where that attendee has a reservation
  3. Confirm the nickname appears in parentheses after @handle in the correct section (confirmed/waitlisted/interested)
  4. Confirm attendees with no nickname show no parentheses
  5. Confirm no console errors

- [ ] **Step 6: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: show attendee nickname in event attendee lists"
  ```

---

## Final Verification Checklist

- [ ] Attendees tab: nickname input visible below name/date for each active attendee
- [ ] Attendees tab: input is `disabled` for removed attendees
- [ ] Attendees tab: typing and blurring saves to Supabase without re-rendering the list
- [ ] Attendees tab: clearing the field saves `null` (not empty string) to Supabase
- [ ] Attendees tab: nickname is pre-populated on page reload
- [ ] Event attendee lists: nickname shows as `(nickname)` after @handle in confirmed rows
- [ ] Event attendee lists: nickname shows after @handle and before `#N` position in waitlisted rows
- [ ] Event attendee lists: nickname shows after @handle in interested rows
- [ ] Event attendee lists: rows with no nickname show no empty parentheses
- [ ] Nickname is never returned by or shown in any guest-facing page
