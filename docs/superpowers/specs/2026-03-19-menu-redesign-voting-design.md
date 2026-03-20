# 酒单重设计 + 投票系统 — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Redesign `menu.html` with the following goals:
1. Display drinks with name, description, ABV, and flavor tags — no photos
2. Allow logged-in guests to vote for their favorite drink (once per event)
3. Show cumulative vote counts subtly on each drink entry
4. Capture `attendee_id` + `event_id` per vote for future gender/MBTI analysis

---

## Visual Design

### Layout

- Single centered column, `max-width: 580px`, generous side whitespace
- Page header preserved: eyebrow "今晚精选 / Tonight's Selection", h1 "酒单 / The Menu"
- Drinks sorted by ABV ascending (NULL ABV drinks sorted last, still shown)
- Each drink entry uses the **ABV liquid gauge** pattern

### Drink Entry Anatomy

```
[gauge] [name                    ] [♡]
        [description italic      ] [N]
        [abv-badge][tag][tag]
```

- **Left column (36px):** `2px`-wide vertical track (~100px tall). Gold fill height = `min(ABV / 40, 1) * 100%`. ABV percentage label in `Cinzel 0.42rem` below the track. If `abv` is null, the track renders empty with no label.
- **Center column (flex: 1):** Drink name in `Playfair Display 1.15rem` cream. Description in `Cormorant Garamond italic 0.78rem` muted. Tags row: ABV badge + flavor tag pills.
- **Right column (auto):** Heart `♡` muted-faint; turns gold `♥` after voting. Vote count in `Cinzel 0.46rem` below. Right column hidden entirely when no active event (see below).
- Entries separated by `1px solid rgba(201,168,76,0.06)`.
- No photos.

### Vote Interaction States

| Condition | Heart shown? | Behavior on click |
|---|---|---|
| No active event (regardless of login) | No | — (hearts hidden, note shown) |
| Active event + not logged in | Yes (♡, faint) | Show inline message "请先登录以投票" |
| Active event + logged in + not yet voted | Yes (♡, faint) | Expand inline confirmation |
| Active event + logged in + already voted this drink | Yes (♥, gold) | Expand inline confirmation to un-vote or keep |
| Active event + logged in + already voted different drink | Yes (♡, faint) | Expand inline confirmation (replaces old vote) |

### Vote Confirmation (Inline)

Structure: a `data-drink-id` and `data-drink-name` attribute on each entry's root element supplies the name to the confirmation copy without DOM traversal.

When a guest clicks the heart on an unvoted drink:
```
确认投给「[酒名]」？  [确认]  [取消]
```
- **确认**: call `submitVote()`. On success: heart turns gold, count increments +1 in DOM (optimistic). If previous vote existed on another drink, that drink's heart reverts to ♡ and count decrements -1 in DOM.
- **取消**: collapse confirmation, no change.
- **Error**: if `submitVote()` returns `ok: false`, collapse confirmation and show inline text "出现错误，请重试 / Something went wrong" in muted-red for 3 seconds, then fade out.

### No Active Event Note

When hearts are hidden (no qualifying event), show below the drinks list:
```
<p class="muted" style="font-style:italic; text-align:center">
  投票将在活动期间开放 / Voting opens during events
</p>
```

---

## Data Model

### `drinks` table — new columns

```sql
alter table drinks add column abv numeric(4,1);            -- e.g. 18.5, nullable
alter table drinks add column flavors text[] default '{}'; -- e.g. {'柑橘','起泡'}
```

`abv` is nullable. Drinks with null ABV appear last in the list; their gauge renders empty.

### New table: `drink_votes`

```sql
create table drink_votes (
  id           uuid primary key default gen_random_uuid(),
  drink_id     uuid references drinks(id) on delete cascade not null,
  attendee_id  uuid references attendees(id) not null,
  event_id     uuid references events(id) not null,  -- always required
  created_at   timestamptz default now(),
  unique (attendee_id, event_id)   -- one vote per guest per event
);
```

`event_id` is `NOT NULL` — a vote can only be cast during a qualifying event. The `unique (attendee_id, event_id)` constraint is therefore reliable (no NULL bypass).

**Why `event_id`:**
- Enforces one-vote-per-event via DB unique constraint
- Enables future analytics sliced by event (e.g. which event had most Negroni votes)
- Frontend displays cumulative total only: `count(*) where drink_id = X`

### RLS policies for `drink_votes`

