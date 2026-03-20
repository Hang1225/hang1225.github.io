# Profile Edit — Design Spec
**Date:** 2026-03-19

## Overview

Logged-in users on `openbar.html` can view their current gender and MBTI badge directly in the dashboard header, and edit their displayed name, gender, and MBTI via a panel that opens when they click their avatar.

---

## UI Design

### Dashboard Header (default state)

The existing header is extended to include:

- **Avatar circle** — initials of the user's displayed name (alias or username), gold border, subtle glow. A small pencil icon `✎` sits in the bottom-right corner of the avatar.
- **「编辑资料」label** — Cinzel 0.45rem, uppercase, muted color, centered below the avatar. Makes the edit affordance discoverable.
- **Gender + MBTI badges** — displayed below the name using existing `.g-badge` classes (`.g-f`, `.g-m`, `.g-nb`, `.g-mbti`). Only shown if the value is set.

### Edit Panel (opens on avatar click, closes on second click or save)

A card (`border: 1px solid var(--gold-dim)`) that appears below the header, above the dashboard cards. Contains:

1. **显示名称** — text input, pre-filled with current `alias || username`
2. **性别（可选）** — identical gender pills from signup (`.gender-pill`, `border-radius: 20px`, gold active state with `◆`). No "clear" option needed — selecting 「不透露」covers the private case; gender_visibility will be set to `'admin_only'` when gender is `null` or `'prefer-not'`.
3. **MBTI（可选）** — identical MBTI carousel from signup: 4-tab classifier (`.mbti-signup-tab.ta/td/ts/te`) + sliding carousel with SVG character cards + nav arrows + dots
4. **保存修改 button** — full width, gold style

Panel is toggled (not a modal), inserted as a sibling card in the dashboard flow. Clicking the avatar a second time closes the panel and silently discards unsaved changes — no confirmation prompt needed.

---

## Data Flow

- On panel open: pre-select the user's current `gender` pill and navigate carousel to the correct slide, highlight the current `mbti` card.
- On save: `supabase.from('attendees').update({ alias, gender, mbti, gender_visibility }).eq('id', currentAttendee.id)`
- `gender_visibility` logic: if gender is set → `'public'`; if cleared → `'admin_only'`
- After successful save: update `currentAttendee` in memory, refresh the header (name, badges), close the panel, show brief success message.
- On error: show inline error message inside the panel.

---

## Implementation Scope

**Files to modify:** `openbar.html` only.

**What changes:**
- CSS: avatar styles, edit-hint, edit panel card, toggle animation
- HTML: replace existing `dashboard-header` greeting with new avatar + hint + badges layout; add hidden `#profile-edit-panel` div after the header rule
- JS: `toggleProfilePanel()`, `openProfilePanel()`, `closeProfilePanel()`, `saveProfile()` — all exposed to `window` for inline onclick compatibility (matches existing pattern)

**Reuse (no duplication):**
- Gender pill CSS classes already exist (`.gender-pill`, `.gender-pills`)
- MBTI carousel CSS classes already exist (`.mbti-signup-tab`, `.mbti-char-card`, etc.)
- The edit panel reuses these same classes and the same `mbtiGoSlide` / `mbtiPick` / `signupSelectGender` window functions — or new parallel versions scoped to the profile panel to avoid conflicts with the signup form

**Conflict handling:** Since signup and profile panels are never visible at the same time (signup is pre-login, profile is post-login), use separate functions: `profileMbtiPick(el, type)`, `profileMbtiGoSlide(idx)`, `profileSelectGender(el)` — each exposed to `window`. This keeps state isolated and avoids any risk of the signup hidden inputs being affected.

---

## Error Handling

- Empty displayed name → block save, show "请输入显示名称"
- Supabase error → show error text inside panel, keep panel open
- Success → close panel, update header instantly from local state (no refetch needed)
