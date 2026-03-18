import { supabase } from '../../js/supabase-client.js'
import { adminLogin, adminLogout, getAdminSession } from './admin-auth.js'

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// --- Auth ---
const session = await getAdminSession()
if (session) showAdmin()

document.getElementById('admin-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim()
  const password = document.getElementById('admin-password').value
  if (!email || !password) return
  const ok = await adminLogin(email, password)
  if (ok) {
    showAdmin()
  } else {
    document.getElementById('login-err').style.display = 'block'
  }
})

document.getElementById('admin-logout-btn').addEventListener('click', adminLogout)

// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
  })
})

function showAdmin() {
  document.getElementById('login-view').style.display = 'none'
  document.getElementById('admin-view').style.display = 'block'
  loadEventsAdmin()
  loadMenuAdmin()
  loadPendingComments()
  loadWishlistAdmin()
  loadSignupsAdmin()
}

// --- MENU ---
async function loadMenuAdmin() {
  const { data } = await supabase.from('drinks').select('*').order('created_at')
  const list = document.getElementById('drinks-list')
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="muted">No drinks yet.</p>'
    return
  }
  list.innerHTML = ''
  data.forEach(d => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div><strong>${escapeHtml(d.name)}</strong> <span class="muted">— ${escapeHtml(d.description)}</span></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-outline" data-id="${escapeHtml(d.id)}" data-action="edit-drink">Edit</button>
        <button class="btn btn-sm btn-danger" data-id="${escapeHtml(d.id)}" data-action="delete-drink">Delete</button>
      </div>
    `
    list.appendChild(row)
  })
  // Store drink data for edit
  list._drinkData = data
}

document.getElementById('drinks-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id
  const action = btn.dataset.action
  const list = document.getElementById('drinks-list')
  const drinkData = list._drinkData || []

  if (action === 'edit-drink') {
    const d = drinkData.find(x => x.id === id)
    if (!d) return
    document.getElementById('drink-edit-id').value = d.id
    document.getElementById('drink-name').value = d.name
    document.getElementById('drink-desc').value = d.description || ''
    document.getElementById('drink-photo').value = d.photo_url || ''
  }
  if (action === 'delete-drink') {
    if (!confirm('Delete this drink?')) return
    await supabase.from('drinks').delete().eq('id', id)
    loadMenuAdmin()
  }
})

document.getElementById('save-drink-btn').addEventListener('click', async () => {
  const id = document.getElementById('drink-edit-id').value
  const name = document.getElementById('drink-name').value.trim()
  const description = document.getElementById('drink-desc').value.trim()
  const photo_url = document.getElementById('drink-photo').value.trim() || null
  const status = document.getElementById('drink-status')
  if (!name) { status.textContent = 'Name is required'; status.className = 'error'; return }

  if (id) {
    await supabase.from('drinks').update({ name, description, photo_url }).eq('id', id)
  } else {
    await supabase.from('drinks').insert({ name, description, photo_url, active: true })
  }
  status.textContent = 'Saved!'
  status.className = 'success'
  document.getElementById('clear-drink-btn').click()
  loadMenuAdmin()
})

document.getElementById('clear-drink-btn').addEventListener('click', () => {
  document.getElementById('drink-edit-id').value = ''
  document.getElementById('drink-name').value = ''
  document.getElementById('drink-desc').value = ''
  document.getElementById('drink-photo').value = ''
  document.getElementById('drink-status').textContent = ''
})

// --- COMMENTS ---
async function loadPendingComments() {
  const { data } = await supabase
    .from('comments')
    .select('id, author_name, body, drink_id, drinks(name)')
    .eq('approved', false)
    .order('created_at')
  const el = document.getElementById('pending-comments')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No pending comments.</p>'
    return
  }
  el.innerHTML = ''
  data.forEach(c => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div>
        <div class="muted" style="font-size:0.8rem;margin-bottom:0.25rem">${c.drink_id ? `On: ${escapeHtml(c.drinks?.name)}` : 'General comment'}</div>
        <strong>${escapeHtml(c.author_name) || 'Anonymous'}</strong>: ${escapeHtml(c.body)}
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-approve" data-id="${escapeHtml(c.id)}" data-action="approve-comment">Approve</button>
        <button class="btn btn-sm btn-danger" data-id="${escapeHtml(c.id)}" data-action="delete-comment">Delete</button>
      </div>
    `
    el.appendChild(row)
  })
}

