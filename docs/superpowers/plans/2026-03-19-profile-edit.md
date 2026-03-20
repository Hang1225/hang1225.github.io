# Profile Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users see their gender and MBTI in the dashboard header and edit their displayed name, gender, and MBTI by clicking an avatar.

**Architecture:** All changes in `openbar.html` only. The dashboard header gains an avatar circle + badges. A hidden `#profile-edit-panel` card is inserted below the rule div and toggled on avatar click. Separate JS functions (`profileMbtiGoSlide`, `profileMbtiPick`, `profileSelectGender`, etc.) manage profile-panel state independently from the signup form functions, all exposed to `window` to match the existing inline-onclick pattern.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS client (already imported), existing CSS classes reused.

---

## File Map

- **Modify:** `openbar.html`
  - CSS block (lines ~8–414): add avatar, edit-hint, and profile panel styles
  - HTML dashboard-header (lines ~597–603): replace greeting with avatar + badges layout
  - HTML dashboard body (after rule div, line ~605): insert `#profile-edit-panel`
  - JS block (lines ~629–1386): add profile functions, update `showDashboard`

---

### Task 1: CSS — Avatar, Edit-Hint, Profile Panel Card

**Files:**
- Modify: `openbar.html` — `<style>` block inside `<head>` (before `</style>` at line ~414)

- [ ] **Step 1: Add avatar + panel CSS**

Find the line `  </style>` that closes the inline `<head>` style block (around line 414) and insert immediately before it:

```css
/* ── PROFILE: Avatar ── */
.profile-avatar {
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid var(--gold-dim);
  background: var(--surface-2);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif; font-size: 0.72rem; color: var(--gold);
  cursor: pointer; flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(201,168,76,0.06);
  position: relative;
  transition: box-shadow 0.2s;
}
.profile-avatar:hover { box-shadow: 0 0 0 4px rgba(201,168,76,0.12); }
.profile-avatar-pencil {
  position: absolute; bottom: -3px; right: -3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--surface-2); border: 1px solid var(--gold-dim);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: var(--gold);
}
.profile-edit-hint {
  font-family: 'Cinzel', serif;
  font-size: 0.45rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 0.22rem;
  text-align: center;
}
.profile-header-left { display: flex; gap: 0.8rem; align-items: flex-start; }
.profile-header-badges { display: flex; gap: 0.3rem; margin-top: 0.3rem; flex-wrap: wrap; }

/* ── PROFILE: Edit panel ── */
#profile-edit-panel {
  border-color: var(--gold-dim) !important;
  margin-bottom: 1rem;
  animation: fadeUp 0.22s ease both;
}
#profile-save-status { font-size: 0.85rem; min-height: 1.2em; margin-bottom: 0.5rem; }
#profile-save-status.error { color: var(--red); }
#profile-save-status.success { color: var(--green); }
```

- [ ] **Step 2: Verify**

