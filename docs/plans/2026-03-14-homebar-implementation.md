# Homebar Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a passcode-protected homebar website with a live menu, guest gallery/comments, and a credit-based OpenBar ordering system, hosted as a static site on GitHub Pages with Supabase as the backend.

**Architecture:** Vanilla HTML/CSS/JS static site using the Supabase JS CDN client. No build step — push to GitHub and it's live. Supabase handles the database (PostgreSQL), file storage (photos), and admin authentication (Supabase Auth). Row Level Security (RLS) protects all data.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES modules via CDN), Supabase JS v2 (CDN), Supabase Auth (admin), Web Crypto API (attendee PIN hashing), GitHub Pages, Porkbun DNS.

---

## Pre-Work: Supabase Project Setup (Manual — Host Does This Once)

Before any code is written, the host must:

1. Go to https://supabase.com and create a free account + new project
2. Note down:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **Anon public key** (safe to expose in frontend code)
3. Go to **Authentication > Settings** and disable "Email confirmations" (for admin login ease)
4. Go to **Authentication > Users** and create one admin user (your email + password)
5. Run the SQL schema (provided in Task 1) in the Supabase SQL Editor
6. Go to **Storage** and create a public bucket called `gallery`

---

## Task 1: Database Schema

**Files:**
- Create: `docs/schema.sql` (reference only, run in Supabase SQL Editor)

**Step 1: Write and run the schema in Supabase SQL Editor**

```sql
-- Site settings (passcode etc.)
create table settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values ('site_passcode', 'changeme');

-- Menu drinks
create table drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Comments (drink_id null = general homebar comment)
create table comments (
  id uuid primary key default gen_random_uuid(),
  drink_id uuid references drinks(id) on delete cascade,
  author_name text,
  body text not null,
  approved boolean default false,
  created_at timestamptz default now()
);

-- Gallery photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  approved boolean default false,
  created_at timestamptz default now()
);

-- OpenBar attendees
create table attendees (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  alias text,
  pin_hash text not null,
  credits integer default 0,
  created_at timestamptz default now()
);

-- Drink orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid references attendees(id),
  drink_id uuid references drinks(id),
  status text default 'pending',
  created_at timestamptz default now()
);

-- Wishlist
create table wishlist (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  credit_value integer not null,
  active boolean default true,
  created_at timestamptz default now()
);
```

**Step 2: Enable Row Level Security on all tables**

```sql
alter table settings enable row level security;
alter table drinks enable row level security;
alter table comments enable row level security;
alter table photos enable row level security;
alter table attendees enable row level security;
alter table orders enable row level security;
alter table wishlist enable row level security;

-- Public can read settings
create policy "public read settings" on settings for select using (true);

-- Public can read active drinks
create policy "public read drinks" on drinks for select using (active = true);

-- Public can read approved comments
create policy "public read comments" on comments for select using (approved = true);

-- Public can insert unapproved comments
create policy "public insert comments" on comments for insert with check (approved = false);

-- Public can read approved photos
create policy "public read photos" on photos for select using (approved = true);

-- Public can insert unapproved photos
create policy "public insert photos" on photos for insert with check (approved = false);

-- Public can read attendees (needed for PIN login)
create policy "public read attendees" on attendees for select using (true);

-- Public can insert orders
create policy "public insert orders" on orders for insert with check (true);

-- Public can read own orders (attendee_id check done in app)
create policy "public read orders" on orders for select using (true);

-- Public can read active wishlist
create policy "public read wishlist" on wishlist for select using (active = true);

-- Admin (authenticated Supabase user) has full access to everything
create policy "admin full access settings" on settings for all using (auth.role() = 'authenticated');
create policy "admin full access drinks" on drinks for all using (auth.role() = 'authenticated');
create policy "admin full access comments" on comments for all using (auth.role() = 'authenticated');
create policy "admin full access photos" on photos for all using (auth.role() = 'authenticated');
create policy "admin full access attendees" on attendees for all using (auth.role() = 'authenticated');
create policy "admin full access orders" on orders for all using (auth.role() = 'authenticated');
create policy "admin full access wishlist" on wishlist for all using (auth.role() = 'authenticated');
```

**Step 3: Save schema to file**

Save the SQL above to `docs/schema.sql` for reference.

**Step 4: Commit**

```bash
git add docs/schema.sql
git commit -m "feat: add database schema"
```

---

## Task 2: Project File Structure & Supabase Client

**Files:**
- Create: `js/supabase-client.js`
- Create: `js/auth.js`
- Create: `css/style.css`
- Create: `index.html`

**Step 1: Create the Supabase client module**

Create `js/supabase-client.js`:

```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

Replace `YOUR_PROJECT_ID` and `YOUR_ANON_KEY` with the values from the Supabase project settings.

**Step 2: Create the auth module (passcode + attendee session)**

Create `js/auth.js`:

```js
import { supabase } from './supabase-client.js'

const PASSCODE_KEY = 'hb_passcode_ok'
const ATTENDEE_KEY = 'hb_attendee'

export function isPasscodeVerified() {
  return sessionStorage.getItem(PASSCODE_KEY) === 'true'
}

export function setPasscodeVerified() {
  sessionStorage.setItem(PASSCODE_KEY, 'true')
}

export async function verifyPasscode(input) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'site_passcode')
    .single()
  if (error) return false
  return data.value === input
}

export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function loginAttendee(username, pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('attendees')
    .select('id, username, alias, credits')
    .eq('username', username.toLowerCase())
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  sessionStorage.setItem(ATTENDEE_KEY, JSON.stringify(data))
  return data
}

