# Feature Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the gallery page, credit system, and order system from ERSHU.25; retain Open Bar page scoped to Login/Sign Up and Wishlist only.

**Architecture:** Hard delete — remove files, strip HTML/CSS/JS sections, clean up admin panel. No feature flags. No backwards-compatibility shims.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Supabase backend. No build step — edits take effect immediately.

---

## Chunk 1: Files, Nav, and Home Page

### Task 1: Delete gallery files

**Files:**
- Delete: `gallery.html`
- Delete: `js/gallery.js`

- [ ] **Step 1: Remove files and stage the deletion**

```bash
cd /Users/negomiaoz/Desktop/ershu.25 && git rm gallery.html js/gallery.js
```

Expected: `rm 'gallery.html'` and `rm 'js/gallery.js'` printed by git

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: remove gallery page and JS"
```

---

### Task 2: Remove gallery link from nav

**Files:**
- Modify: `js/nav.js`

Current line 7: `{ href: '/gallery.html', label: '相册', labelEn: 'Gallery' },`

- [ ] **Step 1: Remove the gallery entry from the pages array**

Replace the `pages` array in `js/nav.js` with:

```js
const pages = [
  { href: '/home.html', label: '首页', labelEn: 'Home' },
  { href: '/menu.html', label: '酒单', labelEn: 'Menu' },
  { href: '/community.html', label: '社区', labelEn: 'Community' },
  { href: '/openbar.html', label: 'Open Bar', labelEn: 'Open Bar' },
]
```

- [ ] **Step 2: Verify no gallery reference remains**

```bash
grep -n "gallery" /Users/negomiaoz/Desktop/ershu.25/js/nav.js
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add js/nav.js
git commit -m "feat: remove gallery nav link"
```

---

### Task 3: Update home.html — remove gallery card, update Open Bar card copy

**Files:**
- Modify: `home.html`

- [ ] **Step 1: Remove the gallery feature card (lines 83–87)**

Remove this block entirely:

```html
      <a href="/gallery.html" class="card" style="text-decoration:none">
        <span class="eyebrow" data-zh="回忆" data-en="Memories">回忆</span>
        <h3 data-zh="相册" data-en="Gallery">相册</h3>
        <p class="muted" style="margin-top:0.4rem;font-style:italic;font-size:0.95rem" data-zh="往日美好瞬间" data-en="Moments from past evenings">往日美好瞬间</p>
      </a>
```

- [ ] **Step 2: Update the Open Bar feature card (lines 93–97)**

Replace:

```html
      <a href="/openbar.html" class="card" style="text-decoration:none">
        <span class="eyebrow" data-zh="积分" data-en="Credits">积分</span>
        <h3 data-zh="Open Bar" data-en="OpenBar">Open Bar</h3>
        <p class="muted" style="margin-top:0.4rem;font-style:italic;font-size:0.95rem" data-zh="带瓶酒，换一杯" data-en="Bring a bottle, order a drink">带瓶酒，换一杯</p>
      </a>
```

With:

```html
      <a href="/openbar.html" class="card" style="text-decoration:none">
        <span class="eyebrow" data-zh="Open Bar" data-en="Open Bar">Open Bar</span>
        <h3 data-zh="Open Bar" data-en="Open Bar">Open Bar</h3>
        <p class="muted" style="margin-top:0.4rem;font-style:italic;font-size:0.95rem" data-zh="查看愿望单，登录账户" data-en="Browse the wishlist and sign in to your account">查看愿望单，登录账户</p>
      </a>
