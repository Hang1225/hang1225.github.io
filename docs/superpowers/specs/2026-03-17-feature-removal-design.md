# Feature Removal Design: Gallery, Credits, Orders

**Date:** 2026-03-17
**Approach:** Hard Delete (Option A)

---

## Scope

Remove three features from the ERSHU.25 website:
1. **Gallery page** — photo upload and display
2. **Credit system** — attendee credit balance and earning
3. **Order system** — drink ordering and order history

The Open Bar page is retained but scoped down to Login/Sign Up and Wishlist only.

---

## Files to Delete Entirely

| File | Reason |
|------|--------|
| `gallery.html` | Gallery page removed |
| `js/gallery.js` | Gallery logic removed |

Note: `js/menu.js` is **not** deleted — it is still used by `menu.html`. Only its `loadDrinks` import in `openbar.html` is removed.

---

## Navigation & Home Page

### `js/nav.js`
- Remove: Gallery link entry

### `home.html`
- Remove: Gallery feature card
- Keep: Open Bar feature card, with updated copy:
  - Eyebrow: change from `data-en="Credits" data-zh="积分"` → `data-en="Open Bar" data-zh="Open Bar"`
  - Description: change from `data-en="Bring a bottle, order a drink" data-zh="带瓶酒，换一杯"` → `data-en="Browse the wishlist and sign in to your account" data-zh="查看愿望单，登录账户"`
- The hero CTA button (`<a href="/openbar.html">Open Bar</a>`) is intentionally left as-is

---

## Open Bar Page (`openbar.html`)

### HTML Sections to Remove
- Credits display section, including the `<span class="badge" id="credits-display">` element inside the dashboard header
- The `.dashboard-header` flex layout (`display:flex; justify-content:space-between`) is **kept** — after removing the badge the header still has two children (greeting div and logout button) and flex spacing remains appropriate
- Order a Drink section: remove the entire `<div class="card fade-in-3">` block containing `#order-drink` dropdown and order button
- After removing the Order a Drink card, the grid wrapper (`display:grid; grid-template-columns:repeat(auto-fit,...)`) will contain only the Wishlist card. Remove the grid wrapper and let the Wishlist card render as a standard block element
- Order History section

### CSS to Remove (in `openbar.html` `<style>` block)
- `.order-row` and `.order-row:last-child` rules
- `select { ... }` and `select:focus` rules

### HTML Sections to Keep
- Login interface
- Sign Up interface
- Wishlist section (static HTML kept as-is; the credit badge is rendered dynamically — see JS section below)

### Copy to Update
- Page header eyebrow: change from `data-en="Credits System" data-zh="积分系统"` → `data-en="Open Bar" data-zh="Open Bar"`
- Page subtitle: remove "earn credits, order drinks" — update to reflect wishlist + login only
- Sign Up panel body text: remove "Bring a bottle from the wishlist to earn credits" — update to reflect wishlist browsing purpose

### Inline Script Block Changes
- Remove `loadAttendeeOrders`, `placeOrder`, `refreshAttendeeCredits` from the import of `./js/openbar.js`
- Remove `loadDrinks` import from `./js/menu.js`
- In `showDashboard()`: remove the block that sets `credits-display` and populates the drink dropdown
- In `showDashboard()` wishlist loop: remove the credit badge template literal (renders as `${escapeHtml(String(w.credit_value))} ${t('积分', 'credits')}`)
- Remove the `order-btn` click handler block entirely
- The Sign Up insert statement (`{ username, pin_hash, credits: 0, alias: null }`) is intentionally left as-is — the `credits` column remains in the DB and passing `0` avoids schema errors

---

## `js/openbar.js`

- Remove: `placeOrder()` function
- Remove: `loadAttendeeOrders()` function
- Remove: `refreshAttendeeCredits()` function
- Keep: `loadWishlist()` — the `select('item_name, credit_value')` query is intentionally left as-is; `credit_value` is fetched but not rendered to end users

---

## Admin Panel

### `admin/index.html`
- Remove: Gallery tab entirely (tab button + tab panel)
  - Remove gallery-specific CSS rules: `.pending-photo-card`, `.pending-photo-grid`, and related styles
- Remove: OpenBar tab entirely (tab button + tab panel, including `#attendees-list` div and `#pending-orders` div within it)
- Keep: Signups tab
  - Move the "Add Attendee" form from the OpenBar tab into the Signups tab, stripping the "Starting Credits" (`#new-credits`) input field
  - Remove credits badge and "Add credits" input/button from each attendee row rendered by `loadSignupsAdmin()`
  - Update Signups tab description copy to: "Manage attendee accounts. Add new attendees or view existing sign-ups."
  - **Note:** The `delete-attendee` action is intentionally dropped with the OpenBar tab removal. No delete capability is added to the Signups tab.

### `admin/js/admin-main.js`

**Remove the following in full:**
- `loadPendingPhotos()` + the entire `document.getElementById('pending-photos').addEventListener(...)` block
- `loadPendingOrders()` + the entire `document.getElementById('pending-orders').addEventListener(...)` block (this includes the `approve-order` and `reject-order` handlers)
- `loadAttendeesAdmin()` + the entire `document.getElementById('attendees-list').addEventListener(...)` block (this is a single listener block; remove it entirely — do not attempt partial deletion)
- The entire `document.getElementById('signups-list').addEventListener(...)` block — remove the whole listener block, not just the inner `signup-add-credits` branch. Reason: the only action in this listener is `signup-add-credits`, which is being removed. The listener also calls `loadAttendeesAdmin()` internally; since that function is also deleted, keeping any fragment of this block would produce a ReferenceError.
- `document.getElementById('add-attendee-btn').addEventListener(...)` block — remove entirely; re-add a stripped version without `#new-credits` field processing as part of the Add Attendee form migration to the Signups tab. The replacement handler must call `loadSignupsAdmin()` (not `loadAttendeesAdmin()`) after a successful insert to refresh the attendee list.

**Update `showAdmin()` initialization:**
- Remove calls to `loadPendingPhotos()`, `loadPendingOrders()`, AND `loadAttendeesAdmin()` — all three are being deleted and must be removed from `showAdmin()` to prevent ReferenceErrors on admin load

**Update `loadSignupsAdmin()`:**
- Remove credits badge and "Add credits" input/button from rendered attendee rows
- Keep the rest of the attendee listing

### Wishlist Admin Tab
- Keep as-is, including `credit_value` field

---

## What Is Preserved

- `js/auth.js` — login, signup, session management (still needed for Open Bar)
- Open Bar nav link in `js/nav.js`
- Open Bar feature card on `home.html` (with updated copy)
- Wishlist admin tab (including `credit_value` field for admin use)
- Signups admin tab (attendee listing + Add Attendee form, both stripped of credits UI)

---

## Database Notes

The following Supabase tables/columns become unused by the frontend but are **not dropped** as part of this task (DB schema changes are out of scope):
- `photos` table
- `orders` table
- `attendees.credits` column (still inserted as `0` on sign up to avoid schema errors)
- `wishlist.credit_value` column (retained in admin Wishlist tab; fetched by `loadWishlist()` but not rendered to end users)

---

## Out of Scope

- Supabase database schema changes
- Any new UI to replace removed features
- Re-adding `delete-attendee` capability to the Signups tab
