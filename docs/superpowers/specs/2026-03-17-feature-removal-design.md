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

---

## Navigation & Home Page

| File | Change |
|------|--------|
| `js/nav.js` | Remove Gallery link entry |
| `home.html` | Remove Gallery feature card; keep Open Bar card |

---

## Open Bar Page

### `openbar.html`
- Remove: Credits display section
- Remove: Order a Drink section
- Remove: Order History section
- Keep: Login/Sign Up interface
- Keep: Wishlist section

### `js/openbar.js`
- Remove: `placeOrder()` function
- Remove: `loadAttendeeOrders()` function
- Remove: `refreshAttendeeCredits()` function
- Keep: `loadWishlist()`
- Keep: all auth logic (handled in `js/auth.js`)

---

## Admin Panel

### `admin/index.html`
- Remove: Gallery tab (photo approvals)
- Remove: Credits & Orders sections within Open Bar tab

### `admin/js/admin-main.js`
- Remove: `loadPendingPhotos()` and photo approve/delete handlers
- Remove: `loadPendingOrders()` and order approve/reject handlers
- Remove: Credit management functions (add credits to attendees)
- Keep: Attendee listing in Signups tab
- Remove: "Add credits" button/functionality from Signups tab

---

## What Is Preserved

- `js/auth.js` — login, signup, session management (still needed for Open Bar)
- Open Bar nav link in `js/nav.js`
- Open Bar feature card on `home.html`
- Wishlist admin tab in admin panel
- Signups admin tab (attendee listing only, no credit management)

---

## Database Notes

The following Supabase tables become unused by the frontend but are **not dropped** as part of this task (DB schema changes are out of scope):
- `photos` table
- `orders` table
- `attendees.credits` column

---

## Out of Scope

- Supabase database schema changes
- Any new UI to replace removed features
