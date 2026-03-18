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
  const { data } = await supabase.from('attendees').select('*').order('created_at', { ascending: false })
  const el = document.getElementById('signups-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No attendees yet.</p>'
    return
  }
  el.innerHTML = ''
  data.forEach(a => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(a.alias || a.username)}</strong>
        <span class="muted"> @${escapeHtml(a.username)}</span>
        <div class="muted" style="font-size:0.8rem;margin-top:0.2rem">${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
    `
    el.appendChild(row)
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