```

- [ ] **Step 3: Note — hero CTA button is intentionally left untouched**

The hero CTA button at line 48 (`<a href="/openbar.html" class="btn" data-zh="Open Bar" data-en="OpenBar">Open Bar</a>`) is intentionally left as-is. Do not modify it.

- [ ] **Step 4: Verify no gallery reference remains in home.html**

```bash
grep -n "gallery" /Users/negomiaoz/Desktop/ershu.25/home.html
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add home.html
git commit -m "feat: remove gallery card and update Open Bar card copy on home page"
```

---

## Chunk 2: Open Bar Page

### Task 4: Strip openbar.html — CSS and HTML sections

**Files:**
- Modify: `openbar.html`

- [ ] **Step 1: Remove dead CSS from the `<style>` block**

Remove the `.order-row`, `.order-row:last-child`, `select`, and `select:focus` rules (lines 54–77). Keep everything before line 54 and the closing `</style>` tag. Use the full replacement block below.

Replace the full `<style>` block with:

```html
  <style>
    .auth-container { max-width: 460px; margin: 0 auto; }
    .auth-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }
    .auth-tab {
      font-family: 'Cinzel', serif;
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      padding: 0.7rem 1.25rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--muted);
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
      margin-bottom: -1px;
    }
    .auth-tab.active { color: var(--gold); border-bottom-color: var(--gold); }
    .auth-panel { display: none; }
    .auth-panel.active { display: block; animation: fadeUp 0.3s ease both; }

    .dashboard { max-width: 720px; margin: 0 auto; }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 1rem;
    }
    .dashboard-name { font-size: clamp(1.5rem, 4vw, 2.2rem); color: var(--cream); margin-bottom: 0.3rem; }
    .wishlist-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 0;
      border-bottom: 1px solid rgba(201,168,76,0.08);
    }
    .wishlist-row:last-child { border: none; }
    .wishlist-name { color: var(--text); }
  </style>
```

- [ ] **Step 2: Update page header copy**

Replace:

```html
        <span class="eyebrow" data-zh="积分系统" data-en="Credits System">积分系统</span>
        <h1>Open Bar</h1>
        <p data-zh="带瓶酒，赚积分，点饮品" data-en="Bring a bottle, earn credits, order drinks">带瓶酒，赚积分，点饮品</p>
```

With:

```html
        <span class="eyebrow" data-zh="Open Bar" data-en="Open Bar">Open Bar</span>
        <h1>Open Bar</h1>
        <p data-zh="查看愿望单，登录账户" data-en="Browse the wishlist and sign in to your account">查看愿望单，登录账户</p>
```

- [ ] **Step 3: Update Sign Up panel body text**

Replace:

```html
            <p style="font-style:italic;color:var(--muted);margin-bottom:1.25rem;font-size:0.95rem"
              data-zh="创建您的Open Bar账户。带一瓶愿望单上的酒来赚取积分。"
              data-en="Create your Open Bar account. Bring a bottle from the wishlist to earn credits.">
              创建您的Open Bar账户。带一瓶愿望单上的酒来赚取积分。
            </p>
```

With:

```html
            <p style="font-style:italic;color:var(--muted);margin-bottom:1.25rem;font-size:0.95rem"
              data-zh="创建账户以查看愿望单。"
              data-en="Create an account to browse the wishlist.">
              创建账户以查看愿望单。
            </p>
```

- [ ] **Step 4: Remove credits badge from dashboard header**

Remove line 142:

```html
            <span class="badge" id="credits-display">0 credits</span>
```

- [ ] **Step 5: Replace the dashboard grid (with Order a Drink card) with just the Wishlist card**

Replace lines 149–163:

```html
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem">
          <div class="card fade-in-2">
            <span class="eyebrow" data-zh="带什么来" data-en="What to Bring">带什么来</span>
            <h2 style="margin-bottom:1rem" data-zh="愿望单" data-en="Wishlist">愿望单</h2>
            <div id="wishlist-list"></div>
          </div>

          <div class="card fade-in-3">
            <span class="eyebrow" data-zh="兑换积分" data-en="Redeem Credits">兑换积分</span>
            <h2 style="margin-bottom:1rem" data-zh="点一杯" data-en="Order a Drink">点一杯</h2>
            <select id="order-drink"></select>
            <button class="btn btn-solid" id="order-btn" style="width:100%" data-zh="下单" data-en="Place Order">下单</button>
            <span id="order-status"></span>
          </div>
        </div>
```

With:

```html
        <div class="card fade-in-2">
          <span class="eyebrow" data-zh="带什么来" data-en="What to Bring">带什么来</span>
          <h2 style="margin-bottom:1rem" data-zh="愿望单" data-en="Wishlist">愿望单</h2>
          <div id="wishlist-list"></div>
        </div>
