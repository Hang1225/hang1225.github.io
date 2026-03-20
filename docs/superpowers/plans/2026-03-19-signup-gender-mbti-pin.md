# Signup Gender, MBTI & PIN Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gender and MBTI selection to the account signup form, fix all "password" text to "PIN" with a 4-character exact limit, and show MBTI alongside gender in event guest lists.

**Architecture:** Three tasks: DB migration, then all `openbar.html` changes (PIN fix + signup form + guest list), then `js/reservations.js` + `admin/js/admin-main.js` for MBTI data flow. No new files needed.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS v2. No test runner — verification is manual browser inspection.

---

## File Map

| File | What changes |
|---|---|
| Supabase DB | `ALTER TABLE attendees ADD COLUMN mbti text` |
| `openbar.html` | PIN text + maxlength fixes; gender + MBTI selects in signup form; gender/MBTI in insert; MBTI badge CSS + rendering in guest list |
| `js/reservations.js` | Add `mbti` to `loadEventGuestList` attendees join + return value |
| `admin/js/admin-main.js` | Add `mbti` to `loadSignupsAdmin` select; display MBTI label in attendees row |

---

## Task 1: DB migration — add mbti column

**Files:**
- Supabase DB (manual SQL execution)

- [ ] **Step 1: Run the migration**

  In the Supabase SQL editor, execute:
  ```sql
  ALTER TABLE attendees ADD COLUMN mbti text;
  ```

- [ ] **Step 2: Verify**

  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'attendees' AND column_name = 'mbti';
  ```
  Expected: one row, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

  ```bash
  git commit --allow-empty -m "feat: add mbti column to attendees table (migration applied)"
  ```

---

## Task 2: openbar.html — PIN fix + signup form gender/MBTI

**Files:**
- Modify: `openbar.html`

This task covers all changes to the signup form and PIN wording.

### PIN text fixes

- [ ] **Step 1: Fix `#signup-pin` placeholder and data-placeholder-en**

  Find:
  ```html
  <input type="password" id="signup-pin"
    data-placeholder-zh="设置密码（至少4位）" data-placeholder-en="Set password (min 4 chars)"
    placeholder="设置密码（至少4位）" autocomplete="new-password">
  ```

  Replace with:
  ```html
  <input type="password" id="signup-pin" maxlength="4"
    data-placeholder-zh="设置密码（4位）" data-placeholder-en="Set PIN (4 digits)"
    placeholder="设置密码（4位）" autocomplete="new-password">
  ```

- [ ] **Step 2: Fix `#signup-pin-confirm` placeholder and data-placeholder-en**

  Find:
  ```html
  <input type="password" id="signup-pin-confirm"
    data-placeholder-zh="确认密码" data-placeholder-en="Confirm password"
    placeholder="确认密码" autocomplete="new-password">
  ```

  Replace with:
  ```html
  <input type="password" id="signup-pin-confirm" maxlength="4"
    data-placeholder-zh="确认密码" data-placeholder-en="Confirm PIN"
    placeholder="确认密码" autocomplete="new-password">
  ```

- [ ] **Step 3: Fix first-time login error message**

  Find:
  ```js
  errEl.textContent = t('首次登录？请通过「加入Open Bar」标签设置密码。', 'First time? Please set your password via the "Join Open Bar" tab.')
  ```

  Replace with:
  ```js
  errEl.textContent = t('首次登录？请通过「加入Open Bar」标签设置密码。', 'First time? Please set your PIN via the "Join Open Bar" tab.')
  ```

- [ ] **Step 4: Fix PIN length validation and error messages in signup handler**

  Find:
  ```js
  if (pin.length < 4) { status.textContent = t('密码至少4位', 'Password must be at least 4 characters'); status.className = 'error'; return }
  if (pin !== confirm) { status.textContent = t('两次密码不一致', 'Passwords do not match'); status.className = 'error'; return }
  ```

  Replace with:
  ```js
  if (pin.length !== 4) { status.textContent = t('密码须为4位', 'PIN must be exactly 4 characters'); status.className = 'error'; return }
  if (pin !== confirm) { status.textContent = t('两次密码不一致', 'PINs do not match'); status.className = 'error'; return }
  ```

### Signup form — gender and MBTI selects