document.getElementById('pending-comments').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id
  if (btn.dataset.action === 'approve-comment') {
    await supabase.from('comments').update({ approved: true }).eq('id', id)
  } else if (btn.dataset.action === 'delete-comment') {
    await supabase.from('comments').delete().eq('id', id)
  }
  loadPendingComments()
})



document.getElementById('add-attendee-btn').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value.trim().toLowerCase()
  const alias = document.getElementById('new-alias').value.trim()
  const status = document.getElementById('attendee-status')
  if (!username) { status.textContent = 'Username is required'; status.className = 'error'; return }
  const { error } = await supabase.from('attendees').insert({ username, alias: alias || null, pin_hash: '', credits: 0 })
  if (error) {
    status.textContent = error.code === '23505' ? 'Username already exists' : 'Failed to add attendee'
    status.className = 'error'
    return
  }
  status.textContent = 'Attendee added! Share their username so they can set their PIN.'
  status.className = 'success'
  document.getElementById('new-username').value = ''
  document.getElementById('new-alias').value = ''
  loadSignupsAdmin()
})


// --- WISHLIST ---
async function loadWishlistAdmin() {
  const { data } = await supabase.from('wishlist').select('*').order('credit_value', { ascending: false })
  const el = document.getElementById('wishlist-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No wishlist items yet.</p>'
    return
  }
  el.innerHTML = ''
  data.forEach(w => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(w.item_name)}</strong>
        <span class="badge" style="margin-left:0.5rem">${escapeHtml(String(w.credit_value))} credits</span>
        ${!w.active ? '<span class="muted" style="margin-left:0.5rem">(inactive)</span>' : ''}
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-outline"
          data-id="${escapeHtml(w.id)}"
          data-active="${w.active}"
          data-action="toggle-wishlist">${w.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-sm btn-danger" data-id="${escapeHtml(w.id)}" data-action="delete-wishlist">Delete</button>
      </div>
    `
    el.appendChild(row)
  })
}

document.getElementById('wishlist-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id
  if (btn.dataset.action === 'toggle-wishlist') {
    const current = btn.dataset.active === 'true'
    await supabase.from('wishlist').update({ active: !current }).eq('id', id)
    loadWishlistAdmin()
  }
  if (btn.dataset.action === 'delete-wishlist') {
    await supabase.from('wishlist').delete().eq('id', id)
    loadWishlistAdmin()
  }
})

document.getElementById('add-wishlist-btn').addEventListener('click', async () => {
  const item_name = document.getElementById('wishlist-name').value.trim()
  const credit_value = parseInt(document.getElementById('wishlist-credits').value)
  const status = document.getElementById('wishlist-status')
  if (!item_name || isNaN(credit_value) || credit_value < 1) {
    status.textContent = 'Both fields are required (credit value must be at least 1)'
    status.className = 'error'
    return
  }
  await supabase.from('wishlist').insert({ item_name, credit_value, active: true })
  status.textContent = 'Added!'
  status.className = 'success'
  document.getElementById('wishlist-name').value = ''
  document.getElementById('wishlist-credits').value = ''
  loadWishlistAdmin()
})

// --- SIGNUPS ---
async function loadSignupsAdmin() {
  const { data } = await supabase
    .from('attendees')
    .select('id, username, alias, gender, gender_visibility, created_at')
    .order('created_at', { ascending: false })

  const el = document.getElementById('signups-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No attendees yet.</p>'
    return
  }

  el.innerHTML = ''
  data.forEach(a => {
    const row = document.createElement('div')
    row.className = 'item-row'

    const genderVal = a.gender || ''
    const visVal    = a.gender_visibility || 'admin_only'
    // Note: the spec mentions showing a "self-reported vs admin-override" label.
    // The data model has only one `gender` column — there is no separate self-reported column.
    // Once the admin changes it, the original value is gone. We show the "(prefers not to say)"
    // label only when gender is null (the guest's default). This is the maximum precision
    // the current schema supports.
    const selfLabel = !a.gender
      ? `<span class="muted" style="font-size:0.78rem;font-style:italic"> (prefers not to say)</span>`
      : ''

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(a.alias || a.username)}</strong>
        <span class="muted"> @${escapeHtml(a.username)}</span>${selfLabel}
        <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
      <div class="gender-controls">
        <select class="gender-select" data-attendee-id="${escapeHtml(a.id)}">
          <option value=""${genderVal === '' ? ' selected' : ''}>Prefer not to say</option>
          <option value="male"${genderVal === 'male' ? ' selected' : ''}>Male</option>
          <option value="female"${genderVal === 'female' ? ' selected' : ''}>Female</option>
          <option value="non-binary"${genderVal === 'non-binary' ? ' selected' : ''}>Non-binary</option>
        </select>
        <div class="vis-toggle">
          <button class="vis-opt${visVal === 'admin_only' ? ' active' : ''}" data-attendee-id="${escapeHtml(a.id)}" data-vis="admin_only">Admin only</button>
          <button class="vis-opt${visVal === 'public' ? ' active' : ''}" data-attendee-id="${escapeHtml(a.id)}" data-vis="public">Visible to all</button>
        </div>
      </div>
    `
    el.appendChild(row)
  })

  // Gender select: auto-save on change
  el.querySelectorAll('.gender-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const update = { gender: sel.value || null }
      await supabase.from('attendees').update(update).eq('id', sel.dataset.attendeeId)
    })
  })

  // Visibility toggle: auto-save on click
  el.querySelectorAll('.vis-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const siblings = btn.closest('.vis-toggle').querySelectorAll('.vis-opt')
      siblings.forEach(s => s.classList.remove('active'))
      btn.classList.add('active')
      await supabase.from('attendees')
        .update({ gender_visibility: btn.dataset.vis })
        .eq('id', btn.dataset.attendeeId)
    })
  })
}


