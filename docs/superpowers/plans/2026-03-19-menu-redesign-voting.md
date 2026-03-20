# Menu Redesign + Voting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `menu.html` with an ABV liquid-gauge layout (text-only, no photos), and add a per-event drink voting system that captures attendee gender/MBTI data for future analysis.

**Architecture:** Three sequential tasks — DB migration first (required by JS), then `menu.js` JS module (required by HTML), then `menu.html` full rewrite. Each task is independently committable. No automated test framework exists in this project; verification is manual via browser + Supabase dashboard.

**Tech Stack:** Vanilla JS ES modules, Supabase JS v2, HTML/CSS (existing design system in `css/style.css`), Supabase SQL migrations run manually via dashboard.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `docs/migrations/2026-03-19-menu-voting.sql` | Create | DB schema: add `abv`/`flavors` to drinks, create `drink_votes` table + RLS |
| `js/menu.js` | Modify | Add vote functions, update `loadDrinks()` sort, remove comment functions |
| `menu.html` | Rewrite | ABV gauge layout, vote UI, inline confirmation, i18n |

---

## Task 1: Database Migration

**Files:**
- Create: `docs/migrations/2026-03-19-menu-voting.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- docs/migrations/2026-03-19-menu-voting.sql

-- Add ABV and flavors to drinks table
alter table drinks add column if not exists abv numeric(4,1);
alter table drinks add column if not exists flavors text[] default '{}';

-- Create drink_votes table
create table if not exists drink_votes (
  id           uuid primary key default gen_random_uuid(),
  drink_id     uuid references drinks(id) on delete cascade not null,
  attendee_id  uuid references attendees(id) not null,
  event_id     uuid references events(id) not null,
  created_at   timestamptz default now(),
  unique (attendee_id, event_id)
);

-- RLS
alter table drink_votes enable row level security;

create policy "public read drink_votes" on drink_votes
  for select using (true);

create policy "public insert drink_votes" on drink_votes
  for insert with check (true);

create policy "public delete drink_votes" on drink_votes
  for delete using (true);

create policy "admin full access drink_votes" on drink_votes
  for all using (auth.role() = 'authenticated');
```

- [ ] **Step 2: Run migration in Supabase dashboard**

  Open Supabase → SQL Editor → paste the file contents → Run.

- [ ] **Step 3: Verify in Supabase Table Editor**

  - `drinks` table has new columns `abv` (numeric) and `flavors` (text[])
  - `drink_votes` table exists with columns: `id`, `drink_id`, `attendee_id`, `event_id`, `created_at`
  - RLS is enabled on `drink_votes` (padlock icon shown in Table Editor)

- [ ] **Step 4: Add at least one test drink with ABV and flavors via dashboard**

  In Table Editor → `drinks` → insert or update a row:
  - `abv`: `18.0`
  - `flavors`: `{柑橘,起泡,清新}`

  This is needed to verify the UI in later tasks.

- [ ] **Step 5: Commit the migration file**

```bash
git add docs/migrations/2026-03-19-menu-voting.sql
git commit -m "feat: add drink_votes table and abv/flavors columns to drinks"
```

---

## Task 2: Update `js/menu.js`

**Files:**
- Modify: `js/menu.js`

This task rewrites `menu.js` entirely. The old exports (`loadCommentsForDrink`, `submitComment`) are removed. The comments table in the DB is untouched.

- [ ] **Step 1: Replace `js/menu.js` with the new version**

