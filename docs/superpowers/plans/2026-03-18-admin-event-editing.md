# Admin Event Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline edit form to each event block in the admin panel so admins can update title, date, type, capacity, and start/end times after creation.

**Architecture:** Single file change — `admin/js/admin-main.js`. The edit form is rendered inside the existing event block body via a new `buildEditFormHtml(ev)` helper. Save/cancel handlers are attached in the existing `attachEventBlockHandlers()`. No schema changes, no new files.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS v2, HTML/CSS. No test runner — verification is manual browser inspection.

---

## File Map

| File | What changes |
|---|---|
| `admin/js/admin-main.js` | Add Edit button to `buildEventBlockHtml()`; add `buildEditFormHtml(ev)` helper; wire handlers in `attachEventBlockHandlers()` |

---

## Task 1: Add Edit button to `buildEventBlockHtml()`

**Files:**
- Modify: `admin/js/admin-main.js`

The Edit button goes in the event block header, beside the existing Close/Reopen toggle.

- [ ] **Step 1: Locate the toggle button line in `buildEventBlockHtml()`**

  Find this line (near the end of the function, inside the header `<div>`):
  ```js
  <button class="btn btn-sm toggle-status-btn" data-event-id="${escapeHtml(ev.id)}" data-current="${escapeHtml(ev.status)}">${toggleLabel}</button>
  ```

- [ ] **Step 2: Add the Edit button immediately after it**

  Replace that line with:
  ```js
  <button class="btn btn-sm toggle-status-btn" data-event-id="${escapeHtml(ev.id)}" data-current="${escapeHtml(ev.status)}">${toggleLabel}</button>
  <button class="btn btn-sm edit-event-btn" data-event-id="${escapeHtml(ev.id)}">Edit</button>
  ```

- [ ] **Step 3: Add the edit form container inside the block body**

  Find the block body in `buildEventBlockHtml()`. The exact content depends on whether the notes plan (2026-03-18-event-visibility-reapply-homepage) has already been executed:

  **If notes plan has NOT yet run** — find:
  ```js
  <div class="event-block-body" style="display:none">
    ${confirmedSection}
    ${secondarySection}
  </div>
  ```
  Replace with:
  ```js
  <div class="event-block-body" style="display:none">
    <div class="event-edit-form" id="edit-form-${escapeHtml(ev.id)}" style="display:none"></div>
    ${confirmedSection}
    ${secondarySection}
  </div>
  ```

  **If notes plan HAS already run** — find:
  ```js
  <div class="event-block-body" style="display:none">
    ${confirmedSection}
    ${secondarySection}
    ${notesHtml}
  </div>
  ```
  Replace with:
  ```js
  <div class="event-block-body" style="display:none">
    <div class="event-edit-form" id="edit-form-${escapeHtml(ev.id)}" style="display:none"></div>
    ${confirmedSection}
    ${secondarySection}
    ${notesHtml}
  </div>
  ```

  In both cases: the edit form container div is inserted as the **first child** of the block body. It starts hidden and is populated lazily when Edit is clicked.

- [ ] **Step 4: Verify**

  Open the admin panel. Expand an event block. Confirm an "Edit" button appears in the header beside Close/Reopen. Confirm no form is visible yet. No console errors.

