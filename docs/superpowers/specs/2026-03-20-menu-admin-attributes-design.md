# Menu Admin — New Drink Attributes Design Spec
**Date:** 2026-03-20
**Status:** Approved

---

## Overview

Add `abv` and `flavors` fields to the "Add / Edit Drink" form in the admin Menu tab. These columns already exist in the `drinks` table (added via `2026-03-19-menu-voting.sql`) but are not yet exposed in the admin UI. This spec covers the minimal changes required to author those values.

---

## Scope

**In scope:**
- Add ABV and Flavors inputs to the admin drink form (`admin/index.html`)
- Wire save/edit/clear logic in `admin/js/admin-main.js`

**Out of scope:**
- Restructuring the existing form layout
- Changes to `menu.html` or `js/menu.js`
- Photo URL field (kept as-is)

---

## Form Layout (`admin/index.html`)

The existing first `form-row` (Name + Description) is unchanged. A second `form-row` is added directly below it:

```
Row 1: [ Name ] [ Description ]
Row 2: [ ABV (optional) ] [ Flavors — comma separated ]
       [ Photo URL (optional) ]
       [ Save ] [ Clear ]
```

### Field specs

**ABV**
- `<input type="number" id="drink-abv" step="0.1" min="0" max="100">`
- Label: `ABV % (optional)`
- Placeholder: `e.g. 18.5`

**Flavors**
- `<input type="text" id="drink-flavors">`
- Label: `Flavors (comma separated)`
- Placeholder: `e.g. 柑橘, 起泡, 草本`

---

## JS Logic (`admin/js/admin-main.js`)

### Save (insert & update)

```js
const abv = document.getElementById('drink-abv').value.trim()
const flavorsRaw = document.getElementById('drink-flavors').value

const abvVal = abv !== '' ? parseFloat(abv) : null
const flavorsVal = flavorsRaw
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Include in both insert and update payloads:
// { ..., abv: abvVal, flavors: flavorsVal }
```

### Edit (populate on "Edit" click)

```js
document.getElementById('drink-abv').value = d.abv ?? ''
document.getElementById('drink-flavors').value = (d.flavors || []).join(', ')
```

### Clear

```js
document.getElementById('drink-abv').value = ''
document.getElementById('drink-flavors').value = ''
```

---

## No Migration Required

`abv` and `flavors` columns already exist in the `drinks` table from `docs/migrations/2026-03-19-menu-voting.sql`. No DB changes needed.

---

## Files Changed

| File | Change |
|---|---|
| `admin/index.html` | Add ABV + Flavors inputs to the drink form |
| `admin/js/admin-main.js` | Wire save/edit/clear for new fields |