```sql
alter table drink_votes enable row level security;

-- Anyone can read (for displaying vote counts)
create policy "public read drink_votes" on drink_votes
  for select using (true);

-- Anyone can insert
create policy "public insert drink_votes" on drink_votes
  for insert with check (true);

-- Anyone can delete (see security note below)
create policy "public delete drink_votes" on drink_votes
  for delete using (true);

-- Admin full access
create policy "admin full access drink_votes" on drink_votes
  for all using (auth.role() = 'authenticated');
```

**Security note:** This app uses custom username+PIN auth, not Supabase JWT auth. There is no `auth.uid()` to bind RLS to a specific attendee row. The delete policy is therefore permissive (`using (true)`), identical to how orders are handled in this project. Mitigation: `submitVote()` always passes the attendee's own ID as the delete filter; malicious deletion by another client is an accepted risk for this private event context.

**Known limitation — `mbti` absent from session object:** `loginAttendee()` in `auth.js` does not currently select `mbti` from the attendees table. The vote row captures `attendee_id` which can be joined to `attendees.mbti` in future analytics queries — no data is lost. However, if a future feature needs `mbti` in the browser session, `auth.js` will need updating. Out of scope for this spec.

---

## JS Changes

### `js/menu.js` — exports to add

**`loadDrinks()`** — updated: change order from `created_at` to `abv asc nulls last`.

**`loadAllVotes()`**
```js
// Fetch all rows from drink_votes (drink_id + id only)
// Returns Map<drinkId, count> built client-side
// Accepted limitation: fetches all rows. Suitable for small private events (<500 votes).
```

**`getMyVote(attendeeId, eventId)`**
```js
// SELECT drink_id FROM drink_votes
// WHERE attendee_id = attendeeId AND event_id = eventId LIMIT 1
// Returns drink_id string or null
```

**`submitVote(drinkId, attendeeId, eventId)`**
```js
// Step 1: DELETE FROM drink_votes WHERE attendee_id = attendeeId AND event_id = eventId
// Step 2: INSERT INTO drink_votes (drink_id, attendee_id, event_id)
// Note: two sequential operations, no transaction. On Step 2 failure after Step 1 succeeds,
// the guest loses their vote for this event. UI should show error and allow retry.
// Returns { ok: boolean, previousDrinkId: string | null }
// previousDrinkId lets the caller revert the old drink's heart in the DOM
```

**Removed exports:** `loadCommentsForDrink`, `submitComment` — deleted from `menu.js`. The comments table and its RLS policies remain in the database (data preserved); only the frontend interaction is removed.

### `menu.html` — page logic

On load:
1. `requirePasscode()` — unchanged
2. `getAttendeeSession()` → `attendee` (nullable)
3. Resolve `currentEvent` (see below) → nullable
4. `loadDrinks()` + `loadAllVotes()` in parallel → render all entries
5. If `attendee && currentEvent`: `getMyVote(attendee.id, currentEvent.id)` → mark voted drink heart gold

### Event Resolution for Voting (client-side)

```js
// From loadEvents() results (already fetched for other pages):
// Find most recent event where:
//   status not in ('cancelled', 'closed')
//   event_date <= today (compare date strings)
//   start_time is not null
//   combinedDatetime(event_date, start_time) + 36h > now()

function resolveCurrentEvent(events) {
  const now = Date.now()
  const WINDOW_MS = 36 * 60 * 60 * 1000

  return events
    .filter(e => {
      if (e.status === 'cancelled' || e.status === 'closed') return false
      if (!e.start_time) return false
      // Combine event_date (YYYY-MM-DD) + start_time (HH:MM:SS) into local datetime
      const dt = new Date(`${e.event_date}T${e.start_time}`)
      return dt.getTime() <= now && now < dt.getTime() + WINDOW_MS
    })
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))[0] ?? null
}
```

Timezone: `new Date('YYYY-MM-DDTHH:MM:SS')` without a timezone suffix is parsed as **local time** by modern browsers — correct for a venue-based event where host and guests are in the same timezone.

---

## Migration File

`docs/migrations/2026-03-19-menu-voting.sql`

Contains:
- `ALTER TABLE drinks ADD COLUMN abv ...`
- `ALTER TABLE drinks ADD COLUMN flavors ...`
- `CREATE TABLE drink_votes ...`
- All RLS policies for `drink_votes`

Naming follows the date-prefixed convention used in `2026-03-18-reservation-system.sql`.

---

## Out of Scope

- Gender/MBTI analytics dashboard (data captured via `attendee_id` join, analysis deferred)
- Admin UI for setting ABV/flavors on drinks (handled via existing admin panel or direct DB)
- Comments table data and RLS policies (preserved in DB, UI removed from `menu.html`)