- [ ] **Step 5: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: add Edit button and form container to admin event blocks"
  ```

---

## Task 2: Add `buildEditFormHtml(ev)` helper

**Files:**
- Modify: `admin/js/admin-main.js`

This function renders the full edit form HTML pre-populated with the event's current values.

- [ ] **Step 1: Locate where to insert the function**

  Find `buildEventBlockHtml(ev)` in `admin-main.js`. Add `buildEditFormHtml` as a new function directly after it (before `attachEventBlockHandlers`).

- [ ] **Step 2: Add the helper**

  ```js
  function buildEditFormHtml(ev) {
    // Determine if event type is locked (has active reservations)
    const activeStatuses = ['confirmed', 'waitlisted', 'interested']
    const hasActiveRes = (ev.reservations || []).some(r => activeStatuses.includes(r.status))
    const typeLocked = hasActiveRes

    // Pre-populate time selects from stored values e.g. "19:00:00" → hour "19", min "00"
    function splitTime(timeStr) {
      if (!timeStr) return { hour: '', min: '' }
      const [h, m] = timeStr.split(':')
      return { hour: h, min: m }
    }
    const start = splitTime(ev.start_time)
    const end   = splitTime(ev.end_time)

    const typeSelect = typeLocked
      ? `<select disabled style="opacity:0.5;cursor:not-allowed">
           <option value="open"${ev.event_type === 'open' ? ' selected' : ''}>Open Bar</option>
           <option value="curated"${ev.event_type === 'curated' ? ' selected' : ''}>Home Bar</option>
         </select>
         <span style="font-size:0.75rem;color:var(--muted);font-style:italic">(locked — active reservations exist)</span>`
      : `<select class="edit-type-select" data-event-id="${escapeHtml(ev.id)}">
           <option value="open"${ev.event_type === 'open' ? ' selected' : ''}>Open Bar</option>
           <option value="curated"${ev.event_type === 'curated' ? ' selected' : ''}>Home Bar</option>
         </select>`

    const capacityHtml = `
      <div class="edit-capacity-row" style="${ev.event_type === 'curated' ? 'display:none' : ''}">
        <label style="font-size:0.75rem;color:var(--muted)">Capacity</label>
        <input type="number" class="edit-capacity" min="1" value="${escapeHtml(String(ev.capacity || 6))}"
          style="width:80px">
      </div>`

    // Minute options: 00, 15, 30, 45
    const minuteOpts = (selected) => ['00','15','30','45'].map(m =>
      `<option value="${m}"${m === selected ? ' selected' : ''}>${m}</option>`
    ).join('')

    return `
      <div style="padding:0.75rem 0 1rem;border-bottom:1px solid rgba(201,168,76,0.12);margin-bottom:0.75rem">
        <div style="font-family:'Cinzel',serif;font-size:0.5rem;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.75rem">EDIT EVENT</div>

        <div style="display:flex;flex-direction:column;gap:0.6rem">

          <div>
            <label style="font-size:0.75rem;color:var(--muted)">Title</label>
            <input type="text" class="edit-title" value="${escapeHtml(ev.title)}" style="width:100%">
          </div>

          <div>
            <label style="font-size:0.75rem;color:var(--muted)">Date</label>
            <input type="date" class="edit-date" value="${escapeHtml(ev.event_date)}">
          </div>

          <div>
            <label style="font-size:0.75rem;color:var(--muted)">Start Time</label>
            <div style="display:flex;gap:0.4rem;align-items:center">
              <select class="edit-start-hour">
                <option value="">Hour</option>
                ${hourOptions(start.hour)}
              </select>
              <select class="edit-start-min">
                <option value="">Min</option>
                ${minuteOpts(start.min)}
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem;color:var(--muted)">End Time <span style="font-style:italic;font-size:0.7rem">(optional)</span></label>
            <div style="display:flex;gap:0.4rem;align-items:center">
              <select class="edit-end-hour">
                <option value="">Flexible</option>
                ${hourOptions(end.hour)}
              </select>
              <select class="edit-end-min">
                <option value="">Min</option>
                ${minuteOpts(end.min)}
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem;color:var(--muted)">Event Type</label>
            <div style="display:flex;align-items:center;gap:0.5rem">${typeSelect}</div>
          </div>

          ${capacityHtml}

        </div>

        <div style="display:flex;gap:0.5rem;margin-top:0.85rem;align-items:center">
          <button class="btn btn-sm btn-solid save-edit-btn" data-event-id="${escapeHtml(ev.id)}">Save Changes</button>
          <button class="btn btn-sm cancel-edit-btn" data-event-id="${escapeHtml(ev.id)}">Cancel</button>
          <span class="edit-status" style="font-size:0.8rem"></span>
        </div>
      </div>
    `
  }
  ```

  Note: `hourOptions()` is already defined at the top of `admin-main.js` and is available here. `escapeHtml()` is also already defined globally in the file.

- [ ] **Step 3: Verify**

  No visible change yet — this function is not called until wired in Task 3. Confirm no console errors on admin panel load.

- [ ] **Step 4: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: add buildEditFormHtml() helper for admin event editing"
  ```