```

- [ ] **Step 6: Remove the Order History card**

Remove lines 165–169:

```html
        <div class="card fade-in-4" style="margin-top:1.25rem">
          <span class="eyebrow" data-zh="历史" data-en="History">历史</span>
          <h2 style="margin-bottom:1rem" data-zh="我的订单" data-en="My Orders">我的订单</h2>
          <div id="order-history"></div>
        </div>
```

- [ ] **Step 7: Verify no order/credits HTML IDs remain**

```bash
grep -n "order-drink\|order-btn\|order-history\|credits-display\|order-status" /Users/negomiaoz/Desktop/ershu.25/openbar.html
```

Expected: no output

- [ ] **Step 8: Commit**

```bash
git add openbar.html
git commit -m "feat: strip credits and order HTML/CSS from openbar page"
```

---

### Task 5: Strip openbar.html — inline script block

**Files:**
- Modify: `openbar.html` (script section, lines 174–354)

- [ ] **Step 1: Update the imports**

Replace lines 175–180:

```js
    import { requirePasscode, loginAttendee, getAttendeeSession, logoutAttendee, setPin, hashPin } from './js/auth.js'
    import { renderNav, renderFooter, initLang } from './js/nav.js'
    import { loadWishlist, loadAttendeeOrders, placeOrder, refreshAttendeeCredits } from './js/openbar.js'
    import { loadDrinks } from './js/menu.js'
    import { supabase } from './js/supabase-client.js'
    import { t, getLang } from './js/i18n.js'
```

With:

```js
    import { requirePasscode, loginAttendee, getAttendeeSession, logoutAttendee, hashPin } from './js/auth.js'
    import { renderNav, renderFooter, initLang } from './js/nav.js'
    import { loadWishlist } from './js/openbar.js'
    import { supabase } from './js/supabase-client.js'
    import { t } from './js/i18n.js'
```

- [ ] **Step 2: Remove the order-btn click handler (lines 273–289)**

Remove this entire block:

```js
    // Order button
    document.getElementById('order-btn').addEventListener('click', async () => {
      if (!currentAttendee) return
      const drinkId = document.getElementById('order-drink').value
      const statusEl = document.getElementById('order-status')
      if (!drinkId) return
      const result = await placeOrder(currentAttendee.id, drinkId)
      if (result.ok) {
        statusEl.textContent = t('订单已提交，等待审核', 'Order submitted, awaiting approval')
        statusEl.className = 'success'
        const newCredits = await refreshAttendeeCredits(currentAttendee.id)
        if (newCredits !== null) document.getElementById('credits-display').textContent = `${newCredits} ${t('积分', 'credits')}`
      } else {
        statusEl.textContent = result.reason
        statusEl.className = 'error'
      }
    })
```

- [ ] **Step 3: Replace showDashboard() with a stripped version**

Replace the entire `showDashboard` function (lines 291–353) with:

```js
    async function showDashboard(attendee) {
      currentAttendee = attendee
      document.getElementById('auth-section').style.display = 'none'
      document.getElementById('dashboard-section').style.display = 'block'
      document.getElementById('greeting').textContent = attendee.alias || attendee.username

      // Wishlist
      const wishlist = await loadWishlist()
      const wishlistEl = document.getElementById('wishlist-list')
      if (wishlist.length === 0) {
        wishlistEl.innerHTML = `<p class="muted" style="font-style:italic">${t('暂无愿望单', 'No items on the wishlist')}</p>`
      } else {
        wishlist.forEach(w => {
          const row = document.createElement('div')
          row.className = 'wishlist-row'
          row.innerHTML = `<span class="wishlist-name">${escapeHtml(w.item_name)}</span>`
          wishlistEl.appendChild(row)
        })
      }

      // apply lang to newly rendered static data-zh/en elements
      const { applyLang } = await import('./js/i18n.js')
      applyLang()
    }