```js
import { supabase } from './supabase-client.js'

// Fetch all active drinks ordered by ABV ascending (nulls last)
export async function loadDrinks() {
  const { data, error } = await supabase
    .from('drinks')
    .select('id, name, description, abv, flavors, active')
    .eq('active', true)
    .order('abv', { ascending: true, nullsFirst: false })
  return error ? [] : data
}

// Fetch all vote rows and return a Map<drinkId, count>
export async function loadAllVotes() {
  const { data, error } = await supabase
    .from('drink_votes')
    .select('drink_id')
  if (error || !data) return new Map()
  const counts = new Map()
  for (const row of data) {
    counts.set(row.drink_id, (counts.get(row.drink_id) ?? 0) + 1)
  }
  return counts
}

// Return the drink_id the attendee voted for in this event, or null
export async function getMyVote(attendeeId, eventId) {
  const { data, error } = await supabase
    .from('drink_votes')
    .select('drink_id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (error || !data) return null
  return data.drink_id
}

// Delete existing vote for this attendee+event, then insert new vote.
// Returns { ok: boolean, previousDrinkId: string | null }
export async function submitVote(drinkId, attendeeId, eventId) {
  // Step 1: find and delete existing vote
  const { data: existing } = await supabase
    .from('drink_votes')
    .select('drink_id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .maybeSingle()

  const previousDrinkId = existing?.drink_id ?? null

  if (previousDrinkId) {
    const { error: delError } = await supabase
      .from('drink_votes')
      .delete()
      .eq('attendee_id', attendeeId)
      .eq('event_id', eventId)
    if (delError) return { ok: false, previousDrinkId: null }
  }

  // Step 2: insert new vote
  const { error: insError } = await supabase
    .from('drink_votes')
    .insert({ drink_id: drinkId, attendee_id: attendeeId, event_id: eventId })

  if (insError) return { ok: false, previousDrinkId }
  return { ok: true, previousDrinkId }
}
```

- [ ] **Step 2: Verify no import errors**

  Open any page that imports `menu.js` in browser dev tools. Confirm no `SyntaxError` or `Cannot find module` errors in the console.

- [ ] **Step 3: Smoke-test `loadDrinks()` in browser console**

  On `menu.html` (after next task), or temporarily in browser console:
  ```js
  import('/js/menu.js').then(m => m.loadDrinks().then(console.log))
  ```
  Expected: array of drink objects with `abv` and `flavors` fields.

- [ ] **Step 4: Commit**

```bash
git add js/menu.js
git commit -m "feat: add vote functions to menu.js, remove comment exports"
```

---

## Task 3: Rewrite `menu.html`

**Files:**
- Modify: `menu.html`

This is a full rewrite of the `<style>`, `<body>`, and `<script>` sections. The `<head>` meta tags and CSS link are preserved.