export function getAttendeeSession() {
  const raw = sessionStorage.getItem(ATTENDEE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function logoutAttendee() {
  sessionStorage.removeItem(ATTENDEE_KEY)
}

export function requirePasscode() {
  if (!isPasscodeVerified()) {
    window.location.href = '/index.html'
  }
}
```

**Step 3: Create base CSS**

Create `css/style.css`:

```css
:root {
  --bg: #0d0d0d;
  --surface: #1a1a1a;
  --border: #2e2e2e;
  --accent: #c8a96e;
  --text: #e8e8e8;
  --muted: #888;
  --radius: 8px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Georgia', serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

nav {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  align-items: center;
}

nav .brand {
  font-size: 1.2rem;
  color: var(--accent);
  font-weight: bold;
  margin-right: auto;
}

main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

h1 { font-size: 2rem; color: var(--accent); margin-bottom: 1rem; }
h2 { font-size: 1.4rem; color: var(--accent); margin-bottom: 0.75rem; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.btn {
  display: inline-block;
  background: var(--accent);
  color: #0d0d0d;
  border: none;
  border-radius: var(--radius);
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  font-size: 0.95rem;
  font-family: inherit;
  font-weight: bold;
}

.btn:hover { opacity: 0.85; }
.btn-outline {
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
}

input, textarea {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.9rem;
  color: var(--text);
  font-family: inherit;
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.muted { color: var(--muted); font-size: 0.85rem; }

.badge {
  display: inline-block;
  background: var(--accent);
  color: #0d0d0d;
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  font-size: 0.8rem;
  font-weight: bold;
}

.error { color: #e06c75; font-size: 0.9rem; margin-top: 0.5rem; }
.success { color: #98c379; font-size: 0.9rem; margin-top: 0.5rem; }
```

**Step 4: Create the passcode gate (index.html)**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .gate {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 2rem;
    }
    .gate h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .gate p { color: var(--muted); margin-bottom: 2rem; }
    .gate form { width: 100%; max-width: 300px; }
    .gate input { text-align: center; letter-spacing: 0.2em; }
  </style>
</head>
<body>
  <div class="gate">
    <h1>The Homebar</h1>
    <p>Enter the passcode to continue</p>
    <form id="passcode-form">
      <input type="password" id="passcode" placeholder="••••••" autocomplete="off" required>
      <button class="btn" type="submit" style="width:100%">Enter</button>
      <p id="error" class="error" style="display:none">Incorrect passcode</p>
    </form>
  </div>
  <script type="module">
    import { isPasscodeVerified, verifyPasscode, setPasscodeVerified } from './js/auth.js'

    if (isPasscodeVerified()) window.location.href = '/home.html'

    document.getElementById('passcode-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const input = document.getElementById('passcode').value
      const ok = await verifyPasscode(input)
      if (ok) {
        setPasscodeVerified()
        window.location.href = '/home.html'
      } else {
        document.getElementById('error').style.display = 'block'
      }
    })
  </script>
</body>
</html>
```

**Step 5: Verify in browser**

Open `index.html` in a browser (via a local server — run `npx serve .` or use VS Code Live Server). Enter the passcode `changeme`. You should be redirected to `home.html` (which doesn't exist yet — a 404 is expected at this point). Confirm the error message shows for a wrong passcode.

**Step 6: Commit**

```bash
git add js/supabase-client.js js/auth.js css/style.css index.html
git commit -m "feat: project setup, supabase client, passcode gate"
```

---

## Task 3: Navigation & Home Page

**Files:**
- Create: `js/nav.js`
- Create: `home.html`

**Step 1: Create shared navigation component**

Create `js/nav.js`:

```js
export function renderNav(activePage = '') {
  const pages = [
    { href: '/home.html', label: 'Home' },
    { href: '/menu.html', label: 'Menu' },
    { href: '/gallery.html', label: 'Gallery' },
    { href: '/community.html', label: 'Community' },
    { href: '/openbar.html', label: 'OpenBar' },
  ]

  const links = pages.map(p =>
    `<a href="${p.href}" ${activePage === p.label ? 'style="color:var(--text)"' : ''}>${p.label}</a>`
  ).join('')

  return `<nav><span class="brand">The Homebar</span>${links}</nav>`
}
```

**Step 2: Create home.html**

Create `home.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="nav"></div>
  <main>
    <h1>Welcome to The Homebar</h1>
    <div class="card">
      <p style="line-height:1.8; font-size:1.05rem;">
        The Homebar has been a passion project nearly a year in the making — a place where good drinks,
        good company, and good conversation come together. Every occasion brings a fresh menu, handcrafted
        with care. Whether you're a first-time guest or a regular, you're always welcome here.
      </p>
    </div>
    <div style="display:flex; gap:1rem; margin-top:1.5rem; flex-wrap:wrap;">
      <a href="/menu.html" class="btn">View the Menu</a>
      <a href="/openbar.html" class="btn btn-outline">OpenBar</a>
    </div>
  </main>
  <script type="module">
    import { requirePasscode } from './js/auth.js'
    import { renderNav } from './js/nav.js'
    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('Home')
  </script>
</body>
</html>
```

**Step 3: Verify**

Navigate to `home.html` after passing the passcode. You should see the about text and nav links.

**Step 4: Commit**

```bash
git add js/nav.js home.html
git commit -m "feat: home page and shared nav"
```

---

## Task 4: Menu Page

**Files:**
- Create: `menu.html`
- Create: `js/menu.js`

**Step 1: Create the menu JS module**

Create `js/menu.js`:

```js
import { supabase } from './supabase-client.js'

export async function loadDrinks() {
  const { data, error } = await supabase
    .from('drinks')
    .select('*')
    .eq('active', true)
    .order('created_at')
  return error ? [] : data
}

export async function loadCommentsForDrink(drinkId) {
  const { data, error } = await supabase
    .from('comments')
    .select('author_name, body, created_at')
    .eq('drink_id', drinkId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function submitComment(drinkId, authorName, body) {
  const { error } = await supabase
    .from('comments')
    .insert({ drink_id: drinkId, author_name: authorName, body, approved: false })
  return !error
}
```

**Step 2: Create menu.html**

Create `menu.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Menu — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .drinks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }
    .drink-card {
      position: relative;
      cursor: pointer;
    }
    .drink-card img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      border-radius: var(--radius);
      margin-bottom: 0.75rem;
    }
    .drink-card h3 { color: var(--accent); margin-bottom: 0.4rem; }
    .drink-card p { color: var(--muted); font-size: 0.9rem; line-height: 1.5; }

    /* Hover comments tooltip */
    .comments-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0; right: 0;
      background: #222;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.75rem;
      z-index: 10;
      font-size: 0.85rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .drink-card:hover .comments-tooltip { display: block; }
    .comment-item { border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
    .comment-item:last-child { border: none; margin: 0; padding: 0; }
    .comment-author { color: var(--accent); font-size: 0.8rem; margin-bottom: 0.2rem; }

    .submit-comment-form { margin-top: 2rem; }
    .drink-select { margin-bottom: 0.75rem; }
    select {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.6rem 0.9rem;
      color: var(--text);
      font-family: inherit;
      font-size: 0.95rem;
      margin-bottom: 0.75rem;
    }
  </style>
</head>
<body>
  <div id="nav"></div>
  <main>
    <h1>Tonight's Menu</h1>
    <div id="drinks-grid" class="drinks-grid"></div>

    <div class="submit-comment-form card" style="margin-top:2rem">
      <h2>Leave a comment on a drink</h2>
      <input type="text" id="comment-author" placeholder="Your name (optional)">
      <select id="comment-drink"></select>
      <textarea id="comment-body" rows="3" placeholder="What did you think?"></textarea>
      <button class="btn" id="submit-comment">Submit (pending approval)</button>
      <p id="comment-status"></p>
    </div>
  </main>
  <script type="module">
    import { requirePasscode } from './js/auth.js'
    import { renderNav } from './js/nav.js'
    import { loadDrinks, loadCommentsForDrink, submitComment } from './js/menu.js'

    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('Menu')

    const drinks = await loadDrinks()
    const grid = document.getElementById('drinks-grid')
    const select = document.getElementById('comment-drink')

    if (drinks.length === 0) {
      grid.innerHTML = '<p class="muted">No menu yet — check back soon.</p>'
    }

    for (const drink of drinks) {
      const comments = await loadCommentsForDrink(drink.id)

      const commentsHtml = comments.length
        ? comments.map(c => `
            <div class="comment-item">
              <div class="comment-author">${c.author_name || 'Anonymous'}</div>
              <div>${c.body}</div>
            </div>`).join('')
        : '<p class="muted" style="margin:0">No comments yet</p>'

      const card = document.createElement('div')
      card.className = 'card drink-card'
      card.innerHTML = `
        ${drink.photo_url ? `<img src="${drink.photo_url}" alt="${drink.name}">` : ''}
        <h3>${drink.name}</h3>
        <p>${drink.description || ''}</p>
        <div class="comments-tooltip">${commentsHtml}</div>
      `
      grid.appendChild(card)

      const option = document.createElement('option')
      option.value = drink.id
      option.textContent = drink.name
      select.appendChild(option)
    }

    document.getElementById('submit-comment').addEventListener('click', async () => {
      const author = document.getElementById('comment-author').value
      const drinkId = document.getElementById('comment-drink').value
      const body = document.getElementById('comment-body').value.trim()
      const status = document.getElementById('comment-status')
      if (!body) { status.textContent = 'Please write a comment.'; status.className = 'error'; return }
      const ok = await submitComment(drinkId, author, body)
      if (ok) {
        status.textContent = 'Submitted! Your comment is pending approval.'
        status.className = 'success'
        document.getElementById('comment-body').value = ''
      } else {
        status.textContent = 'Something went wrong. Try again.'
        status.className = 'error'
      }
    })
  </script>
</body>
</html>
```

**Step 3: Verify**

Add a test drink directly in Supabase Table Editor: name = "Test Cocktail", description = "A test drink", active = true. Reload `menu.html` — the drink should appear. Hover over it — "No comments yet" tooltip should show.

**Step 4: Commit**

```bash
git add menu.html js/menu.js
git commit -m "feat: menu page with hover comments"
```

---

## Task 5: Gallery Page

**Files:**
- Create: `gallery.html`
- Create: `js/gallery.js`

**Step 1: Create gallery.js**

Create `js/gallery.js`:

```js
import { supabase } from './supabase-client.js'

export async function loadApprovedPhotos() {
  const { data, error } = await supabase
    .from('photos')
    .select('url, caption, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function uploadPhoto(file, caption) {
  const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
  const { data, error: uploadError } = await supabase.storage
    .from('gallery')
    .upload(filename, file, { cacheControl: '3600', upsert: false })
  if (uploadError) return false

  const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filename)

  const { error: dbError } = await supabase
    .from('photos')
    .insert({ url: urlData.publicUrl, caption, approved: false })
  return !dbError
}
```

**Step 2: Create gallery.html**

Create `gallery.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gallery — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem;
    }
    .photo-item img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      border-radius: var(--radius);
      display: block;
    }
    .photo-item .caption {
      margin-top: 0.4rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .upload-section { margin-top: 2rem; }
  </style>
</head>
<body>
  <div id="nav"></div>
  <main>
    <h1>Gallery</h1>
    <div id="photo-grid" class="photo-grid"></div>

    <div class="upload-section card">
      <h2>Share your experience</h2>
      <input type="file" id="photo-file" accept="image/*">
      <input type="text" id="photo-caption" placeholder="Caption (optional)">
      <button class="btn" id="upload-btn">Upload (pending approval)</button>
      <p id="upload-status"></p>
    </div>
  </main>
  <script type="module">
    import { requirePasscode } from './js/auth.js'
    import { renderNav } from './js/nav.js'
    import { loadApprovedPhotos, uploadPhoto } from './js/gallery.js'

    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('Gallery')

    const photos = await loadApprovedPhotos()
    const grid = document.getElementById('photo-grid')

    if (photos.length === 0) {
      grid.innerHTML = '<p class="muted">No photos yet — be the first to share!</p>'
    } else {
      photos.forEach(p => {
        const div = document.createElement('div')
        div.className = 'photo-item'
        div.innerHTML = `<img src="${p.url}" alt="${p.caption || 'Gallery photo'}">
          ${p.caption ? `<p class="caption">${p.caption}</p>` : ''}`
        grid.appendChild(div)
      })
    }

    document.getElementById('upload-btn').addEventListener('click', async () => {
      const file = document.getElementById('photo-file').files[0]
      const caption = document.getElementById('photo-caption').value
      const status = document.getElementById('upload-status')
      if (!file) { status.textContent = 'Please select a photo.'; status.className = 'error'; return }
      status.textContent = 'Uploading...'
      status.className = 'muted'
      const ok = await uploadPhoto(file, caption)
      if (ok) {
        status.textContent = 'Uploaded! Your photo is pending approval.'
        status.className = 'success'
        document.getElementById('photo-file').value = ''
        document.getElementById('photo-caption').value = ''
      } else {
        status.textContent = 'Upload failed. Try again.'
        status.className = 'error'
      }
    })
  </script>
</body>
</html>
```

**Step 3: Verify**

Go to `gallery.html`. Upload a test image — it should say "pending approval." In Supabase Table Editor, check the `photos` table — a row should appear with `approved = false`.

**Step 4: Commit**

```bash
git add gallery.html js/gallery.js
git commit -m "feat: gallery page with photo upload"
```

---

## Task 6: Community Comments Page

**Files:**
- Create: `community.html`
- Create: `js/community.js`

**Step 1: Create community.js**

Create `js/community.js`:

```js
import { supabase } from './supabase-client.js'

export async function loadGeneralComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('author_name, body, created_at')
    .is('drink_id', null)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function submitGeneralComment(authorName, body) {
  const { error } = await supabase
    .from('comments')
    .insert({ drink_id: null, author_name: authorName, body, approved: false })
  return !error
}
```

**Step 2: Create community.html**

Create `community.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="nav"></div>
  <main>
    <h1>Community</h1>
    <p class="muted" style="margin-bottom:1.5rem">What guests have said about The Homebar</p>
    <div id="comments-list"></div>

    <div class="card" style="margin-top:2rem">
      <h2>Leave a review</h2>
      <input type="text" id="author" placeholder="Your name (optional)">
      <textarea id="body" rows="4" placeholder="Share your experience..."></textarea>
      <button class="btn" id="submit-btn">Submit (pending approval)</button>
      <p id="status"></p>
    </div>
  </main>
  <script type="module">
    import { requirePasscode } from './js/auth.js'
    import { renderNav } from './js/nav.js'
    import { loadGeneralComments, submitGeneralComment } from './js/community.js'

    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('Community')

    const comments = await loadGeneralComments()
    const list = document.getElementById('comments-list')

    if (comments.length === 0) {
      list.innerHTML = '<p class="muted">No reviews yet.</p>'
    } else {
      comments.forEach(c => {
        const div = document.createElement('div')
        div.className = 'card'
        div.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
            <strong>${c.author_name || 'Anonymous'}</strong>
            <span class="muted">${new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <p style="line-height:1.7">${c.body}</p>
        `
        list.appendChild(div)
      })
    }

    document.getElementById('submit-btn').addEventListener('click', async () => {
      const author = document.getElementById('author').value
      const body = document.getElementById('body').value.trim()
      const status = document.getElementById('status')
      if (!body) { status.textContent = 'Please write something.'; status.className = 'error'; return }
      const ok = await submitGeneralComment(author, body)
      if (ok) {
        status.textContent = 'Submitted! Your review is pending approval.'
        status.className = 'success'
        document.getElementById('body').value = ''
      } else {
        status.textContent = 'Something went wrong. Try again.'
        status.className = 'error'
      }
    })
  </script>
</body>
</html>
```

**Step 3: Commit**

```bash
git add community.html js/community.js
git commit -m "feat: community comments page"
```

---

## Task 7: OpenBar Page — Attendee Login & Dashboard

**Files:**
- Create: `openbar.html`
- Create: `js/openbar.js`

**Step 1: Create openbar.js**

Create `js/openbar.js`:

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

export async function loadAttendeeOrders(attendeeId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, created_at, drinks(name)')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function placeOrder(attendeeId, drinkId) {
  // Check attendee has credits
  const { data: attendee } = await supabase
    .from('attendees')
    .select('credits')
    .eq('id', attendeeId)
    .single()
  if (!attendee || attendee.credits <= 0) return { ok: false, reason: 'Insufficient credits' }

  // Check no pending order already
  const { data: pending } = await supabase
    .from('orders')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('status', 'pending')
  if (pending && pending.length > 0) return { ok: false, reason: 'You already have a pending order' }

  const { error } = await supabase
    .from('orders')
    .insert({ attendee_id: attendeeId, drink_id: drinkId, status: 'pending' })
  return error ? { ok: false, reason: 'Order failed' } : { ok: true }
}

export async function refreshAttendeeCredits(attendeeId) {
  const { data, error } = await supabase
    .from('attendees')
    .select('credits')
    .eq('id', attendeeId)
    .single()
  return error ? null : data.credits
}
```

**Step 2: Create openbar.html**

Create `openbar.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenBar — The Homebar</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .wishlist-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--border);
    }
    .wishlist-item:last-child { border: none; }
    .order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    .order-item:last-child { border: none; }
    .status-pending { color: #e5c07b; }
    .status-approved { color: #98c379; }
    .status-rejected { color: #e06c75; }
    #login-section, #dashboard-section { max-width: 420px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="nav"></div>
  <main>
    <div id="login-section">
      <h1>OpenBar</h1>
      <p class="muted" style="margin-bottom:1.5rem">Log in to order drinks and check your credits</p>
      <div class="card">
        <input type="text" id="username" placeholder="Username">
        <input type="password" id="pin" placeholder="PIN">
        <button class="btn" id="login-btn" style="width:100%">Log In</button>
        <p id="login-error" class="error" style="display:none">Username or PIN incorrect</p>
      </div>
    </div>

    <div id="dashboard-section" style="display:none; max-width:700px; margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <div>
          <h1 id="greeting"></h1>
          <div><span class="badge" id="credits-display">0 credits</span></div>
        </div>
        <button class="btn btn-outline" id="logout-btn">Log out</button>
      </div>

      <div class="card">
        <h2>Wishlist — What to Bring</h2>
        <p class="muted" style="margin-bottom:1rem">Bring these items to earn credits</p>
        <div id="wishlist-list"></div>
      </div>

      <div class="card">
        <h2>Order a Drink</h2>
        <select id="order-drink"></select>
        <button class="btn" id="order-btn">Place Order</button>
        <p id="order-status"></p>
      </div>

      <div class="card">
        <h2>Order History</h2>
        <div id="order-history"></div>
      </div>
    </div>
  </main>
  <script type="module">
    import { requirePasscode, loginAttendee, getAttendeeSession, logoutAttendee } from './js/auth.js'
    import { renderNav } from './js/nav.js'
    import { loadWishlist, loadAttendeeOrders, placeOrder, refreshAttendeeCredits } from './js/openbar.js'
    import { loadDrinks } from './js/menu.js'

    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('OpenBar')

    const session = getAttendeeSession()
    if (session) showDashboard(session)

    document.getElementById('login-btn').addEventListener('click', async () => {
      const username = document.getElementById('username').value.trim()
      const pin = document.getElementById('pin').value
      const attendee = await loginAttendee(username, pin)
      if (attendee) {
        showDashboard(attendee)
      } else {
        document.getElementById('login-error').style.display = 'block'
      }
    })

    document.getElementById('logout-btn').addEventListener('click', () => {
      logoutAttendee()
      document.getElementById('dashboard-section').style.display = 'none'
      document.getElementById('login-section').style.display = 'block'
    })

    async function showDashboard(attendee) {
      document.getElementById('login-section').style.display = 'none'
      document.getElementById('dashboard-section').style.display = 'block'
      document.getElementById('greeting').textContent = `Hey, ${attendee.alias || attendee.username}`
      document.getElementById('credits-display').textContent = `${attendee.credits} credits`

      // Load wishlist
      const wishlist = await loadWishlist()
      const wishlistEl = document.getElementById('wishlist-list')
      wishlistEl.innerHTML = wishlist.length
        ? wishlist.map(w => `
            <div class="wishlist-item">
              <span>${w.item_name}</span>
              <span class="badge">${w.credit_value} credits</span>
            </div>`).join('')
        : '<p class="muted">No wishlist items right now.</p>'

      // Load drinks for order select
      const drinks = await loadDrinks()
      const orderSelect = document.getElementById('order-drink')
      orderSelect.innerHTML = drinks.map(d => `<option value="${d.id}">${d.name}</option>`).join('')

      // Load order history
      const orders = await loadAttendeeOrders(attendee.id)
      const historyEl = document.getElementById('order-history')
      historyEl.innerHTML = orders.length
        ? orders.map(o => `
            <div class="order-item">
              <span>${o.drinks?.name || 'Unknown drink'}</span>
              <span class="status-${o.status}">${o.status}</span>
              <span class="muted">${new Date(o.created_at).toLocaleDateString()}</span>
            </div>`).join('')
        : '<p class="muted">No orders yet.</p>'

      // Place order
      document.getElementById('order-btn').addEventListener('click', async () => {
        const drinkId = orderSelect.value
        const status = document.getElementById('order-status')
        const result = await placeOrder(attendee.id, drinkId)
        if (result.ok) {
          status.textContent = 'Order placed! Waiting for approval.'
          status.className = 'success'
          // Refresh credits
          const newCredits = await refreshAttendeeCredits(attendee.id)
          if (newCredits !== null) document.getElementById('credits-display').textContent = `${newCredits} credits`
        } else {
          status.textContent = result.reason
          status.className = 'error'
        }
      })
    }
  </script>
</body>
</html>
```

**Step 3: Verify**

In Supabase, manually add a test attendee row: username = "testuser", pin_hash = SHA-256 hash of "1234" (= `03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4`), credits = 5. Log in at `openbar.html` with username "testuser" and PIN "1234". You should see the dashboard with 5 credits.

**Step 4: Commit**

```bash
git add openbar.html js/openbar.js
git commit -m "feat: openbar page with attendee login and dashboard"
```

---

## Task 8: Admin Panel — Auth & Layout

**Files:**
- Create: `admin/index.html`
- Create: `admin/js/admin-auth.js`
- Create: `admin/css/admin.css`

**Step 1: Create admin-auth.js**

Create `admin/js/admin-auth.js`:

```js
import { supabase } from '../../js/supabase-client.js'

export async function adminLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export async function adminLogout() {
  await supabase.auth.signOut()
  window.location.href = '/admin/index.html'
}

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) window.location.href = '/admin/index.html'
  return session
}

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
```

**Step 2: Create admin/index.html (login + tabbed dashboard)**

Create `admin/index.html`. This single file handles login and all admin tabs:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — The Homebar</title>
  <link rel="stylesheet" href="../css/style.css">
  <style>
    .admin-login { max-width: 360px; margin: 4rem auto; }
    .tab-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
    .tab-btn { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: var(--radius); padding: 0.4rem 0.9rem; cursor: pointer; font-family: inherit; }
    .tab-btn.active { border-color: var(--accent); color: var(--accent); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid var(--border); gap: 0.5rem; }
    .item-row:last-child { border: none; }
    .btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
    .btn-danger { background: #e06c75; }
    .approve-btn { background: #98c379; color: #0d0d0d; }
    .pending-badge { background: #e5c07b; color: #0d0d0d; }
    label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.3rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  </style>
</head>
<body>
  <div id="login-view">
    <div class="admin-login">
      <h1 style="text-align:center;margin-bottom:1.5rem">Admin Login</h1>
      <input type="email" id="admin-email" placeholder="Email">
      <input type="password" id="admin-password" placeholder="Password">
      <button class="btn" style="width:100%" id="admin-login-btn">Log In</button>
      <p id="login-err" class="error" style="display:none">Invalid credentials</p>
    </div>
  </div>

  <div id="admin-view" style="display:none">
    <div style="max-width:960px;margin:0 auto;padding:1.5rem">
      <div class="admin-header">
        <h1 style="margin:0">Admin Panel</h1>
        <button class="btn btn-outline" id="admin-logout-btn">Log out</button>
      </div>

      <div class="tab-bar">
        <button class="tab-btn active" data-tab="menu">Menu</button>
        <button class="tab-btn" data-tab="comments">Comments</button>
        <button class="tab-btn" data-tab="gallery">Gallery</button>
        <button class="tab-btn" data-tab="openbar">OpenBar</button>
        <button class="tab-btn" data-tab="wishlist">Wishlist</button>
        <button class="tab-btn" data-tab="settings">Settings</button>
      </div>

      <!-- MENU TAB -->
      <div class="tab-panel active" id="tab-menu">
        <h2>Menu Management</h2>
        <div class="card">
          <h3 style="margin-bottom:1rem">Add / Edit Drink</h3>
          <input type="hidden" id="drink-edit-id">
          <div class="form-row">
            <div><label>Drink Name</label><input type="text" id="drink-name" placeholder="e.g. Negroni"></div>
            <div><label>Description</label><input type="text" id="drink-desc" placeholder="Short description"></div>
          </div>
          <label>Photo URL (optional)</label>
          <input type="text" id="drink-photo" placeholder="https://...">
          <div style="display:flex;gap:0.5rem">
            <button class="btn" id="save-drink-btn">Save Drink</button>
            <button class="btn btn-outline" id="clear-drink-btn">Clear</button>
          </div>
          <p id="drink-status"></p>
        </div>
        <div id="drinks-list" style="margin-top:1rem"></div>
      </div>

      <!-- COMMENTS TAB -->
      <div class="tab-panel" id="tab-comments">
        <h2>Pending Comments</h2>
        <div id="pending-comments"></div>
      </div>

      <!-- GALLERY TAB -->
      <div class="tab-panel" id="tab-gallery">
        <h2>Pending Photos</h2>
        <div id="pending-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem"></div>
      </div>

      <!-- OPENBAR TAB -->
      <div class="tab-panel" id="tab-openbar">
        <h2>Attendees & Orders</h2>
        <div class="card">
          <h3 style="margin-bottom:1rem">Add Attendee</h3>
          <div class="form-row">
            <div><label>Username (they choose this)</label><input type="text" id="new-username" placeholder="username"></div>
            <div><label>Alias (your nickname for them)</label><input type="text" id="new-alias" placeholder="e.g. Big Mike"></div>
          </div>
          <label>Starting Credits</label>
          <input type="number" id="new-credits" value="0" min="0" style="max-width:100px">
          <button class="btn" id="add-attendee-btn">Add Attendee</button>
          <p id="attendee-status"></p>
          <p class="muted" style="margin-top:0.5rem;font-size:0.82rem">Note: Attendee will set their own PIN on first login. Share their username with them — they can log in and set a PIN anytime.</p>
        </div>
        <div id="attendees-list" style="margin-top:1rem"></div>
        <h2 style="margin-top:2rem">Pending Orders</h2>
        <div id="pending-orders"></div>
      </div>

      <!-- WISHLIST TAB -->
      <div class="tab-panel" id="tab-wishlist">
        <h2>Wishlist</h2>
        <div class="card">
          <div class="form-row">
            <div><label>Item Name</label><input type="text" id="wishlist-name" placeholder="e.g. Campari"></div>
            <div><label>Credit Value</label><input type="number" id="wishlist-credits" placeholder="10" min="1"></div>
          </div>
          <button class="btn" id="add-wishlist-btn">Add Item</button>
          <p id="wishlist-status"></p>
        </div>
        <div id="wishlist-list" style="margin-top:1rem"></div>
      </div>

      <!-- SETTINGS TAB -->
      <div class="tab-panel" id="tab-settings">
        <h2>Settings</h2>
        <div class="card">
          <label>Site Passcode</label>
          <input type="text" id="new-passcode" placeholder="New passcode">
          <button class="btn" id="save-passcode-btn">Update Passcode</button>
          <p id="passcode-status"></p>
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="js/admin-main.js"></script>
</body>
</html>
```

**Step 3: Create admin/js/admin-main.js (all admin logic)**

Create `admin/js/admin-main.js`:

```js
import { supabase } from '../../js/supabase-client.js'
import { adminLogin, adminLogout, getAdminSession } from './admin-auth.js'

// --- Auth ---
const session = await getAdminSession()
if (session) showAdmin()

document.getElementById('admin-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value
  const password = document.getElementById('admin-password').value
  const ok = await adminLogin(email, password)
  if (ok) showAdmin()
  else document.getElementById('login-err').style.display = 'block'
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

async function showAdmin() {
  document.getElementById('login-view').style.display = 'none'
  document.getElementById('admin-view').style.display = 'block'
  loadMenuAdmin()
  loadPendingComments()
  loadPendingPhotos()
  loadAttendeesAdmin()
  loadPendingOrders()
  loadWishlistAdmin()
}

// --- MENU ---
async function loadMenuAdmin() {
  const { data } = await supabase.from('drinks').select('*').order('created_at')
  const list = document.getElementById('drinks-list')
  list.innerHTML = (data || []).map(d => `
    <div class="card item-row">
      <div><strong>${d.name}</strong> <span class="muted">— ${d.description || ''}</span></div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm" onclick="editDrink('${d.id}','${d.name}','${d.description || ''}','${d.photo_url || ''}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteDrink('${d.id}')">Delete</button>
      </div>
    </div>`).join('') || '<p class="muted">No drinks yet.</p>'
}

window.editDrink = (id, name, desc, photo) => {
  document.getElementById('drink-edit-id').value = id
  document.getElementById('drink-name').value = name
  document.getElementById('drink-desc').value = desc
  document.getElementById('drink-photo').value = photo
}

window.deleteDrink = async (id) => {
  if (!confirm('Delete this drink?')) return
  await supabase.from('drinks').delete().eq('id', id)
  loadMenuAdmin()
}

document.getElementById('save-drink-btn').addEventListener('click', async () => {
  const id = document.getElementById('drink-edit-id').value
  const name = document.getElementById('drink-name').value.trim()
  const description = document.getElementById('drink-desc').value.trim()
  const photo_url = document.getElementById('drink-photo').value.trim() || null
  const status = document.getElementById('drink-status')
  if (!name) { status.textContent = 'Name required'; status.className = 'error'; return }

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
    .from('comments').select('id, author_name, body, drink_id, drinks(name)')
    .eq('approved', false).order('created_at')
  const el = document.getElementById('pending-comments')
  el.innerHTML = (data || []).map(c => `
    <div class="card item-row">
      <div>
        <div class="muted" style="font-size:0.8rem">${c.drink_id ? `On: ${c.drinks?.name}` : 'General comment'}</div>
        <strong>${c.author_name || 'Anonymous'}</strong>: ${c.body}
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm approve-btn" onclick="approveComment('${c.id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="deleteComment('${c.id}')">Delete</button>
      </div>
    </div>`).join('') || '<p class="muted">No pending comments.</p>'
}

window.approveComment = async (id) => {
  await supabase.from('comments').update({ approved: true }).eq('id', id)
  loadPendingComments()
}
window.deleteComment = async (id) => {
  await supabase.from('comments').delete().eq('id', id)
  loadPendingComments()
}

// --- GALLERY ---
async function loadPendingPhotos() {
  const { data } = await supabase.from('photos').select('*').eq('approved', false).order('created_at')
  const el = document.getElementById('pending-photos')
  el.innerHTML = (data || []).map(p => `
    <div class="card" style="padding:0.75rem">
      <img src="${p.url}" alt="pending" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:0.5rem">
      ${p.caption ? `<p class="muted" style="font-size:0.82rem;margin-bottom:0.5rem">${p.caption}</p>` : ''}
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm approve-btn" onclick="approvePhoto('${p.id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="deletePhoto('${p.id}')">Delete</button>
      </div>
    </div>`).join('') || '<p class="muted">No pending photos.</p>'
}

window.approvePhoto = async (id) => {
  await supabase.from('photos').update({ approved: true }).eq('id', id)
  loadPendingPhotos()
}
window.deletePhoto = async (id) => {
  await supabase.from('photos').delete().eq('id', id)
  loadPendingPhotos()
}

// --- OPENBAR: ATTENDEES ---
async function loadAttendeesAdmin() {
  const { data } = await supabase.from('attendees').select('*').order('created_at')
  const el = document.getElementById('attendees-list')
  el.innerHTML = `<h3 style="margin-bottom:0.75rem">All Attendees</h3>` +
    (data || []).map(a => `
    <div class="card item-row">
      <div><strong>${a.alias || a.username}</strong> <span class="muted">(${a.username})</span></div>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <span class="badge">${a.credits} credits</span>
        <input type="number" id="add-credit-${a.id}" min="0" placeholder="Add credits" style="width:110px;margin:0">
        <button class="btn btn-sm" onclick="addCredits('${a.id}', ${a.credits})">Add</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAttendee('${a.id}')">Remove</button>
      </div>
    </div>`).join('') || '<p class="muted">No attendees yet.</p>'
}

window.addCredits = async (id, currentCredits) => {
  const input = document.getElementById(`add-credit-${id}`)
  const amount = parseInt(input.value)
  if (isNaN(amount) || amount <= 0) return
  await supabase.from('attendees').update({ credits: currentCredits + amount }).eq('id', id)
  loadAttendeesAdmin()
}

window.deleteAttendee = async (id) => {
  if (!confirm('Remove this attendee?')) return
  await supabase.from('attendees').delete().eq('id', id)
  loadAttendeesAdmin()
}

document.getElementById('add-attendee-btn').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value.trim().toLowerCase()
  const alias = document.getElementById('new-alias').value.trim()
  const credits = parseInt(document.getElementById('new-credits').value) || 0
  const status = document.getElementById('attendee-status')
  if (!username) { status.textContent = 'Username required'; status.className = 'error'; return }
  // Add with blank pin — attendee will set it via a PIN setup flow
  const { error } = await supabase.from('attendees').insert({ username, alias, pin_hash: '', credits })
  if (error) { status.textContent = 'Username may already exist'; status.className = 'error'; return }
  status.textContent = 'Attendee added! Share their username so they can set their PIN.'
  status.className = 'success'
  document.getElementById('new-username').value = ''
  document.getElementById('new-alias').value = ''
  document.getElementById('new-credits').value = '0'
  loadAttendeesAdmin()
})

// --- OPENBAR: ORDERS ---
async function loadPendingOrders() {
  const { data } = await supabase
    .from('orders')
    .select('id, attendee_id, status, created_at, attendees(username, alias, credits), drinks(name)')
    .eq('status', 'pending')
    .order('created_at')
  const el = document.getElementById('pending-orders')
  el.innerHTML = (data || []).map(o => `
    <div class="card item-row">
      <div>
        <strong>${o.attendees?.alias || o.attendees?.username}</strong> ordered <strong>${o.drinks?.name}</strong>
        <div class="muted" style="font-size:0.82rem">${new Date(o.created_at).toLocaleString()} · ${o.attendees?.credits} credits available</div>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm approve-btn" onclick="approveOrder('${o.id}', '${o.attendee_id}', ${o.attendees?.credits})">Approve & Make</button>
        <button class="btn btn-sm btn-danger" onclick="rejectOrder('${o.id}')">Reject</button>
      </div>
    </div>`).join('') || '<p class="muted">No pending orders.</p>'
}

window.approveOrder = async (orderId, attendeeId, currentCredits) => {
  await supabase.from('orders').update({ status: 'approved' }).eq('id', orderId)
  await supabase.from('attendees').update({ credits: Math.max(0, currentCredits - 1) }).eq('id', attendeeId)
  loadPendingOrders()
  loadAttendeesAdmin()
}

window.rejectOrder = async (id) => {
  await supabase.from('orders').update({ status: 'rejected' }).eq('id', id)
  loadPendingOrders()
}

// --- WISHLIST ---
async function loadWishlistAdmin() {
  const { data } = await supabase.from('wishlist').select('*').order('credit_value', { ascending: false })
  const el = document.getElementById('wishlist-list')
  el.innerHTML = (data || []).map(w => `
    <div class="card item-row">
      <div><strong>${w.item_name}</strong> <span class="badge">${w.credit_value} credits</span> ${!w.active ? '<span class="muted">(inactive)</span>' : ''}</div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-outline" onclick="toggleWishlist('${w.id}', ${w.active})">${w.active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWishlist('${w.id}')">Delete</button>
      </div>
    </div>`).join('') || '<p class="muted">No wishlist items yet.</p>'
}

window.toggleWishlist = async (id, current) => {
  await supabase.from('wishlist').update({ active: !current }).eq('id', id)
  loadWishlistAdmin()
}
window.deleteWishlist = async (id) => {
  await supabase.from('wishlist').delete().eq('id', id)
  loadWishlistAdmin()
}

document.getElementById('add-wishlist-btn').addEventListener('click', async () => {
  const item_name = document.getElementById('wishlist-name').value.trim()
  const credit_value = parseInt(document.getElementById('wishlist-credits').value)
  const status = document.getElementById('wishlist-status')
  if (!item_name || isNaN(credit_value)) { status.textContent = 'Both fields required'; status.className = 'error'; return }
  await supabase.from('wishlist').insert({ item_name, credit_value, active: true })
  status.textContent = 'Added!'
  status.className = 'success'
  document.getElementById('wishlist-name').value = ''
  document.getElementById('wishlist-credits').value = ''
  loadWishlistAdmin()
})

// --- SETTINGS ---
document.getElementById('save-passcode-btn').addEventListener('click', async () => {
  const val = document.getElementById('new-passcode').value.trim()
  const status = document.getElementById('passcode-status')
  if (!val) { status.textContent = 'Enter a passcode'; status.className = 'error'; return }
  await supabase.from('settings').update({ value: val }).eq('key', 'site_passcode')
  status.textContent = 'Passcode updated!'
  status.className = 'success'
  document.getElementById('new-passcode').value = ''
})
```

**Step 4: Verify admin panel**

Navigate to `/admin/index.html`. Log in with your Supabase admin email/password. You should see all 6 tabs. Test adding a drink in the Menu tab — it should appear. Test the Settings tab to change the passcode.

**Step 5: Commit**

```bash
git add admin/index.html admin/js/admin-auth.js admin/js/admin-main.js
git commit -m "feat: admin panel with all management tabs"
```

---

## Task 9: Attendee PIN Setup Flow

**Problem:** When the host adds an attendee with a blank PIN, the attendee needs a way to set their PIN on first login.

**Files:**
- Modify: `openbar.html` (add PIN setup form for new attendees)
- Modify: `js/auth.js` (add setPin function)

**Step 1: Add setPin to auth.js**

Add to `js/auth.js`:

```js
export async function setPin(username, newPin) {
  const pin_hash = await hashPin(newPin)
  const { error } = await supabase
    .from('attendees')
    .update({ pin_hash })
    .eq('username', username.toLowerCase())
    .eq('pin_hash', '') // only works if pin is blank
  return !error
}
```

**Step 2: Update openbar.html login flow**

In `openbar.html`, update the login button handler to detect blank-PIN attendees and show a PIN setup form. Add a PIN setup card after the login card:

```html
<!-- Add this after the login card in openbar.html -->
<div id="pin-setup-card" class="card" style="display:none;margin-top:1rem">
  <h3>Set Your PIN</h3>
  <p class="muted" style="margin-bottom:1rem">First time here? Set a PIN to secure your account.</p>
  <input type="hidden" id="setup-username">
  <input type="password" id="setup-pin" placeholder="Choose a PIN">
  <input type="password" id="setup-pin-confirm" placeholder="Confirm PIN">
  <button class="btn" id="setup-pin-btn" style="width:100%">Set PIN & Log In</button>
  <p id="setup-status"></p>
</div>
```

Update the login handler to check for blank pin_hash:

```js
document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim().toLowerCase()
  const pin = document.getElementById('pin').value

  // Check if attendee exists with blank pin (needs setup)
  const { data: existingAttendee } = await supabase
    .from('attendees').select('pin_hash').eq('username', username).single()

  if (existingAttendee && existingAttendee.pin_hash === '') {
    // Show PIN setup
    document.getElementById('setup-username').value = username
    document.getElementById('pin-setup-card').style.display = 'block'
    return
  }

  const attendee = await loginAttendee(username, pin)
  if (attendee) {
    showDashboard(attendee)
  } else {
    document.getElementById('login-error').style.display = 'block'
  }
})
```

Add the setup handler:

```js
document.getElementById('setup-pin-btn').addEventListener('click', async () => {
  const username = document.getElementById('setup-username').value
  const pin = document.getElementById('setup-pin').value
  const confirm = document.getElementById('setup-pin-confirm').value
  const status = document.getElementById('setup-status')
  if (pin !== confirm) { status.textContent = 'PINs do not match'; status.className = 'error'; return }
  if (pin.length < 4) { status.textContent = 'PIN must be at least 4 characters'; status.className = 'error'; return }
  const ok = await setPin(username, pin)
  if (ok) {
    const attendee = await loginAttendee(username, pin)
    if (attendee) showDashboard(attendee)
  } else {
    status.textContent = 'Setup failed. Contact the host.'
    status.className = 'error'
  }
})
```

**Step 3: Verify**

Add a new attendee from admin with blank PIN. Try logging in as them on `openbar.html` — PIN setup form should appear. Set a PIN and confirm login works.

**Step 4: Commit**

```bash
git add js/auth.js openbar.html
git commit -m "feat: attendee PIN setup flow for new accounts"
```

---

## Task 10: Deploy to GitHub Pages

**Files:**
- Create: `.nojekyll` (empty file — disables Jekyll processing)
- Create: `404.html` (simple redirect to index)

**Step 1: Create .nojekyll**

```bash
touch .nojekyll
```

**Step 2: Create 404.html**

Create `404.html`:

```html
<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="0;url=/index.html"></head>
<body></body>
</html>
```

**Step 3: Push to GitHub**

```bash
git add .nojekyll 404.html
git commit -m "chore: add github pages config"
git remote add origin https://github.com/YOUR_USERNAME/ershu.25.git
git push -u origin main
```

**Step 4: Enable GitHub Pages**

In the GitHub repo settings → Pages → set Source to `main` branch, root `/`.

**Step 5: Configure Porkbun DNS**

In Porkbun DNS settings for your domain, add:
- Type: `CNAME`, Host: `www`, Answer: `YOUR_USERNAME.github.io`
- Type: `A`, Host: `@`, Answer: `185.199.108.153` (GitHub Pages IP)
- Type: `A`, Host: `@`, Answer: `185.199.109.153`
- Type: `A`, Host: `@`, Answer: `185.199.110.153`
- Type: `A`, Host: `@`, Answer: `185.199.111.153`

**Step 6: Add custom domain in GitHub Pages settings**

In GitHub Pages settings, enter your custom domain. GitHub will auto-provision an SSL cert (may take a few minutes).

**Step 7: Final verification**

Visit your domain. You should see the passcode gate. Enter the passcode and verify all pages load correctly.

**Step 8: Final commit**

```bash
git push origin main
```

---

## Summary: File Tree

```
ershu.25/
├── index.html              # Passcode gate
├── home.html               # About / landing
├── menu.html               # Drinks menu + hover comments
├── gallery.html            # Photo gallery + upload
├── community.html          # General comments
├── openbar.html            # OpenBar dashboard
├── 404.html                # Redirect
├── .nojekyll
├── css/
│   └── style.css
├── js/
│   ├── supabase-client.js
│   ├── auth.js
│   ├── nav.js
│   ├── menu.js
│   ├── gallery.js
│   ├── community.js
│   └── openbar.js
├── admin/
│   ├── index.html
│   └── js/
│       ├── admin-auth.js
│       └── admin-main.js
└── docs/
    ├── schema.sql
    └── plans/
        ├── 2026-03-14-homebar-design.md
        └── 2026-03-14-homebar-implementation.md
```

---

## Order of Deduction for Drink Orders

When the host approves an order, 1 credit is deducted. This is a fixed cost per drink. If you want per-drink pricing in the future, add a `credit_cost` column to the `drinks` table and update the `approveOrder` function accordingly.