- [ ] **Step 5: Add gender and MBTI selects to the signup form**

  Find (in the signup form HTML, between the username input and the PIN input):
  ```html
  <input type="text" id="signup-username"
    data-placeholder-zh="选择用户名" data-placeholder-en="Choose a username"
    placeholder="选择用户名" autocomplete="username">
  <input type="password" id="signup-pin" maxlength="4"
  ```

  Replace with:
  ```html
  <input type="text" id="signup-username"
    data-placeholder-zh="选择用户名" data-placeholder-en="Choose a username"
    placeholder="选择用户名" autocomplete="username">
  <select id="signup-gender" style="width:100%">
    <option value="">性别（可选）/ Gender (optional)</option>
    <option value="male">男 / Male</option>
    <option value="female">女 / Female</option>
    <option value="non-binary">非二元 / Non-binary</option>
  </select>
  <select id="signup-mbti" style="width:100%">
    <option value="">MBTI（可选）/ MBTI (optional)</option>
    <option value="INTJ">INTJ</option>
    <option value="INTP">INTP</option>
    <option value="ENTJ">ENTJ</option>
    <option value="ENTP">ENTP</option>
    <option value="INFJ">INFJ</option>
    <option value="INFP">INFP</option>
    <option value="ENFJ">ENFJ</option>
    <option value="ENFP">ENFP</option>
    <option value="ISTJ">ISTJ</option>
    <option value="ISFJ">ISFJ</option>
    <option value="ESTJ">ESTJ</option>
    <option value="ESFJ">ESFJ</option>
    <option value="ISTP">ISTP</option>
    <option value="ISFP">ISFP</option>
    <option value="ESTP">ESTP</option>
    <option value="ESFP">ESFP</option>
  </select>
  <input type="password" id="signup-pin" maxlength="4"
  ```

### Signup handler — include gender, MBTI, gender_visibility in insert

- [ ] **Step 6: Update the insert call to include gender and MBTI**

  Find:
  ```js
  const pin_hash = await hashPin(pin)
  const { error } = await supabase
    .from('attendees')
    .insert({ username, pin_hash, credits: 0, alias: null })
  ```

  Replace with:
  ```js
  const gender = document.getElementById('signup-gender').value || null
  const mbti   = document.getElementById('signup-mbti').value || null
  const pin_hash = await hashPin(pin)
  const { error } = await supabase
    .from('attendees')
    .insert({
      username,
      pin_hash,
      credits: 0,
      alias: null,
      gender,
      mbti,
      gender_visibility: gender ? 'public' : 'admin_only'
    })
  ```

### Guest list — MBTI badge CSS and rendering

- [ ] **Step 7: Add `.g-mbti` CSS class**

  Find this exact line in the `<style>` block (the last of the `.g-*` badge classes):
  ```css
  .g-hidden { background: rgba(106,94,74,0.1); border: 1px solid rgba(106,94,74,0.2); color: var(--muted); }
    </style>
  ```

  Replace with:
  ```css
  .g-hidden { background: rgba(106,94,74,0.1); border: 1px solid rgba(106,94,74,0.2); color: var(--muted); }
  .g-mbti { background: rgba(160,140,100,0.12); border: 1px solid rgba(160,140,100,0.25); color: var(--muted); }
    </style>
  ```

- [ ] **Step 8: Add MBTI badge to guest list rendering**

  Find (in the guest pills map):
  ```js
  const gBadge = ev.show_gender ? ` ${renderGenderBadge(g.gender)}` : ''
  const plus = g.guestCount === 2 ? ` <span class="badge" style="font-size:0.44rem">+1</span>` : ''
  return `<span class="guest-pill">${name}${gBadge}${plus}</span>`
  ```

  Replace with:
  ```js
  const gBadge = ev.show_gender ? ` ${renderGenderBadge(g.gender)}` : ''
  const mBadge = ev.show_gender && g.mbti ? ` <span class="g-badge g-mbti">${escapeHtml(g.mbti)}</span>` : ''
  const plus = g.guestCount === 2 ? ` <span class="badge" style="font-size:0.44rem">+1</span>` : ''
  return `<span class="guest-pill">${name}${gBadge}${mBadge}${plus}</span>`
  ```

- [ ] **Step 9: Verify**

  1. Open `openbar.html` → Join Open Bar tab
  2. Confirm gender and MBTI dropdowns appear between username and PIN inputs
  3. Confirm PIN field has `maxlength="4"` (try typing more than 4 chars — should be blocked)
  4. Sign up without selecting gender/MBTI — confirm account creates successfully
  5. Sign up selecting gender + MBTI — confirm values saved in Supabase `attendees` row
  6. Confirm `gender_visibility = 'public'` when gender was selected, `'admin_only'` when not
  7. Check first-time login error says "PIN" not "password"
  8. Check length/mismatch errors say "PIN"

- [ ] **Step 10: Commit**

  ```bash
  git add openbar.html
  git commit -m "feat: add gender/MBTI to signup form, fix PIN wording, add MBTI guest list badge"
  ```

---

## Task 3: js/reservations.js — MBTI in guest list data

**Files:**
- Modify: `js/reservations.js`