```

- [ ] **Step 4: Verify no dead imports or references remain**

```bash
grep -n "loadAttendeeOrders\|placeOrder\|refreshAttendeeCredits\|loadDrinks\|getLang\|setPin\|order-drink\|order-btn\|order-status\|order-history\|credits-display" /Users/negomiaoz/Desktop/ershu.25/openbar.html
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add openbar.html
git commit -m "feat: strip credits and order logic from openbar script"
```

---

### Task 6: Strip js/openbar.js

**Files:**
- Modify: `js/openbar.js`

- [ ] **Step 1: Replace file content — keep only loadWishlist()**

Replace the entire file with:

```js
import { supabase } from './supabase-client.js'

export async function loadWishlist() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('item_name, credit_value')
    .eq('active', true)
    .order('credit_value', { ascending: false })
  return error ? [] : data
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "placeOrder\|loadAttendeeOrders\|refreshAttendeeCredits" /Users/negomiaoz/Desktop/ershu.25/js/openbar.js
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add js/openbar.js
git commit -m "feat: remove placeOrder, loadAttendeeOrders, refreshAttendeeCredits from openbar.js"
```

---

## Chunk 3: Admin Panel

### Task 7: Update admin/index.html

**Files:**
- Modify: `admin/index.html`

- [ ] **Step 1: Remove gallery CSS (lines 25–43)**

Remove these rules from the `<style>` block:

```css
    .pending-photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
    }
    .pending-photo-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 0.75rem;
    }
    .pending-photo-card img {
      width: 100%;
      height: 130px;
      object-fit: cover;
      border-radius: 2px;
      display: block;
      margin-bottom: 0.6rem;
    }
```

- [ ] **Step 2: Remove Gallery and OpenBar tab buttons (lines 84–85)**

Remove:

```html
      <button class="tab-btn" data-tab="gallery">Gallery</button>
      <button class="tab-btn" data-tab="openbar">OpenBar</button>
```

- [ ] **Step 3: Remove Gallery tab panel (lines 118–122)**

Remove:

```html
    <!-- GALLERY TAB -->
    <div class="tab-panel" id="tab-gallery">
      <h2>Pending Photos</h2>
      <div id="pending-photos" class="pending-photo-grid"></div>
    </div>
```

- [ ] **Step 4: Remove OpenBar tab panel (lines 124–144)**

Remove:

```html
    <!-- OPENBAR TAB -->
    <div class="tab-panel" id="tab-openbar">
      <h2>Add Attendee</h2>
      <div class="card">
        <div class="form-row">
          <div><label>Username</label><input type="text" id="new-username" placeholder="they choose this"></div>
          <div><label>Alias (your nickname)</label><input type="text" id="new-alias" placeholder="e.g. Big Mike"></div>
        </div>
        <label>Starting Credits</label>
        <input type="number" id="new-credits" value="0" min="0" style="width:120px">
        <div style="margin-top:0.75rem">
          <button class="btn" id="add-attendee-btn">Add Attendee</button>
        </div>
        <p id="attendee-status" style="margin-top:0.5rem"></p>
        <p class="muted" style="margin-top:0.5rem;font-size:0.82rem">Attendee sets their own PIN on first login.</p>
      </div>
      <div id="attendees-list" style="margin-top:1.5rem"></div>

      <h2 style="margin-top:2rem">Pending Orders</h2>
      <div id="pending-orders"></div>
    </div>
```

- [ ] **Step 5: Update the Signups tab — add Add Attendee form (without Starting Credits) and update description**

Replace the Signups tab panel (lines 146–153):

```html
    <!-- SIGNUPS TAB -->
    <div class="tab-panel" id="tab-signups">
      <div class="section-title">
        <h2>All Attendees</h2>
      </div>
      <p class="muted" style="margin-bottom:1.5rem;font-size:0.9rem">Guests who signed up directly appear here. You can add credits to any attendee.</p>
      <div id="signups-list"></div>
    </div>