---

## Task 3: Wire up edit/save/cancel handlers in `attachEventBlockHandlers()`

**Files:**
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Add the Edit button click handler**

  At the end of `attachEventBlockHandlers(container)`, before the closing `}`, add:

  ```js
  // Edit button — show inline edit form
  container.querySelectorAll('.edit-event-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const eventId = btn.dataset.eventId

      // Expand the block body if collapsed
      const header = btn.closest('.event-block-header')
      const body = header.nextElementSibling
      body.style.display = 'block'

      const formContainer = document.getElementById('edit-form-' + eventId)
      if (formContainer.style.display === 'block') return // already open

      const ev = (window._eventsAdminCache || []).find(ev => ev.id === eventId)
      if (!ev) return

      formContainer.innerHTML = buildEditFormHtml(ev)
      formContainer.style.display = 'block'
      btn.style.display = 'none'

      // Type select → toggle capacity row visibility
      const typeSelect = formContainer.querySelector('.edit-type-select')
      const capacityRow = formContainer.querySelector('.edit-capacity-row')
      if (typeSelect && capacityRow) {
        typeSelect.addEventListener('change', () => {
          capacityRow.style.display = typeSelect.value === 'curated' ? 'none' : ''
        })
      }

      // Cancel — attach directly on the now-existing button
      formContainer.querySelector('.cancel-edit-btn').addEventListener('click', e => {
        e.stopPropagation()
        formContainer.style.display = 'none'
        formContainer.innerHTML = ''
        btn.style.display = '' // re-show Edit button
      })

      // Save — attach directly on the now-existing button
      formContainer.querySelector('.save-edit-btn').addEventListener('click', async e => {
        e.stopPropagation()
        const statusEl = formContainer.querySelector('.edit-status')

        const title  = formContainer.querySelector('.edit-title').value.trim()
        const date   = formContainer.querySelector('.edit-date').value
        const startH = formContainer.querySelector('.edit-start-hour').value
        const startM = formContainer.querySelector('.edit-start-min').value
        const endH   = formContainer.querySelector('.edit-end-hour').value
        const endM   = formContainer.querySelector('.edit-end-min').value

        const start_time = composeTime(startH, startM)
        const end_time   = endH ? composeTime(endH, endM) : null

        if (!title || !date || !start_time) {
          statusEl.textContent = 'Title, date, and start time are required.'
          statusEl.className = 'error'
          return
        }

        // Build update payload
        const typeSelectEl = formContainer.querySelector('.edit-type-select')
        const event_type = typeSelectEl ? typeSelectEl.value : null // null if locked — don't overwrite
        const capacityEl = formContainer.querySelector('.edit-capacity')
        const capacity = capacityEl && capacityEl.closest('.edit-capacity-row').style.display !== 'none'
          ? parseInt(capacityEl.value)
          : null // omit capacity for Home Bar events

        const payload = { title, event_date: date, start_time, end_time }
        if (event_type) payload.event_type = event_type
        if (capacity !== null && !isNaN(capacity) && capacity >= 1) payload.capacity = capacity

        const saveBtn = formContainer.querySelector('.save-edit-btn')
        saveBtn.disabled = true
        statusEl.textContent = ''

        const { error } = await supabase.from('events').update(payload).eq('id', eventId)

        saveBtn.disabled = false
        if (error) {
          statusEl.textContent = 'Save failed. Please try again.'
          statusEl.className = 'error'
          return
        }

        loadEventsAdmin() // full re-render to reflect changes
      })
    })
  })
  ```

  Key design: cancel and save handlers are attached **inside** the Edit click handler, immediately after the form HTML is injected — this guarantees those buttons exist in the DOM when the listeners are added. No event delegation or `querySelectorAll` for these dynamic buttons.