- [ ] **Step 1: Add `mbti` to the attendees join in `loadEventGuestList`**

  Find (line ~26):
  ```js
  .select('id, guest_count, attendees(alias, username, gender, gender_visibility)')
  ```

  Replace with:
  ```js
  .select('id, guest_count, attendees(alias, username, gender, gender_visibility, mbti)')
  ```

- [ ] **Step 2: Expose `mbti` in the return value**

  Find (in the `guests` map):
  ```js
  guests: confirmed.map(r => ({
    name: showNames ? (r.attendees.alias || r.attendees.username) : null,
    gender: showGender && r.attendees.gender_visibility === 'public'
      ? r.attendees.gender
      : null,
    guestCount: r.guest_count
  }))
  ```

  Replace with:
  ```js
  guests: confirmed.map(r => ({
    name: showNames ? (r.attendees.alias || r.attendees.username) : null,
    gender: showGender && r.attendees.gender_visibility === 'public'
      ? r.attendees.gender
      : null,
    mbti: showGender ? r.attendees.mbti : null,
    guestCount: r.guest_count
  }))
  ```

  Note: `mbti` is gated on `showGender` (no separate toggle needed). When `show_gender` is off, `g.mbti` is `null` and `mBadge` in the rendering code produces nothing.

- [ ] **Step 3: Verify**

  1. On an event with `show_gender` enabled, confirm the guest list now shows MBTI badges next to gender badges for guests who set their MBTI
  2. Guests with no MBTI set show no MBTI badge
  3. On an event with `show_gender` disabled, confirm no MBTI badge appears

- [ ] **Step 4: Commit**

  ```bash
  git add js/reservations.js
  git commit -m "feat: expose mbti in loadEventGuestList return value"
  ```

---

## Task 4: admin/js/admin-main.js — MBTI in attendees tab

**Files:**
- Modify: `admin/js/admin-main.js`

- [ ] **Step 1: Add `mbti` to `loadSignupsAdmin` select**

  Find (line ~285):
  ```js
  .select('id, username, alias, nickname, gender, gender_visibility, created_at, removed_at')
  ```

  Replace with:
  ```js
  .select('id, username, alias, nickname, mbti, gender, gender_visibility, created_at, removed_at')
  ```

- [ ] **Step 2: Display MBTI in the attendee row**

  Find this block (the `selfLabel` definition that precedes `aliasDisplay`):
  ```js
  const selfLabel = !a.gender
    ? `<span class="muted" style="font-size:0.78rem;font-style:italic"> (prefers not to say)</span>`
    : ''

  // data-alias uses escapeHtml() for HTML attribute safety (e.g. quotes in alias names).
  // dataset.alias in JS automatically un-decodes HTML entities, so input.value receives the literal string.
  const aliasDisplay = isDisabled
  ```

  Replace with:
  ```js
  const selfLabel = !a.gender
    ? `<span class="muted" style="font-size:0.78rem;font-style:italic"> (prefers not to say)</span>`
    : ''
  const mbtiLabel = a.mbti
    ? `<span style="font-size:0.75rem;color:var(--muted);margin-left:0.4rem">${escapeHtml(a.mbti)}</span>`
    : ''

  // data-alias uses escapeHtml() for HTML attribute safety (e.g. quotes in alias names).
  // dataset.alias in JS automatically un-decodes HTML entities, so input.value receives the literal string.
  const aliasDisplay = isDisabled
  ```

  Then find the line in `row.innerHTML` where `selfLabel` is rendered:
  ```js
  <span class="muted"> @${escapeHtml(a.username)}</span>${selfLabel}
  ```

  Replace with:
  ```js
  <span class="muted"> @${escapeHtml(a.username)}</span>${selfLabel}${mbtiLabel}
  ```

- [ ] **Step 3: Verify**

  1. Open the admin panel → Attendees tab
  2. For an attendee who set their MBTI at signup, confirm the MBTI type appears as a small muted label after the username
  3. Attendees with no MBTI show no label

- [ ] **Step 4: Commit**

  ```bash
  git add admin/js/admin-main.js
  git commit -m "feat: display MBTI in admin attendees tab"
  ```

---

## Final Verification Checklist

- [ ] PIN inputs have `maxlength="4"` — can't type more than 4 chars
- [ ] Signup validation checks `pin.length !== 4` (exact 4, not min 4)
- [ ] Error messages say "PIN" not "password" (English)
- [ ] Gender and MBTI dropdowns appear in signup form
- [ ] Both fields optional — skipping them creates account normally
- [ ] Selecting gender sets `gender_visibility = 'public'`; skipping sets `'admin_only'`
- [ ] MBTI stored in Supabase `attendees.mbti` after signup
- [ ] Event guest list with `show_gender` enabled shows MBTI badge when guest has MBTI set
- [ ] No MBTI badge when guest has no MBTI, or when `show_gender` is disabled
- [ ] Admin Attendees tab shows MBTI label next to username