```

With:

```html
    <!-- SIGNUPS TAB -->
    <div class="tab-panel" id="tab-signups">
      <div class="section-title">
        <h2>All Attendees</h2>
      </div>
      <p class="muted" style="margin-bottom:1.5rem;font-size:0.9rem">Manage attendee accounts. Add new attendees or view existing sign-ups.</p>
      <div class="card" style="margin-bottom:1.5rem">
        <div class="form-row">
          <div><label>Username</label><input type="text" id="new-username" placeholder="they choose this"></div>
          <div><label>Alias (your nickname)</label><input type="text" id="new-alias" placeholder="e.g. Big Mike"></div>
        </div>
        <div style="margin-top:0.75rem">
          <button class="btn" id="add-attendee-btn">Add Attendee</button>
        </div>
        <p id="attendee-status" style="margin-top:0.5rem"></p>
        <p class="muted" style="margin-top:0.5rem;font-size:0.82rem">Attendee sets their own PIN on first login.</p>
      </div>
      <div id="signups-list"></div>
    </div>
```

- [ ] **Step 6: Verify no gallery or openbar tab references remain**

```bash
grep -n "gallery\|openbar\|pending-photos\|pending-orders\|attendees-list\|new-credits" /Users/negomiaoz/Desktop/ershu.25/admin/index.html
```

Expected: no output

- [ ] **Step 7: Commit**

```bash
git add admin/index.html
git commit -m "feat: remove gallery and openbar admin tabs, move Add Attendee form to Signups tab"
```

---

### Task 8: Update admin/js/admin-main.js

**Files:**
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Update showAdmin() — remove three function calls**

Replace lines 42–52:

```js
function showAdmin() {
  document.getElementById('login-view').style.display = 'none'
  document.getElementById('admin-view').style.display = 'block'
  loadMenuAdmin()
  loadPendingComments()
  loadPendingPhotos()
  loadAttendeesAdmin()
  loadPendingOrders()
  loadWishlistAdmin()
  loadSignupsAdmin()
}
```

With:

```js
function showAdmin() {
  document.getElementById('login-view').style.display = 'none'
  document.getElementById('admin-view').style.display = 'block'
  loadMenuAdmin()
  loadPendingComments()
  loadWishlistAdmin()
  loadSignupsAdmin()
}
```

- [ ] **Step 2: Remove the entire GALLERY section (lines 171–217)**

Remove this block in full:

```js
// --- GALLERY ---
async function loadPendingPhotos() {
  const { data } = await supabase.from('photos').select('*').eq('approved', false).order('created_at')
  const el = document.getElementById('pending-photos')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No pending photos.</p>'
    return
  }
  el.innerHTML = ''
  data.forEach(p => {
    const card = document.createElement('div')
    card.className = 'pending-photo-card'
    const img = document.createElement('img')
    img.src = p.url.startsWith('http') ? p.url : ''
    img.alt = p.caption || 'Pending photo'
    card.appendChild(img)
    if (p.caption) {
      const cap = document.createElement('p')
      cap.className = 'muted'
      cap.style.fontSize = '0.82rem'
      cap.style.marginBottom = '0.5rem'
      cap.textContent = p.caption
      card.appendChild(cap)
    }
    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.gap = '0.5rem'
    btnRow.innerHTML = `
      <button class="btn btn-sm btn-approve" data-id="${escapeHtml(p.id)}" data-action="approve-photo">Approve</button>
      <button class="btn btn-sm btn-danger" data-id="${escapeHtml(p.id)}" data-action="delete-photo">Delete</button>
    `
    card.appendChild(btnRow)
    el.appendChild(card)
  })
}