- [ ] **Step 2: Cache events data in `loadEventsAdmin()` for the edit handler**

  The edit handler above reads `window._eventsAdminCache` to get the full event object (including reservations) needed by `buildEditFormHtml`. Update `loadEventsAdmin()` to populate this cache.

  Find the loop in `loadEventsAdmin()`:
  ```js
  container.innerHTML = ''
  events.forEach(ev => {
    const block = document.createElement('div')
    block.className = 'event-block'
    block.innerHTML = buildEventBlockHtml(ev)
    container.appendChild(block)
  })
  ```

  Replace with:
  ```js
  window._eventsAdminCache = events  // cache for edit form lookups
  container.innerHTML = ''
  events.forEach(ev => {
    const block = document.createElement('div')
    block.className = 'event-block'
    block.innerHTML = buildEventBlockHtml(ev)
    container.appendChild(block)
  })
  ```

- [ ] **Step 3: Verify — Edit opens**

  1. Open the admin panel, go to the Events tab
  2. Click "Edit" on any event block
  3. Confirm the block expands and the edit form appears at the top of the body, pre-populated with the event's current title, date, type, and times
  4. Confirm the Edit button is hidden while the form is open

- [ ] **Step 4: Verify — Type lock**

  1. Find an event that has at least one confirmed/waitlisted/interested reservation
  2. Click Edit — confirm the Event Type select is disabled and shows "(locked — active reservations exist)"
  3. Find an event with no active reservations (or create a new one)
  4. Click Edit — confirm the Event Type select is enabled

- [ ] **Step 5: Verify — Capacity toggle**

  1. Open edit form on an Open Bar event — confirm Capacity field is visible
  2. Change type to "Home Bar" — confirm Capacity field hides immediately
  3. Change back to "Open Bar" — confirm Capacity field reappears

- [ ] **Step 6: Verify — Cancel**

  1. Open the edit form, make some changes
  2. Click Cancel — confirm the form closes, no changes saved, the Edit button reappears
  3. Check the Supabase row — confirm no changes were written

- [ ] **Step 7: Verify — Save**

  1. Open the edit form, change the title to something new
  2. Click "Save Changes"
  3. Confirm the event list re-renders with the updated title
  4. Check the Supabase `events` row — confirm the new title is saved
  5. Test validation: clear the title field, click Save — confirm error message appears and no Supabase call is made

- [ ] **Step 8: Verify — End time optional**

  1. Open edit on an event with an end time
  2. Change End Hour back to "Flexible" (empty option), click Save
  3. Confirm `end_time` is `null` in Supabase

- [ ] **Step 9: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: wire up inline event edit/save/cancel handlers in admin panel"
  ```

---

## Final Verification Checklist

- [ ] Edit button visible on every event block in admin Events tab
- [ ] Edit form pre-populates all fields correctly (title, date, type, capacity, start/end times)
- [ ] Event type locked (disabled) when active reservations exist; unlocked otherwise
- [ ] Changing type Open Bar ↔ Home Bar toggles capacity field visibility in real time
- [ ] Cancel closes form and restores Edit button without reloading the page
- [ ] Save validates required fields (title, date, start time) before calling Supabase
- [ ] Save updates the Supabase row and triggers full re-render of events list
- [ ] Save error shows inline message without closing the form
- [ ] Home Bar events save without modifying `capacity` in DB
- [ ] End time saves as `null` when "Flexible" is selected
