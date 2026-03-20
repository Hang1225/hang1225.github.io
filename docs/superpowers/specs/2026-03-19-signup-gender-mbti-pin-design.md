# Signup Gender, MBTI & PIN Fix — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Three related improvements to the account signup flow on `openbar.html`:

1. **PIN text fix** — Replace all "password" wording with "PIN" in English UI text
2. **Gender + MBTI on signup** — Users choose their gender and MBTI type during account creation
3. **MBTI in guest lists** — MBTI badge shown alongside the existing gender badge in event guest lists when `show_gender` is enabled

---

## Feature 1 — PIN Text Fix

Replace English placeholder and error text in `openbar.html`. Chinese text (密码 / 确认密码) is unchanged.

| Location | Old text | New text |
|---|---|---|
| `#signup-pin` placeholder | `Set password (min 4 chars)` | `Set PIN (4 digits)` |
| `#signup-pin` `data-placeholder-en` | `Set password (min 4 chars)` | `Set PIN (4 digits)` |
| `#signup-pin-confirm` placeholder | `Confirm password` | `Confirm PIN` |
| `#signup-pin-confirm` `data-placeholder-en` | `Confirm password` | `Confirm PIN` |
| First-time login error | `First time? Please set your password via the "Join Open Bar" tab.` | `First time? Please set your PIN via the "Join Open Bar" tab.` |
| PIN length error | `Password must be at least 4 characters` | `PIN must be exactly 4 characters` |
| PIN mismatch error | `Passwords do not match` | `PINs do not match` |

Both `#signup-pin` and `#signup-pin-confirm` inputs get `maxlength="4"` so users cannot type more than 4 characters.

PIN validation changes from `pin.length < 4` to `pin.length !== 4`.

---

## Feature 2 — Gender + MBTI on Signup Form

### UI

Two optional `<select>` elements inserted between the username input and the PIN input in the signup form:

**Gender select** (`id="signup-gender"`):
- Options: `""` → Prefer not to say (default selected), `"male"` → Male, `"female"` → Female, `"non-binary"` → Non-binary

**MBTI select** (`id="signup-mbti"`):
- Options: `""` → Prefer not to say (default selected), then all 16 MBTI types in order:
  INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP

Both selects default to "Prefer not to say". Guests may leave them unset — they are optional.

### Data flow on account creation

In the `signup-btn` click handler, the existing `insert` call:
```js
.insert({ username, pin_hash, credits: 0, alias: null })
```
Becomes:
```js
const gender = document.getElementById('signup-gender').value || null
const mbti   = document.getElementById('signup-mbti').value || null
.insert({
  username,
  pin_hash,
  credits: 0,
  alias: null,
  gender: gender,
  mbti: mbti,
  gender_visibility: gender ? 'public' : 'admin_only'
})
```

- `gender` and `mbti` save as `null` when "Prefer not to say" is selected
- `gender_visibility` defaults to `'public'` when user self-sets gender (they are disclosing voluntarily), and `'admin_only'` when they leave it unset (consistent with current admin-set default)
- Admin can still override `gender_visibility` from the Attendees tab after signup

### Schema change

```sql
ALTER TABLE attendees ADD COLUMN mbti text;
```

Nullable, no default. `gender` column already exists.

---

## Feature 3 — MBTI in Event Guest Lists

MBTI piggybacks on the existing `show_gender` event toggle. When `show_gender` is enabled on an event, both the gender badge and the MBTI type are shown for each guest.

No new `show_mbti` event column is needed.

### `js/reservations.js` — `loadEventGuestList`

Add `mbti` to the existing attendees join in `loadEventGuestList`:
```js
attendees(alias, username, gender, gender_visibility, mbti)
```

### `openbar.html` — guest list rendering

In the guest list rendering code, where `renderGenderBadge(g.gender)` is currently called, append the MBTI type as a small muted badge:

```js
const gBadge = ev.show_gender ? ` ${renderGenderBadge(g.gender)}` : ''
const mBadge = ev.show_gender && g.mbti ? ` <span class="g-badge g-mbti">${escapeHtml(g.mbti)}</span>` : ''
```

Use in the guest list line as: `${gBadge}${mBadge}`

### Admin Attendees tab — MBTI display

In `admin/js/admin-main.js`, `loadSignupsAdmin()`:
- Add `mbti` to the `.select()` column list
- Display the MBTI value as a small read-only label next to the gender controls (display only — admin sets MBTI via Attendees tab if needed, but self-set by user is the primary path)

---

## Files Changed

| File | Change |
|---|---|
| `openbar.html` | PIN text + maxlength fixes; gender + MBTI selects in signup form; pass `gender`, `mbti`, `gender_visibility` in insert; render MBTI badge in guest list |
| `js/reservations.js` | Add `mbti` to `loadEventGuestList` attendees join |
| `admin/js/admin-main.js` | Add `mbti` to `loadSignupsAdmin` select; display MBTI in attendees row |
| Supabase DB | `ALTER TABLE attendees ADD COLUMN mbti text` |

---

## Out of Scope

- MBTI visibility toggle (MBTI is always shown when `show_gender` is enabled)
- Admin editing MBTI from the Attendees tab (display only)
- MBTI shown independently of `show_gender`
- Changing the existing login PIN field or flow
- Chinese translation of MBTI types or gender options