document.getElementById('pending-photos').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id
  if (btn.dataset.action === 'approve-photo') {
    await supabase.from('photos').update({ approved: true }).eq('id', id)
  } else if (btn.dataset.action === 'delete-photo') {
    await supabase.from('photos').delete().eq('id', id)
  }
  loadPendingPhotos()
})
```

- [ ] **Step 3: Remove the entire OPENBAR: ATTENDEES section (lines 219–266)**

Remove this block in full:

```js
// --- OPENBAR: ATTENDEES ---
async function loadAttendeesAdmin() {
  const { data } = await supabase.from('attendees').select('*').order('created_at')
  const el = document.getElementById('attendees-list')
  if (!data || data.length === 0) {
    el.innerHTML = '<h3 style="margin-bottom:0.75rem">Attendees</h3><p class="muted">No attendees yet.</p>'
    return
  }
  el.innerHTML = '<h3 style="margin-bottom:0.75rem">Attendees</h3>'
  data.forEach(a => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(a.alias || a.username)}</strong>
        <span class="muted"> (${escapeHtml(a.username)})</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
        <span class="badge">${escapeHtml(String(a.credits))} credits</span>
        <input type="number" class="add-credit-input" data-id="${escapeHtml(a.id)}" data-current="${a.credits}" min="1" placeholder="Add credits" style="width:110px;margin:0">
        <button class="btn btn-sm" data-id="${escapeHtml(a.id)}" data-action="add-credits">Add</button>
        <button class="btn btn-sm btn-danger" data-id="${escapeHtml(a.id)}" data-action="delete-attendee">Remove</button>
      </div>
    `
    el.appendChild(row)
  })
}

document.getElementById('attendees-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id

  if (btn.dataset.action === 'add-credits') {
    const input = document.querySelector(`.add-credit-input[data-id="${id}"]`)
    const amount = parseInt(input.value)
    if (isNaN(amount) || amount <= 0) return
    const { data: att } = await supabase.from('attendees').select('credits').eq('id', id).single()
    const current = att ? att.credits : 0
    await supabase.from('attendees').update({ credits: current + amount }).eq('id', id)
    loadAttendeesAdmin()
  }
  if (btn.dataset.action === 'delete-attendee') {
    if (!confirm('Remove this attendee?')) return
    await supabase.from('attendees').delete().eq('id', id)
    loadAttendeesAdmin()
  }
})
```

- [ ] **Step 4: Replace the add-attendee-btn handler (lines 268–286) with a stripped version**

Remove:

```js
document.getElementById('add-attendee-btn').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value.trim().toLowerCase()
  const alias = document.getElementById('new-alias').value.trim()
  const credits = parseInt(document.getElementById('new-credits').value) || 0
  const status = document.getElementById('attendee-status')
  if (!username) { status.textContent = 'Username is required'; status.className = 'error'; return }
  const { error } = await supabase.from('attendees').insert({ username, alias: alias || null, pin_hash: '', credits })
  if (error) {
    status.textContent = error.code === '23505' ? 'Username already exists' : 'Failed to add attendee'
    status.className = 'error'
    return
  }
  status.textContent = 'Attendee added! Share their username so they can set their PIN.'
  status.className = 'success'
  document.getElementById('new-username').value = ''
  document.getElementById('new-alias').value = ''
  document.getElementById('new-credits').value = '0'
  loadAttendeesAdmin()
})
```

Add in its place:

```js
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
```

- [ ] **Step 5: Remove the entire OPENBAR: ORDERS section (lines 288–349)**

Remove this block in full:

```js
// --- OPENBAR: ORDERS ---
async function loadPendingOrders() {
  const { data } = await supabase
    .from('orders')
    .select('id, attendee_id, status, created_at, attendees(username, alias, credits), drinks(name)')
    .eq('status', 'pending')
    .order('created_at')
  const el = document.getElementById('pending-orders')
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="muted">No pending orders.</p>'
    return
  }
  el.innerHTML = ''
  data.forEach(o => {
    const row = document.createElement('div')
    row.className = 'card item-row'
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(o.attendees?.alias || o.attendees?.username)}</strong> ordered <strong>${escapeHtml(o.drinks?.name)}</strong>
        <div class="muted" style="font-size:0.82rem;margin-top:0.25rem">
          ${new Date(o.created_at).toLocaleString()} · ${escapeHtml(String(o.attendees?.credits ?? 0))} credits available
        </div>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-approve"
          data-id="${escapeHtml(o.id)}"
          data-attendee="${escapeHtml(o.attendee_id)}"
          data-credits="${o.attendees?.credits ?? 0}"
          data-action="approve-order">Approve &amp; Make</button>
        <button class="btn btn-sm btn-danger" data-id="${escapeHtml(o.id)}" data-action="reject-order">Reject</button>
      </div>
    `
    el.appendChild(row)
  })
}