// --- SETTINGS ---
document.getElementById('save-passcode-btn').addEventListener('click', async () => {
  const val = document.getElementById('new-passcode').value.trim()
  const status = document.getElementById('passcode-status')
  if (!val) { status.textContent = 'Enter a passcode'; status.className = 'error'; return }
  const { error } = await supabase.from('settings').update({ value: val }).eq('key', 'site_passcode')
  if (error) { status.textContent = 'Update failed'; status.className = 'error'; return }
  status.textContent = 'Passcode updated!'
  status.className = 'success'
  document.getElementById('new-passcode').value = ''
})

document.getElementById('create-event-btn').addEventListener('click', async () => {
  const title    = document.getElementById('event-title').value.trim()
  const date     = document.getElementById('event-date').value
  const capacity = parseInt(document.getElementById('event-capacity').value)
  const type     = document.getElementById('event-type').value
  const showCount  = document.getElementById('show-count').checked
  const showNames  = document.getElementById('show-names').checked
  const showGender = document.getElementById('show-gender').checked
  const statusEl = document.getElementById('event-create-status')

  if (!title || !date || isNaN(capacity) || capacity < 1) {
    statusEl.textContent = 'Title, date, and capacity are required.'
    statusEl.className = 'error'
    return
  }

  const { error } = await supabase.from('events').insert({
    title, event_date: date, capacity, event_type: type,
    show_count: showCount, show_names: showNames, show_gender: showGender,
    status: 'open'
  })

  if (error) {
    statusEl.textContent = 'Failed to create event.'
    statusEl.className = 'error'
    return
  }

  statusEl.textContent = 'Event created!'
  statusEl.className = 'success'
  document.getElementById('event-title').value = ''
  document.getElementById('event-date').value = ''
  document.getElementById('event-capacity').value = '6'
  document.getElementById('event-type').value = 'open'
  document.getElementById('show-count').checked = false
  document.getElementById('show-names').checked = false
  document.getElementById('show-gender').checked = false
  loadEventsAdmin()
})