Open `openbar.html` in the browser, log in. The dashboard should look unchanged (no new elements visible yet — we haven't touched HTML). No console errors.

---

### Task 2: HTML — Replace Dashboard Header

**Files:**
- Modify: `openbar.html` — dashboard-header div (lines ~597–603)

- [ ] **Step 1: Replace the existing dashboard-header block**

Find and replace:
```html
        <div class="dashboard-header fade-in">
          <div>
            <span class="eyebrow" data-zh="欢迎回来" data-en="Welcome Back">欢迎回来</span>
            <h1 class="dashboard-name" id="greeting"></h1>
          </div>
          <button class="btn btn-sm" id="logout-btn" data-zh="退出" data-en="Sign Out">退出</button>
        </div>
```

With:
```html
        <div class="dashboard-header fade-in">
          <div class="profile-header-left">
            <div style="display:flex;flex-direction:column;align-items:center">
              <div class="profile-avatar" id="profile-avatar-btn" onclick="toggleProfilePanel()">
                <span id="profile-initials"></span>
                <div class="profile-avatar-pencil">✎</div>
              </div>
              <div class="profile-edit-hint" data-zh="编辑资料" data-en="Edit Profile">编辑资料</div>
            </div>
            <div>
              <span class="eyebrow" data-zh="欢迎回来" data-en="Welcome Back">欢迎回来</span>
              <h1 class="dashboard-name" id="greeting"></h1>
              <div class="profile-header-badges" id="profile-badges"></div>
            </div>
          </div>
          <button class="btn btn-sm" id="logout-btn" data-zh="退出" data-en="Sign Out">退出</button>
        </div>
```

- [ ] **Step 2: Verify**

Log in. Header shows avatar circle (empty initials for now), pencil, "编辑资料" hint, name, and an empty badges area. Clicking the avatar does nothing yet (no JS). No console errors.

---

### Task 3: HTML — Add Profile Edit Panel

**Files:**
- Modify: `openbar.html` — after `<div class="rule"><span>◆</span></div>` and before `<div class="card fade-in-2" id="events-dashboard-card">`

- [ ] **Step 1: Insert the profile edit panel**

Find:
```html
        <div class="rule"><span>◆</span></div>

        <div class="card fade-in-2" id="events-dashboard-card">
```

Replace with:
```html
        <div class="rule"><span>◆</span></div>

        <!-- PROFILE EDIT PANEL -->
        <div class="card" id="profile-edit-panel" style="display:none">
          <span class="signup-field-label" data-zh="显示名称" data-en="Display Name">显示名称</span>
          <input type="text" id="profile-alias"
            data-placeholder-zh="显示名称" data-placeholder-en="Display name"
            placeholder="显示名称" autocomplete="off" style="margin-bottom:0.9rem">

          <input type="hidden" id="profile-gender-val">
          <span class="signup-field-label" data-zh="性别（可选）" data-en="Gender (optional)">性别（可选）</span>
          <div class="gender-pills" id="profile-gender-pills">
            <button type="button" class="gender-pill" data-value="male" data-zh="男" data-en="Male" onclick="profileSelectGender(this)">男</button>
            <button type="button" class="gender-pill" data-value="female" data-zh="女" data-en="Female" onclick="profileSelectGender(this)">女</button>
            <button type="button" class="gender-pill" data-value="non-binary" data-zh="非二元" data-en="Non-binary" onclick="profileSelectGender(this)">非二元</button>
            <button type="button" class="gender-pill" data-value="prefer-not" data-zh="不透露" data-en="Private" onclick="profileSelectGender(this)">不透露</button>
          </div>

          <input type="hidden" id="profile-mbti-val">
          <span class="signup-field-label" data-zh="MBTI（可选）" data-en="MBTI (optional)">MBTI（可选）</span>
          <div class="mbti-signup-tabs" id="profile-mbti-tabs">
            <button type="button" class="mbti-signup-tab ta active" data-zh="分析家" data-en="Analysts" onclick="profileMbtiGoSlide(0)">分析家</button>
            <button type="button" class="mbti-signup-tab td" data-zh="外交家" data-en="Diplomats" onclick="profileMbtiGoSlide(1)">外交家</button>
            <button type="button" class="mbti-signup-tab ts" data-zh="守卫者" data-en="Sentinels" onclick="profileMbtiGoSlide(2)">守卫者</button>
            <button type="button" class="mbti-signup-tab te" data-zh="探险家" data-en="Explorers" onclick="profileMbtiGoSlide(3)">探险家</button>
          </div>
          <div class="mbti-carousel-wrap" id="profile-mbti-carousel">
            <div class="mbti-carousel-track" id="profile-mbti-track">

              <!-- Analysts (blue) -->
              <div class="mbti-carousel-slide" style="--mbti-gr:122,160,216">
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'INTJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="11" r="9" fill="#7AA0D8" opacity="0.92"/><rect x="17" y="9" width="6" height="4" rx="1" fill="none" stroke="#0D0D1A" stroke-width="1.2" opacity="0.55"/><rect x="27" y="9" width="6" height="4" rx="1" fill="none" stroke="#0D0D1A" stroke-width="1.2" opacity="0.55"/><line x1="23" y1="11" x2="27" y2="11" stroke="#0D0D1A" stroke-width="1" opacity="0.5"/><line x1="21" y1="16" x2="29" y2="16" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/><path d="M11 22 L39 22 L35 56 L15 56 Z" fill="#7AA0D8" opacity="0.78"/><path d="M13 34 L37 34 L35 56 L15 56 Z" fill="#7AA0D8" opacity="0.3"/><rect x="19" y="36" width="10" height="10" rx="2" fill="rgba(200,230,255,0.25)" stroke="rgba(200,230,255,0.6)" stroke-width="0.9" transform="rotate(8 24 41)"/><rect x="3" y="24" width="8" height="20" rx="4" fill="#7AA0D8" opacity="0.65" transform="rotate(-6 7 34)"/><rect x="39" y="24" width="8" height="20" rx="4" fill="#7AA0D8" opacity="0.65" transform="rotate(6 43 34)"/><rect x="15" y="56" width="8" height="13" rx="4" fill="#7AA0D8" opacity="0.6"/><rect x="27" y="56" width="8" height="13" rx="4" fill="#7AA0D8" opacity="0.6"/><path d="M16 22 Q12 18 10 14 Q14 12 18 16 Q20 19 16 22Z" fill="#E2C870" opacity="0.7"/></svg>
                  <div class="mbti-char-name">INTJ</div><div class="mbti-char-sub">Negroni</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'INTP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="11" r="9" fill="#7AA0D8" opacity="0.88"/><circle cx="21" cy="10" r="2.2" fill="#0D0D1A" opacity="0.5"/><circle cx="29" cy="10" r="2.2" fill="#0D0D1A" opacity="0.5"/><circle cx="21.6" cy="9.4" r="0.8" fill="white" opacity="0.5"/><circle cx="29.6" cy="9.4" r="0.8" fill="white" opacity="0.5"/><path d="M21 16 Q25 19 29 16" stroke="#0D0D1A" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.3"/><path d="M12 22 L38 22 L34 56 L16 56 Z" fill="#7AA0D8" opacity="0.72"/><path d="M14 33 L36 33 L34 56 L16 56 Z" fill="#7AA0D8" opacity="0.28"/><rect x="16" y="35" width="13" height="13" rx="2.5" fill="rgba(200,230,255,0.2)" stroke="rgba(200,230,255,0.55)" stroke-width="0.9" transform="rotate(-6 22 41)"/><circle cx="32" cy="30" r="3" fill="rgba(192,96,96,0.6)" stroke="#C06060" stroke-width="0.8"/><rect x="2" y="12" width="8" height="20" rx="4" fill="#7AA0D8" opacity="0.62" transform="rotate(25 6 22)"/><rect x="40" y="26" width="8" height="18" rx="4" fill="#7AA0D8" opacity="0.58" transform="rotate(5 44 35)"/><rect x="16" y="56" width="8" height="13" rx="4" fill="#7AA0D8" opacity="0.58"/><rect x="28" y="56" width="8" height="13" rx="4" fill="#7AA0D8" opacity="0.58"/></svg>
                  <div class="mbti-char-name">INTP</div><div class="mbti-char-sub">Old Fashioned</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ENTJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><path d="M18 4 L20 9 L25 6 L30 9 L32 4 L34 9 L16 9 Z" fill="#E2C870" opacity="0.75"/><circle cx="25" cy="16" r="10" fill="#7AA0D8" opacity="0.95"/><line x1="18" y1="13" x2="23" y2="14.5" stroke="#0D0D1A" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/><line x1="32" y1="13" x2="27" y2="14.5" stroke="#0D0D1A" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/><path d="M19 20 Q25 24 31 20" stroke="#0D0D1A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M4 28 L46 28 L25 56 Z" fill="#7AA0D8" opacity="0.8"/><path d="M8 34 L42 34 L25 56 Z" fill="#7AA0D8" opacity="0.3"/><ellipse cx="25" cy="28" rx="4" ry="2.5" fill="rgba(90,144,104,0.55)" stroke="#5A9068" stroke-width="0.9"/><line x1="25" y1="56" x2="25" y2="64" stroke="#7AA0D8" stroke-width="2" opacity="0.65"/><ellipse cx="25" cy="64" rx="10" ry="2.5" fill="#7AA0D8" opacity="0.35"/><rect x="-4" y="30" width="14" height="7" rx="3.5" fill="#7AA0D8" opacity="0.68" transform="rotate(-8 3 33)"/><rect x="40" y="30" width="14" height="7" rx="3.5" fill="#7AA0D8" opacity="0.68" transform="rotate(8 47 33)"/></svg>
                  <div class="mbti-char-name">ENTJ</div><div class="mbti-char-sub">Martini</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ENTP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><path d="M15 6 Q25 1 35 6 Q33 12 25 13 Q17 12 15 6Z" fill="rgba(90,144,104,0.55)" stroke="#5A9068" stroke-width="0.9"/><line x1="15" y1="6" x2="35" y2="6" stroke="#5A9068" stroke-width="0.7" opacity="0.5"/><line x1="25" y1="3" x2="25" y2="13" stroke="#5A9068" stroke-width="0.5" opacity="0.4"/><circle cx="25" cy="19" r="9" fill="#7AA0D8" opacity="0.88"/><path d="M19 21 Q25 26 31 21" stroke="#0D0D1A" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M19 16 Q21 14 23 16" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.45"/><path d="M27 16 Q29 14 31 16" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.45"/><path d="M14 30 L36 30 L37 60 L13 60 Z" fill="#7AA0D8" opacity="0.72"/><rect x="37" y="32" width="14" height="7" rx="3.5" fill="#7AA0D8" opacity="0.65" transform="rotate(-15 44 35)"/><rect x="1" y="34" width="13" height="7" rx="3.5" fill="#7AA0D8" opacity="0.55" transform="rotate(10 7 37)"/><rect x="15" y="60" width="8" height="9" rx="4" fill="#7AA0D8" opacity="0.58"/><rect x="27" y="60" width="8" height="9" rx="4" fill="#7AA0D8" opacity="0.58"/></svg>
                  <div class="mbti-char-name">ENTP</div><div class="mbti-char-sub">Gin &amp; Tonic</div>
                </button>
              </div>

              <!-- Diplomats (purple) -->
              <div class="mbti-carousel-slide" style="--mbti-gr:168,136,208">
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'INFJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="34" cy="6" r="3.5" fill="rgba(168,136,208,0.5)" stroke="#A888D0" stroke-width="0.9"/><circle cx="34" cy="6" r="1.5" fill="rgba(168,136,208,0.8)"/><line x1="34" y1="9" x2="33" y2="14" stroke="rgba(90,144,104,0.6)" stroke-width="0.9"/><circle cx="25" cy="14" r="9" fill="#A888D0" opacity="0.9"/><path d="M19 13 Q21 11 23 13" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M27 13 Q29 11 31 13" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M21 18 Q25 21 29 18" stroke="#0D0D1A" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.28"/><path d="M19 24 L31 24 L28 58 L22 58 Z" fill="#A888D0" opacity="0.75"/><path d="M19.5 32 L30.5 32 L28 58 L22 58 Z" fill="#A888D0" opacity="0.28"/><ellipse cx="25" cy="58" rx="10" ry="2.5" fill="#A888D0" opacity="0.3"/><line x1="25" y1="58" x2="25" y2="64" stroke="#A888D0" stroke-width="1.5" opacity="0.5"/><path d="M19 28 Q10 24 5 28 Q8 34 13 32 Q16 30 19 32" fill="#A888D0" opacity="0.52"/><path d="M31 28 Q40 24 45 28 Q42 34 37 32 Q34 30 31 32" fill="#A888D0" opacity="0.52"/></svg>
                  <div class="mbti-char-name">INFJ</div><div class="mbti-char-sub">Lavender Fizz</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'INFP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="24" cy="14" r="9" fill="#A888D0" opacity="0.87"/><path d="M18 13 Q20 11.5 22 13 Q20 14.5 18 13Z" fill="#0D0D1A" opacity="0.35"/><path d="M26 13 Q28 11.5 30 13 Q28 14.5 26 13Z" fill="#0D0D1A" opacity="0.35"/><path d="M20 18 Q24 21 28 18" stroke="#0D0D1A" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.28"/><path d="M11 24 L39 24 L34 46 L16 46 Z" fill="#A888D0" opacity="0.72"/><line x1="25" y1="46" x2="25" y2="58" stroke="#A888D0" stroke-width="2" opacity="0.55"/><ellipse cx="25" cy="58" rx="10" ry="2.5" fill="#A888D0" opacity="0.28"/><path d="M11 26 Q5 30 4 36 Q8 38 12 34 Q12 31 11 26Z" fill="#A888D0" opacity="0.55"/><path d="M39 26 Q43 22 45 24 Q46 30 42 34 Q40 32 39 26Z" fill="#A888D0" opacity="0.5"/></svg>
                  <div class="mbti-char-name">INFP</div><div class="mbti-char-sub">Violet Lemonade</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ENFJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="13" r="10" fill="#A888D0" opacity="0.95"/><path d="M18 18 Q25 24 32 18" stroke="#0D0D1A" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.38"/><path d="M18 11 Q20 9 22 11" stroke="#0D0D1A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M28 11 Q30 9 32 11" stroke="#0D0D1A" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M17 24 L33 24 L30 56 L20 56 Z" fill="#A888D0" opacity="0.78"/><rect x="-3" y="27" width="20" height="7" rx="3.5" fill="#A888D0" opacity="0.65" transform="rotate(-15 7 30)"/><rect x="33" y="27" width="20" height="7" rx="3.5" fill="#A888D0" opacity="0.65" transform="rotate(15 43 30)"/></svg>
                  <div class="mbti-char-name">ENFJ</div><div class="mbti-char-sub">French 75</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ENFP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="24" cy="15" r="9.5" fill="#A888D0" opacity="0.9"/><path d="M17 19 Q24 26 31 19" stroke="#0D0D1A" stroke-width="1.7" stroke-linecap="round" fill="none" opacity="0.4"/><circle cx="20" cy="13" r="2.5" fill="#0D0D1A" opacity="0.45"/><circle cx="28" cy="13" r="2.5" fill="#0D0D1A" opacity="0.45"/><path d="M8 26 L42 26 L36 50 L14 50 Z" fill="#A888D0" opacity="0.74"/><line x1="25" y1="50" x2="25" y2="60" stroke="#A888D0" stroke-width="2" opacity="0.52"/><ellipse cx="25" cy="60" rx="10" ry="2.5" fill="#A888D0" opacity="0.26"/><rect x="-5" y="18" width="18" height="7" rx="3.5" fill="#A888D0" opacity="0.62" transform="rotate(-35 4 21)"/><rect x="37" y="18" width="18" height="7" rx="3.5" fill="#A888D0" opacity="0.62" transform="rotate(35 46 21)"/></svg>
                  <div class="mbti-char-name">ENFP</div><div class="mbti-char-sub">Aperol Spritz</div>
                </button>
              </div>

              <!-- Sentinels (green) -->
              <div class="mbti-carousel-slide" style="--mbti-gr:90,144,104">
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ISTJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="12" r="9" fill="#5A9068" opacity="0.92"/><line x1="20" y1="11" x2="22" y2="11" stroke="#0D0D1A" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/><line x1="28" y1="11" x2="30" y2="11" stroke="#0D0D1A" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/><path d="M9 22 L41 22 L39 54 L11 54 Z" fill="#5A9068" opacity="0.8"/><rect x="1" y="24" width="8" height="22" rx="4" fill="#5A9068" opacity="0.62"/><rect x="41" y="24" width="8" height="22" rx="4" fill="#5A9068" opacity="0.62"/><rect x="15" y="54" width="8" height="14" rx="4" fill="#5A9068" opacity="0.58"/><rect x="27" y="54" width="8" height="14" rx="4" fill="#5A9068" opacity="0.58"/></svg>
                  <div class="mbti-char-name">ISTJ</div><div class="mbti-char-sub">Whiskey Neat</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ISFJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="14" r="9" fill="#5A9068" opacity="0.88"/><path d="M20 18 Q25 22 30 18" stroke="#0D0D1A" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="0.35"/><rect x="13" y="24" width="24" height="30" rx="3" fill="#5A9068" opacity="0.76"/><path d="M37 28 Q46 28 46 38 Q46 48 37 48" stroke="#5A9068" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.65"/><rect x="2" y="26" width="11" height="18" rx="4" fill="#5A9068" opacity="0.58" transform="rotate(10 7 35)"/><rect x="16" y="54" width="8" height="14" rx="4" fill="#5A9068" opacity="0.56"/><rect x="27" y="54" width="8" height="14" rx="4" fill="#5A9068" opacity="0.56"/></svg>
                  <div class="mbti-char-name">ISFJ</div><div class="mbti-char-sub">Hot Toddy</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ESTJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="13" r="9.5" fill="#5A9068" opacity="0.95"/><line x1="17" y1="10" x2="22" y2="11.5" stroke="#0D0D1A" stroke-width="2" stroke-linecap="round" opacity="0.55"/><line x1="33" y1="10" x2="28" y2="11.5" stroke="#0D0D1A" stroke-width="2" stroke-linecap="round" opacity="0.55"/><path d="M6 26 L44 26 L36 50 L14 50 Z" fill="#5A9068" opacity="0.8"/><line x1="25" y1="50" x2="25" y2="60" stroke="#5A9068" stroke-width="2" opacity="0.58"/><ellipse cx="25" cy="60" rx="9" ry="2" fill="#5A9068" opacity="0.28"/><rect x="3" y="28" width="20" height="7" rx="3.5" fill="#5A9068" opacity="0.65" transform="rotate(-5 13 31)"/><rect x="27" y="28" width="20" height="7" rx="3.5" fill="#5A9068" opacity="0.65" transform="rotate(5 37 31)"/></svg>
                  <div class="mbti-char-name">ESTJ</div><div class="mbti-char-sub">Manhattan</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ESFJ')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><ellipse cx="18" cy="7" rx="5" ry="3" fill="rgba(90,144,104,0.55)" stroke="#5A9068" stroke-width="0.8" transform="rotate(-20 18 7)"/><ellipse cx="25" cy="5" rx="5" ry="3" fill="rgba(90,144,104,0.6)" stroke="#5A9068" stroke-width="0.8"/><ellipse cx="32" cy="7" rx="5" ry="3" fill="rgba(90,144,104,0.55)" stroke="#5A9068" stroke-width="0.8" transform="rotate(20 32 7)"/><circle cx="25" cy="16" r="9" fill="#5A9068" opacity="0.9"/><path d="M19 20 Q25 25 31 20" stroke="#0D0D1A" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.38"/><path d="M13 26 L37 26 L38 58 L12 58 Z" fill="#5A9068" opacity="0.74"/><rect x="-2" y="28" width="15" height="7" rx="3.5" fill="#5A9068" opacity="0.64" transform="rotate(-12 5 31)"/><rect x="37" y="28" width="15" height="7" rx="3.5" fill="#5A9068" opacity="0.64" transform="rotate(12 45 31)"/><rect x="14" y="58" width="8" height="11" rx="4" fill="#5A9068" opacity="0.56"/><rect x="28" y="58" width="8" height="11" rx="4" fill="#5A9068" opacity="0.56"/></svg>
                  <div class="mbti-char-name">ESFJ</div><div class="mbti-char-sub">Mojito</div>
                </button>
              </div>

              <!-- Explorers (gold) -->
              <div class="mbti-carousel-slide" style="--mbti-gr:201,168,76">
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ISTP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="24" cy="13" r="9" fill="#C9A84C" opacity="0.88"/><line x1="18" y1="11" x2="23" y2="12" stroke="#0D0D1A" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/><line x1="30" y1="11" x2="25" y2="12" stroke="#0D0D1A" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/><path d="M10 22 L38 22 L35 54 L13 54 Z" fill="#C9A84C" opacity="0.78" transform="rotate(-3 24 38)"/><rect x="38" y="22" width="12" height="6" rx="3" fill="#C9A84C" opacity="0.62" transform="rotate(-20 44 25)"/><rect x="2" y="28" width="9" height="16" rx="4" fill="#C9A84C" opacity="0.52" transform="rotate(15 6 36)"/><rect x="14" y="54" width="8" height="14" rx="4" fill="#C9A84C" opacity="0.58"/><rect x="26" y="54" width="8" height="14" rx="4" fill="#C9A84C" opacity="0.58" transform="rotate(6 30 61)"/></svg>
                  <div class="mbti-char-name">ISTP</div><div class="mbti-char-sub">Mezcal Sour</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ISFP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="34" cy="7" r="5" fill="rgba(192,96,96,0.35)" stroke="rgba(192,96,96,0.6)" stroke-width="0.9"/><circle cx="34" cy="7" r="2.2" fill="rgba(201,168,76,0.6)"/><circle cx="24" cy="15" r="9" fill="#C9A84C" opacity="0.87"/><path d="M19 19 Q24 23 29 19" stroke="#0D0D1A" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.32"/><path d="M8 25 L40 25 L36 54 L12 54 Z" fill="#C9A84C" opacity="0.72"/><path d="M8 28 Q2 25 0 30 Q2 36 8 34 Q9 31 8 28Z" fill="#C9A84C" opacity="0.55"/><path d="M40 28 Q46 24 48 28 Q47 34 42 35 Q40 32 40 28Z" fill="#C9A84C" opacity="0.52"/><rect x="14" y="54" width="8" height="14" rx="4" fill="#C9A84C" opacity="0.55"/><rect x="27" y="54" width="8" height="14" rx="4" fill="#C9A84C" opacity="0.55"/></svg>
                  <div class="mbti-char-name">ISFP</div><div class="mbti-char-sub">Rum Punch</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ESTP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="13" r="9.5" fill="#C9A84C" opacity="0.93"/><path d="M17 18 Q25 26 33 18" stroke="#0D0D1A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.42"/><circle cx="20" cy="11" r="2.8" fill="#0D0D1A" opacity="0.48"/><circle cx="30" cy="11" r="2.8" fill="#0D0D1A" opacity="0.48"/><path d="M13 24 L37 24 L35 46 L15 46 Z" fill="#C9A84C" opacity="0.8"/><rect x="-6" y="24" width="19" height="7" rx="3.5" fill="#C9A84C" opacity="0.68" transform="rotate(-20 3 27)"/><rect x="37" y="24" width="19" height="7" rx="3.5" fill="#C9A84C" opacity="0.68" transform="rotate(20 47 27)"/><rect x="12" y="46" width="8" height="22" rx="4" fill="#C9A84C" opacity="0.62" transform="rotate(-8 16 57)"/><rect x="30" y="46" width="8" height="22" rx="4" fill="#C9A84C" opacity="0.62" transform="rotate(8 34 57)"/></svg>
                  <div class="mbti-char-name">ESTP</div><div class="mbti-char-sub">Tequila Shot</div>
                </button>
                <button type="button" class="mbti-char-card profile-char-card" onclick="profileMbtiPick(this,'ESFP')">
                  <svg width="46" height="64" viewBox="0 0 50 70" fill="none"><circle cx="25" cy="15" r="9.5" fill="#C9A84C" opacity="0.92"/><path d="M17 19 Q25 27 33 19" stroke="#0D0D1A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.4"/><circle cx="20" cy="12" r="2.5" fill="#0D0D1A" opacity="0.48"/><circle cx="30" cy="12" r="2.5" fill="#0D0D1A" opacity="0.48"/><path d="M17 26 L33 26 L30 58 L20 58 Z" fill="#C9A84C" opacity="0.76"/><line x1="25" y1="58" x2="25" y2="65" stroke="#C9A84C" stroke-width="1.5" opacity="0.52"/><ellipse cx="25" cy="65" rx="8" ry="2" fill="#C9A84C" opacity="0.24"/><rect x="0" y="14" width="17" height="7" rx="3.5" fill="#C9A84C" opacity="0.65" transform="rotate(-45 8 17)"/><rect x="33" y="14" width="17" height="7" rx="3.5" fill="#C9A84C" opacity="0.65" transform="rotate(45 42 17)"/></svg>
                  <div class="mbti-char-name">ESFP</div><div class="mbti-char-sub">Champagne</div>
                </button>
              </div>

            </div><!-- /profile-mbti-track -->
          </div><!-- /profile-mbti-carousel -->
          <div class="mbti-carousel-nav">
            <button type="button" class="mbti-nav-arrow" id="profile-mbti-prev" onclick="profileMbtiPrev()" disabled>← 上一组</button>
            <div class="mbti-nav-dots" id="profile-mbti-dots">
              <div class="mbti-nav-dot active" onclick="profileMbtiGoSlide(0)"></div>
              <div class="mbti-nav-dot" onclick="profileMbtiGoSlide(1)"></div>
              <div class="mbti-nav-dot" onclick="profileMbtiGoSlide(2)"></div>
              <div class="mbti-nav-dot" onclick="profileMbtiGoSlide(3)"></div>
            </div>
            <button type="button" class="mbti-nav-arrow" id="profile-mbti-next" onclick="profileMbtiNext()">下一组 →</button>
          </div>

          <div id="profile-save-status"></div>
          <button type="button" class="btn btn-solid" style="width:100%;margin-top:0.25rem" onclick="saveProfile()" data-zh="保存修改" data-en="Save Changes">保存修改</button>
        </div><!-- /profile-edit-panel -->

        <div class="card fade-in-2" id="events-dashboard-card">
```

- [ ] **Step 2: Verify**

Log in. Dashboard still looks normal — profile panel is hidden (`display:none`). No console errors.

---

### Task 4: JS — Profile MBTI Functions

**Files:**
- Modify: `openbar.html` — JS block, immediately before the closing `</script>` tag

- [ ] **Step 1: Add profile MBTI state and functions**

Immediately before `</script>` add:

```js
    // ── Profile panel: MBTI carousel ──────────────────────────────────────────
    let profileMbtiCur = 0
    const profileMbtiColors = ['122,160,216','168,136,208','90,144,104','201,168,76']

    function profileMbtiGoSlide(idx) {
      profileMbtiCur = idx
      const track = document.getElementById('profile-mbti-track')
      const wrap  = document.getElementById('profile-mbti-carousel')
      if (track) track.style.transform = `translateX(${-idx * 100}%)`
      if (wrap)  wrap.style.setProperty('--mbti-gr', profileMbtiColors[idx])
      document.querySelectorAll('#profile-mbti-tabs .mbti-signup-tab').forEach((t,i) => t.classList.toggle('active', i === idx))
      document.querySelectorAll('#profile-mbti-dots .mbti-nav-dot').forEach((d,i) => d.classList.toggle('active', i === idx))
      const prev = document.getElementById('profile-mbti-prev')
      const next = document.getElementById('profile-mbti-next')
      if (prev) prev.disabled = idx === 0
      if (next) next.disabled = idx === 3
    }

    function profileMbtiPick(el, type) {
      document.querySelectorAll('.profile-char-card').forEach(c => c.classList.remove('sel'))
      el.classList.add('sel')
      document.getElementById('profile-mbti-val').value = type
    }

    function profileMbtiPrev() { if (profileMbtiCur > 0) profileMbtiGoSlide(profileMbtiCur - 1) }
    function profileMbtiNext() { if (profileMbtiCur < 3) profileMbtiGoSlide(profileMbtiCur + 1) }

    window.profileMbtiGoSlide = profileMbtiGoSlide
    window.profileMbtiPick    = profileMbtiPick
    window.profileMbtiPrev    = profileMbtiPrev
    window.profileMbtiNext    = profileMbtiNext
```

- [ ] **Step 2: Verify**

Open browser console while logged in. Run:
```js
profileMbtiGoSlide(2)  // should not throw
```
No error. (Panel still hidden so no visual change yet.)

---

### Task 5: JS — Profile Gender Function

**Files:**
- Modify: `openbar.html` — JS block, immediately before `</script>`

- [ ] **Step 1: Add profileSelectGender**

Immediately before `</script>` add:

```js
    // ── Profile panel: Gender pills ───────────────────────────────────────────
    function profileSelectGender(el) {
      document.querySelectorAll('#profile-gender-pills .gender-pill').forEach(b => b.classList.remove('active'))
      el.classList.add('active')
      document.getElementById('profile-gender-val').value = el.dataset.value
    }
    window.profileSelectGender = profileSelectGender
```

- [ ] **Step 2: Verify**

No console errors on page load.

---

### Task 6: JS — Panel Toggle + Pre-populate on Open

**Files:**
- Modify: `openbar.html` — JS block, immediately before `</script>`

The MBTI type → group index map:
- Group 0 (Analysts): INTJ, INTP, ENTJ, ENTP
- Group 1 (Diplomats): INFJ, INFP, ENFJ, ENFP
- Group 2 (Sentinels): ISTJ, ISFJ, ESTJ, ESFJ
- Group 3 (Explorers): ISTP, ISFP, ESTP, ESFP

- [ ] **Step 1: Add toggle/open/close functions**

Immediately before `</script>` add:

```js
    // ── Profile panel: Toggle ─────────────────────────────────────────────────
    const mbtiGroupMap = {
      INTJ:0,INTP:0,ENTJ:0,ENTP:0,
      INFJ:1,INFP:1,ENFJ:1,ENFP:1,
      ISTJ:2,ISFJ:2,ESTJ:2,ESFJ:2,
      ISTP:3,ISFP:3,ESTP:3,ESFP:3
    }

    function openProfilePanel() {
      const panel = document.getElementById('profile-edit-panel')
      const st    = document.getElementById('profile-save-status')
      if (st) st.textContent = ''

      // Pre-fill alias
      document.getElementById('profile-alias').value = currentAttendee.alias || currentAttendee.username || ''

      // Pre-select gender
      document.querySelectorAll('#profile-gender-pills .gender-pill').forEach(b => b.classList.remove('active'))
      if (currentAttendee.gender) {
        const gBtn = document.querySelector(`#profile-gender-pills [data-value="${currentAttendee.gender}"]`)
        if (gBtn) { gBtn.classList.add('active'); document.getElementById('profile-gender-val').value = currentAttendee.gender }
      } else {
        document.getElementById('profile-gender-val').value = ''
      }

      // Pre-select MBTI
      document.querySelectorAll('.profile-char-card').forEach(c => c.classList.remove('sel'))
      document.getElementById('profile-mbti-val').value = currentAttendee.mbti || ''
      if (currentAttendee.mbti) {
        const groupIdx = mbtiGroupMap[currentAttendee.mbti] ?? 0
        profileMbtiGoSlide(groupIdx)
        const card = document.querySelector(`.profile-char-card[onclick="profileMbtiPick(this,'${currentAttendee.mbti}')"]`)
        if (card) card.classList.add('sel')
      } else {
        profileMbtiGoSlide(0)
      }

      panel.style.display = 'block'
    }

    function closeProfilePanel() {
      document.getElementById('profile-edit-panel').style.display = 'none'
    }

    function toggleProfilePanel() {
      const panel = document.getElementById('profile-edit-panel')
      if (panel.style.display === 'none' || panel.style.display === '') {
        openProfilePanel()
      } else {
        closeProfilePanel()
      }
    }
    window.toggleProfilePanel = toggleProfilePanel