document.getElementById('pending-orders').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id

  if (btn.dataset.action === 'approve-order') {
    const attendeeId = btn.dataset.attendee
    // Update order status first
    const { error: orderError } = await supabase.from('orders').update({ status: 'approved' }).eq('id', id)
    if (orderError) { alert('Failed to approve order'); return }
    // Re-fetch current credits before deducting (avoids stale DOM race)
    const { data: attendeeData } = await supabase
      .from('attendees').select('credits').eq('id', attendeeId).single()
    if (attendeeData) {
      await supabase.from('attendees')
        .update({ credits: Math.max(0, attendeeData.credits - 1) })
        .eq('id', attendeeId)
    }
    loadPendingOrders()
    loadAttendeesAdmin()
  }
  if (btn.dataset.action === 'reject-order') {
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', id)
    loadPendingOrders()
  }
})
```

- [ ] **Step 6: Update loadSignupsAdmin() — strip credits UI from rendered rows**

Replace the entire `loadSignupsAdmin` function (lines 413–439):

```js
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
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
        <span class="badge">${escapeHtml(String(a.credits))} credits</span>
        <input type="number" class="signup-credit-input" data-id="${escapeHtml(a.id)}" min="1" placeholder="Add credits" style="width:110px;margin:0">
        <button class="btn btn-sm" data-id="${escapeHtml(a.id)}" data-action="signup-add-credits">Add</button>
      </div>
    `
    el.appendChild(row)
  })
}
```

With:

```js
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
```

- [ ] **Step 7: Remove the entire signups-list listener block (lines 441–456)**

Remove this block in full:

```js
document.getElementById('signups-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const id = btn.dataset.id

  if (btn.dataset.action === 'signup-add-credits') {
    const input = document.querySelector(`.signup-credit-input[data-id="${id}"]`)
    const amount = parseInt(input.value)
    if (isNaN(amount) || amount <= 0) return
    const { data: att } = await supabase.from('attendees').select('credits').eq('id', id).single()
    const current = att ? att.credits : 0
    await supabase.from('attendees').update({ credits: current + amount }).eq('id', id)
    loadSignupsAdmin()
    loadAttendeesAdmin()
  }
})
```

- [ ] **Step 8: Verify no dead references remain**

```bash
grep -n "loadPendingPhotos\|loadAttendeesAdmin\|loadPendingOrders\|pending-photos\|pending-orders\|attendees-list\|signup-add-credits\|signup-credit-input\|new-credits\|add-credits\|delete-attendee\|approve-order\|reject-order\|approve-photo\|delete-photo" /Users/negomiaoz/Desktop/ershu.25/admin/js/admin-main.js
```

Expected: no output

- [ ] **Step 9: Commit**

```bash
git add admin/js/admin-main.js
git commit -m "feat: remove gallery and credits/orders logic from admin panel"
```

---

### Task 9: Final verification

- [ ] **Step 1: Check no files reference deleted gallery.html**

```bash
grep -rn "gallery\.html\|gallery\.js" /Users/negomiaoz/Desktop/ershu.25 --include="*.html" --include="*.js"
```

Expected: no output

- [ ] **Step 2: Check openbar.html has no broken imports**

```bash
grep -n "loadAttendeeOrders\|placeOrder\|refreshAttendeeCredits\|loadDrinks\|getLang\|setPin" /Users/negomiaoz/Desktop/ershu.25/openbar.html
```

Expected: no output

- [ ] **Step 3: Check admin-main.js has no broken function calls**

```bash
grep -n "loadPendingPhotos\|loadAttendeesAdmin\|loadPendingOrders" /Users/negomiaoz/Desktop/ershu.25/admin/js/admin-main.js
```

Expected: no output

- [ ] **Step 4: Cross-project final verification**

```bash
grep -rn "gallery\.html\|gallery\.js\|loadPendingPhotos\|loadAttendeesAdmin\|loadPendingOrders\|placeOrder\|loadAttendeeOrders\|refreshAttendeeCredits\|pending-photos\|pending-orders\|attendees-list\|signup-credit-input\|tab-gallery\|tab-openbar" /Users/negomiaoz/Desktop/ershu.25 --include="*.html" --include="*.js"
```

Expected: no output

- [ ] **Step 5: Final commit**

```bash
git log --oneline -8
```

Expected: 8 recent commits covering the full removal