// ============================================================
// EVENTS TAB
// ============================================================

async function loadEventsAdmin() {
  const { data: events } = await supabase
    .from('events')
    .select('*, reservations(id, status, guest_count, message, created_at, attendees(username, alias))')
    .order('event_date', { ascending: false })

  const container = document.getElementById('events-admin-list')
  if (!events || events.length === 0) {
    container.innerHTML = '<p class="muted">No events yet.</p>'
    return
  }

  container.innerHTML = ''
  events.forEach(ev => {
    const block = document.createElement('div')
    block.className = 'event-block'
    block.innerHTML = buildEventBlockHtml(ev)
    container.appendChild(block)
  })

  attachEventBlockHandlers(container)
}

function buildEventBlockHtml(ev) {
  const reservations = ev.reservations || []
  const confirmed = reservations.filter(r => r.status === 'confirmed')
  const waitlisted = reservations.filter(r => r.status === 'waitlisted')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const interested = reservations.filter(r => r.status === 'interested')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const usedSlots = confirmed.reduce((s, r) => s + r.guest_count, 0)
  const isCurated = ev.event_type === 'curated'
  const typeBadge = isCurated
    ? `<span class="badge" style="border-color:rgba(184,156,216,0.3);color:#B89CD8;font-size:0.7rem">Curated</span>`
    : `<span class="badge" style="font-size:0.7rem">Open</span>`

  const slotInfo = isCurated
    ? `${confirmed.length} confirmed`
    : `${usedSlots} / ${ev.capacity} slots`

  const displayOpts = `
    <div class="display-opts-inline" style="margin-left:0.5rem">
      <span style="font-size:0.72rem;color:var(--muted)">Show:</span>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_count"${ev.show_count ? ' checked' : ''}> Count</label>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_names"${ev.show_names ? ' checked' : ''}> Names</label>
      <label><input type="checkbox" class="disp-opt" data-event-id="${escapeHtml(ev.id)}" data-field="show_gender"${ev.show_gender ? ' checked' : ''}> Gender</label>
    </div>`

  const statusBadge = ev.status === 'open'
    ? `<span class="badge" style="color:var(--green);border-color:rgba(106,158,120,0.3);font-size:0.7rem">Open</span>`
    : `<span class="badge" style="font-size:0.7rem">${escapeHtml(ev.status)}</span>`

  const toggleLabel = ev.status === 'open' ? 'Close' : 'Reopen'

  // Confirmed section
  const confirmedRows = confirmed.map(r => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const plusBadge = r.guest_count === 2 ? `<span class="badge" style="margin-left:0.3rem;font-size:0.65rem">+1</span>` : ''
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong>${name}</strong> <span class="muted">@${handle}</span>${plusBadge}${msg}</div>
        <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="remove">Remove</button>
      </div>`
  }).join('')

  // Waitlist section (open events)
  const waitlistRows = waitlisted.map((r, i) => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong style="color:var(--muted)">${name}</strong> <span class="muted">@${handle}</span> <span style="font-size:0.75rem;color:#C9A030;margin-left:0.3rem">#${i + 1}</span>${msg}</div>
        <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="decline">Decline</button>
      </div>`
  }).join('')

  // Interested section (curated events)
  const interestedRows = interested.map(r => {
    const name = escapeHtml(r.attendees.alias || r.attendees.username)
    const handle = escapeHtml(r.attendees.username)
    const msg = r.message ? `<div class="attendee-msg">"${escapeHtml(r.message)}"</div>` : `<div class="attendee-msg" style="opacity:0.4">No note</div>`
    return `
      <div class="event-attendee-row">
        <div><strong>${name}</strong> <span class="muted">@${handle}</span>${msg}</div>
        <div style="display:flex;gap:0.4rem;flex-shrink:0">
          <button class="btn btn-sm btn-approve res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="confirm">Confirm</button>
          <button class="btn btn-sm btn-danger res-action-btn" data-res-id="${escapeHtml(r.id)}" data-action="decline">Decline</button>
        </div>
      </div>`
  }).join('')

  const confirmedSection = confirmedRows
    ? `<div class="event-section-label">Confirmed${isCurated ? '' : ` — ${usedSlots} slots used`}</div>${confirmedRows}`
    : `<div class="event-section-label">Confirmed</div><p class="muted" style="font-size:0.85rem;padding:0.3rem 0">None yet.</p>`

  const secondarySection = isCurated
    ? (interestedRows
        ? `<div class="event-section-label" style="margin-top:0.5rem">Expressions of Interest</div>${interestedRows}`
        : `<div class="event-section-label" style="margin-top:0.5rem">Expressions of Interest</div><p class="muted" style="font-size:0.85rem;padding:0.3rem 0">None yet.</p>`)
    : (waitlistRows
        ? `<div class="event-section-label" style="margin-top:0.5rem">Waitlist</div>${waitlistRows}`
        : '')

  return `
    <div class="event-block-header" data-event-id="${escapeHtml(ev.id)}">
      <div>
        <div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.1em;font-family:'Cinzel',serif">${escapeHtml(ev.event_date)}</div>
        <div style="font-size:1.05rem;color:var(--cream);margin-top:0.1rem">${escapeHtml(ev.title)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span style="font-size:0.78rem;color:var(--muted)">${escapeHtml(slotInfo)}</span>
        ${typeBadge}
        ${statusBadge}
        ${displayOpts}
        <button class="btn btn-sm toggle-status-btn" data-event-id="${escapeHtml(ev.id)}" data-current="${escapeHtml(ev.status)}">${toggleLabel}</button>
      </div>
    </div>
    <div class="event-block-body" style="display:none">
      ${confirmedSection}
      ${secondarySection}
    </div>
  `
}