```

- [ ] **Step 2: Verify**

Log in. Click the avatar. The profile edit panel appears, pre-filled with your name. Gender + MBTI pre-selected to match your account. Click avatar again → panel closes.

---

### Task 7: JS — saveProfile

**Files:**
- Modify: `openbar.html` — JS block, immediately before `</script>`

- [ ] **Step 1: Add saveProfile function**

Immediately before `</script>` add:

```js
    // ── Profile panel: Save ───────────────────────────────────────────────────
    async function saveProfile() {
      const alias  = document.getElementById('profile-alias').value.trim()
      const gender = document.getElementById('profile-gender-val').value || null
      const mbti   = document.getElementById('profile-mbti-val').value   || null
      const status = document.getElementById('profile-save-status')

      if (!alias) {
        status.textContent = t('请输入显示名称', 'Please enter a display name')
        status.className   = 'error'
        return
      }

      const gender_visibility = (gender && gender !== 'prefer-not') ? 'public' : 'admin_only'

      const { error } = await supabase
        .from('attendees')
        .update({ alias, gender, mbti, gender_visibility })
        .eq('id', currentAttendee.id)

      if (error) {
        status.textContent = t('保存失败，请重试', 'Save failed, please try again')
        status.className   = 'error'
        return
      }

      // Update in-memory attendee + refresh header
      currentAttendee = { ...currentAttendee, alias, gender, mbti, gender_visibility }
      refreshProfileHeader()
      status.textContent = t('已保存', 'Saved')
      status.className   = 'success'
      setTimeout(closeProfilePanel, 900)
    }
    window.saveProfile = saveProfile