- [ ] **Step 1: Replace `menu.html` with the new version**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>酒单 — 二十五</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    /* ── Menu page layout ── */
    .menu-list {
      max-width: 580px;
      margin: 0 auto;
    }

    /* ── Single drink entry ── */
    .drink-entry {
      display: grid;
      grid-template-columns: 36px 1fr auto;
      gap: 0 1.6rem;
      padding: 2rem 0;
      border-bottom: 1px solid rgba(201,168,76,0.06);
      align-items: center;
    }
    .drink-entry:last-child { border-bottom: none; }

    /* ── ABV gauge (left column) ── */
    .gauge-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      align-self: stretch;
      justify-content: center;
    }
    .gauge-track {
      width: 2px;
      flex: 1;
      min-height: 80px;
      max-height: 120px;
      background: rgba(201,168,76,0.08);
      border-radius: 2px;
      position: relative;
    }
    .gauge-fill {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: linear-gradient(to top, var(--gold), rgba(201,168,76,0.3));
      border-radius: 2px;
    }
    .gauge-label {
      font-family: 'Cinzel', serif;
      font-size: 0.42rem;
      letter-spacing: 0.1em;
      color: rgba(201,168,76,0.4);
      white-space: nowrap;
    }

    /* ── Drink info (center column) ── */
    .drink-info {}
    .drink-name {
      font-family: 'Playfair Display', 'Noto Serif SC', serif;
      color: var(--cream);
      font-size: 1.15rem;
      font-weight: 400;
      margin-bottom: 0.3rem;
    }
    .drink-desc {
      color: var(--muted);
      font-style: italic;
      font-size: 0.78rem;
      line-height: 1.55;
      margin-bottom: 0.55rem;
    }
    .drink-tags {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .abv-badge {
      font-family: 'Cinzel', serif;
      font-size: 0.5rem;
      letter-spacing: 0.14em;
      color: var(--gold);
      border: 1px solid var(--gold-dim, rgba(201,168,76,0.35));
      padding: 1px 6px;
      border-radius: 2px;
    }
    .flavor-tag {
      font-size: 0.58rem;
      color: var(--muted);
      background: rgba(201,168,76,0.04);
      border: 1px solid rgba(201,168,76,0.1);
      border-radius: 2px;
      padding: 1px 5px;
    }

    /* ── Vote column (right) ── */
    .vote-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      min-width: 32px;
    }
    .heart-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      color: rgba(106,94,74,0.4);
      line-height: 1;
      padding: 0;
      transition: color 0.2s;
    }
    .heart-btn.voted { color: var(--gold); }
    .vote-count {
      font-family: 'Cinzel', serif;
      font-size: 0.46rem;
      color: var(--muted);
      letter-spacing: 0.05em;
    }
    .vote-count.voted { color: var(--gold); }

    /* ── Inline confirmation ── */
    .vote-confirm {
      display: none;
      margin-top: 0.4rem;
      text-align: center;
      animation: fadeIn 0.15s ease both;
    }
    .vote-confirm.open { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; } }
    .confirm-text {
      font-size: 0.62rem;
      color: var(--text);
      font-style: italic;
      margin-bottom: 0.35rem;
      line-height: 1.4;
    }
    .confirm-btns { display: flex; gap: 0.4rem; justify-content: center; }
    .confirm-yes, .confirm-no {
      font-family: 'Cinzel', serif;
      font-size: 0.46rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border: 1px solid rgba(201,168,76,0.25);
      background: none;
      color: var(--muted);
      padding: 2px 8px;
      border-radius: 2px;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .confirm-yes:hover { color: var(--gold); border-color: var(--gold-dim, rgba(201,168,76,0.35)); }
    .confirm-no:hover { color: var(--cream); }
    .vote-error {
      font-size: 0.6rem;
      color: var(--red, #C06060);
      font-style: italic;
      margin-top: 0.3rem;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .vote-error.show { opacity: 1; }

    /* ── No-event note ── */
    .no-event-note {
      text-align: center;
      color: var(--muted);
      font-style: italic;
      font-size: 0.82rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div id="nav"></div>
  <main>
    <div class="page-header fade-in">
      <span class="eyebrow" data-zh="今晚精选" data-en="Tonight's Selection">今晚精选</span>
      <h1 data-zh="酒单" data-en="The Menu">酒单</h1>
    </div>

    <div id="menu-list" class="menu-list fade-in-2"></div>
  </main>
  <div id="footer"></div>

  <script type="module">
    import { requirePasscode } from './js/auth.js'
    import { renderNav, renderFooter, initLang } from './js/nav.js'
    import { getAttendeeSession } from './js/auth.js'
    import { loadEvents } from './js/events.js'
    import { loadDrinks, loadAllVotes, getMyVote, submitVote } from './js/menu.js'
    import { t } from './js/i18n.js'

    requirePasscode()
    document.getElementById('nav').innerHTML = renderNav('酒单')
    document.getElementById('footer').innerHTML = renderFooter()
    initLang()

    function escapeHtml(str) {
      if (!str) return ''
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }

    // ── Event resolution ────────────────────────────────────────
    function resolveCurrentEvent(events) {
      const now = Date.now()
      const WINDOW_MS = 36 * 60 * 60 * 1000
      return events
        .filter(e => {
          if (e.status === 'cancelled' || e.status === 'closed') return false
          if (!e.start_time) return false
          const dt = new Date(`${e.event_date}T${e.start_time}`)
          return dt.getTime() <= now && now < dt.getTime() + WINDOW_MS
        })
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0] ?? null
    }

    // ── Gauge fill height ────────────────────────────────────────
    function gaugeHeight(abv) {
      if (abv == null) return 0
      return Math.min(abv / 40, 1) * 100
    }

    // ── Build one drink entry ────────────────────────────────────
    function buildEntry(drink, voteCount, isMyVote, showVoting) {
      const entry = document.createElement('div')
      entry.className = 'drink-entry'
      entry.dataset.drinkId = drink.id
      entry.dataset.drinkName = drink.name

      // Gauge
      const fillPct = gaugeHeight(drink.abv)
      const gaugeHtml = `
        <div class="gauge-wrap">
          <div class="gauge-track">
            <div class="gauge-fill" style="height:${fillPct}%"></div>
          </div>
          ${drink.abv != null ? `<span class="gauge-label">${drink.abv}%</span>` : ''}
        </div>`

      // Tags
      const abvBadge = drink.abv != null
        ? `<span class="abv-badge">ABV ${drink.abv}%</span>`
        : ''
      const flavorTags = (drink.flavors || [])
        .map(f => `<span class="flavor-tag">${escapeHtml(f)}</span>`)
        .join('')

      // Info
      const infoHtml = `
        <div class="drink-info">
          <div class="drink-name">${escapeHtml(drink.name)}</div>
          <div class="drink-desc">${escapeHtml(drink.description || '')}</div>
          <div class="drink-tags">${abvBadge}${flavorTags}</div>
        </div>`

      // Vote column
      let voteHtml = ''
      if (showVoting) {
        const heartClass = isMyVote ? 'heart-btn voted' : 'heart-btn'
        const heartChar = isMyVote ? '♥' : '♡'
        const countClass = isMyVote ? 'vote-count voted' : 'vote-count'
        voteHtml = `
          <div class="vote-col">
            <button class="heart-btn ${isMyVote ? 'voted' : ''}" aria-label="${t('投票', 'Vote')}">${isMyVote ? '♥' : '♡'}</button>
            <span class="vote-count ${isMyVote ? 'voted' : ''}">${voteCount}</span>
            <div class="vote-confirm">
              <div class="confirm-text">${t('确认投给', 'Vote for')} 「${escapeHtml(drink.name)}」？</div>
              <div class="confirm-btns">
                <button class="confirm-yes">${t('确认', 'Yes')}</button>
                <button class="confirm-no">${t('取消', 'Cancel')}</button>
              </div>
              <div class="vote-error">${t('出现错误，请重试', 'Something went wrong')}</div>
            </div>
          </div>`
      }

      entry.innerHTML = gaugeHtml + infoHtml + voteHtml
      return entry
    }

    // ── Main ────────────────────────────────────────────────────
    const attendee = getAttendeeSession()
    const [events, drinks, voteCounts] = await Promise.all([
      loadEvents(),
      loadDrinks(),
      loadAllVotes(),
    ])

    const currentEvent = resolveCurrentEvent(events)
    const showVoting = currentEvent != null
    const list = document.getElementById('menu-list')

    // Get this attendee's current vote (if logged in + active event)
    let myVoteDrinkId = null
    if (attendee && currentEvent) {
      myVoteDrinkId = await getMyVote(attendee.id, currentEvent.id)
    }

    if (drinks.length === 0) {
      list.innerHTML = `<p class="muted" style="font-style:italic">${t('暂无酒单，敬请期待', 'No menu yet — check back soon.')}</p>`
    } else {
      for (const drink of drinks) {
        const count = voteCounts.get(drink.id) ?? 0
        const isMyVote = myVoteDrinkId === drink.id
        const entry = buildEntry(drink, count, isMyVote, showVoting)
        list.appendChild(entry)
      }

      if (!showVoting) {
        const note = document.createElement('p')
        note.className = 'no-event-note'
        note.textContent = t('投票将在活动期间开放', 'Voting opens during events')
        list.appendChild(note)
      }
    }

    // ── Vote interaction ─────────────────────────────────────────
    list.addEventListener('click', async e => {
      // Heart button clicked
      const heartBtn = e.target.closest('.heart-btn')
      if (heartBtn) {
        const entry = heartBtn.closest('.drink-entry')
        const confirm = entry.querySelector('.vote-confirm')

        // Not logged in
        if (!attendee) {
          heartBtn.insertAdjacentHTML('afterend',
            `<span class="vote-error show" style="opacity:1">${t('请先登录以投票', 'Please log in to vote')}</span>`)
          setTimeout(() => entry.querySelector('.vote-error')?.remove(), 3000)
          return
        }

        // Toggle confirmation
        confirm.classList.toggle('open')
        return
      }

      // Cancel button
      if (e.target.closest('.confirm-no')) {
        e.target.closest('.vote-confirm').classList.remove('open')
        return
      }

      // Confirm button
      if (e.target.closest('.confirm-yes')) {
        const entry = e.target.closest('.drink-entry')
        const drinkId = entry.dataset.drinkId
        const confirm = entry.querySelector('.vote-confirm')
        const errorEl = confirm.querySelector('.vote-error')

        const result = await submitVote(drinkId, attendee.id, currentEvent.id)

        if (!result.ok) {
          errorEl.classList.add('show')
          setTimeout(() => errorEl.classList.remove('show'), 3000)
          confirm.classList.remove('open')
          return
        }

        confirm.classList.remove('open')

        // Revert previous voted drink
        if (result.previousDrinkId && result.previousDrinkId !== drinkId) {
          const oldEntry = list.querySelector(`[data-drink-id="${result.previousDrinkId}"]`)
          if (oldEntry) {
            oldEntry.querySelector('.heart-btn').classList.remove('voted')
            oldEntry.querySelector('.heart-btn').textContent = '♡'
            const oldCount = oldEntry.querySelector('.vote-count')
            oldCount.textContent = Math.max(0, parseInt(oldCount.textContent) - 1)
            oldCount.classList.remove('voted')
          }
        }

        // Update this drink
        const heart = entry.querySelector('.heart-btn')
        heart.classList.add('voted')
        heart.textContent = '♥'
        const count = entry.querySelector('.vote-count')
        // Only increment if this wasn't already voted (new vote, not re-vote of same drink)
        if (!count.classList.contains('voted')) {
          count.textContent = parseInt(count.textContent) + 1
        }
        count.classList.add('voted')

        myVoteDrinkId = drinkId
      }
    })
  </script>
</body>
</html>
```

- [ ] **Step 2: Open `menu.html` in browser and verify basic render**

  - Drinks list shows with gauge on left, name/desc/tags in center
  - ABV gauge fill height visually corresponds to alcohol level (higher ABV = taller gold fill)
  - ABV% label appears below each gauge track
  - Flavor tags appear as small bordered pills
  - If no active event: hearts are hidden, "投票将在活动期间开放" note visible

- [ ] **Step 3: Verify vote interaction (requires active event + attendee login)**

  - Log in as an attendee via the Open Bar tab
  - Navigate to `menu.html`
  - Click a heart → inline confirmation appears with drink name
  - Click 取消 → confirmation collapses, no vote registered
  - Click a heart → confirmation → click 确认
    - Heart turns gold (♥)
    - Vote count increments by 1
    - Confirmation collapses
  - Click the gold heart again → confirmation re-appears
  - Click another drink's heart → confirmation → 确认
    - Previous drink heart reverts to ♡, count decrements
    - New drink heart turns gold, count increments
  - Verify in Supabase Table Editor → `drink_votes`: one row exists for this attendee

- [ ] **Step 4: Verify unauthenticated state**

  - Log out (clear session via Open Bar → logout, or clear sessionStorage)
  - Reload `menu.html` — hearts still visible but faint
  - Click a heart → "请先登录以投票" message appears briefly

- [ ] **Step 5: Verify language switching**

  - Toggle language (EN/ZH) via nav
  - Page header changes between "酒单" and "The Menu"
  - No-event note and vote error messages respond to language if `t()` is wired

- [ ] **Step 6: Commit**

```bash
git add menu.html
git commit -m "feat: redesign menu with ABV gauge layout and drink voting"
```

---

## Final Checks

- [ ] **Confirm no console errors** on `menu.html` in browser dev tools (Network + Console tabs)
- [ ] **Confirm `drink_votes` rows** in Supabase have correct `attendee_id`, `drink_id`, `event_id`
- [ ] **Confirm vote deduplication**: voting again in the same event replaces the old row (only 1 row per attendee+event in the table)
- [ ] **Confirm old comment-related exports** (`loadCommentsForDrink`, `submitComment`) are gone from `js/menu.js` and that no other file imports them (search codebase for these names)