function attachEventBlockHandlers(container) {
  // Expand / collapse
  container.querySelectorAll('.event-block-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return
      const body = header.nextElementSibling
      body.style.display = body.style.display === 'none' ? 'block' : 'none'
    })
  })

  // Toggle event status (open ↔ closed)
  container.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const newStatus = btn.dataset.current === 'open' ? 'closed' : 'open'
      await supabase.from('events').update({ status: newStatus }).eq('id', btn.dataset.eventId)
      loadEventsAdmin()
    })
  })

  // Display option checkboxes (auto-save on change)
  container.querySelectorAll('.disp-opt').forEach(cb => {
    cb.addEventListener('change', async e => {
      e.stopPropagation()
      const update = { [cb.dataset.field]: cb.checked }
      await supabase.from('events').update(update).eq('id', cb.dataset.eventId)
    })
  })

  // Reservation actions (confirm / decline / remove)
  container.querySelectorAll('.res-action-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const { action, resId } = btn.dataset
      let newStatus = ''
      if (action === 'confirm') newStatus = 'confirmed'
      else if (action === 'decline') newStatus = 'declined'
      else if (action === 'remove')  newStatus = 'removed'

      if (!newStatus) return
      btn.disabled = true
      await supabase.from('reservations').update({ status: newStatus }).eq('id', resId)
      loadEventsAdmin()
    })
  })
}