```

- [ ] **Step 2: Verify save flow**

Log in. Open panel. Change display name. Click 保存修改. Header name updates, panel closes after ~1 second. Reload page — changes persist (Supabase was updated).

---

### Task 8: JS — showDashboard + refreshProfileHeader

**Files:**
- Modify: `openbar.html` — `showDashboard` function (~line 1305)

- [ ] **Step 1: Add refreshProfileHeader helper**

Add this function immediately before `showDashboard`:

```js
    function refreshProfileHeader() {
      const name    = currentAttendee.alias || currentAttendee.username || ''
      const initials = name.charAt(0).toUpperCase()
      document.getElementById('profile-initials').textContent = initials
      document.getElementById('greeting').textContent = name

      // Badges
      const badgeEl = document.getElementById('profile-badges')
      if (!badgeEl) return
      const gMap = { male:'<span class="g-badge g-m">M</span>', female:'<span class="g-badge g-f">F</span>', 'non-binary':'<span class="g-badge g-nb">NB</span>', 'prefer-not':'<span class="g-badge g-hidden">—</span>' }
      const gBadge = currentAttendee.gender ? (gMap[currentAttendee.gender] || '') : ''
      const mBadge = currentAttendee.mbti   ? `<span class="g-badge g-mbti">${escapeHtml(currentAttendee.mbti)}</span>` : ''
      badgeEl.innerHTML = gBadge + mBadge
    }
```

- [ ] **Step 2: Update showDashboard to call refreshProfileHeader**

Find inside `showDashboard`:
```js
      document.getElementById('greeting').textContent = attendee.alias || attendee.username
```

Replace with:
```js
      refreshProfileHeader()
```

- [ ] **Step 3: Verify**

Log in. Avatar shows your initial. Badges show your gender and MBTI (if set). Greeting shows alias or username. All correct.

---

### Task 9: Commit

- [ ] **Step 1: Final visual check**

- Avatar circle shows initials with pencil icon
- "编辑资料" label visible below avatar at 0.45rem
- Gender + MBTI badges appear if values are set
- Clicking avatar opens edit panel
- Panel pre-fills name, gender pill, and MBTI card
- Tabs and carousel work (swipe, arrows, dots)
- Save updates header and closes panel
- Clicking avatar again (without saving) silently closes panel
- Empty name shows error, panel stays open
- Supabase error shows inline error message

- [ ] **Step 2: Commit**

```bash
git add openbar.html
git commit -m "feat: add profile view and edit (avatar, badges, edit panel)"
```

- [ ] **Step 3: Push**

```bash
git push
```
