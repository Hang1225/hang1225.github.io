# Homebar Website — Design Document
**Date:** 2026-03-14

---

## Overview

A passcode-protected public website for a homebar, running for nearly 1 year. The site lets attendees view the current menu, upload photos, leave comments, and participate in OpenBar — a credit-based drink ordering system. The host manages everything through an admin panel with no code involvement.

---

## Access Control

- Site is locked behind a **shared passcode** entered on arrival
- Once entered, guests have full access to the site
- OpenBar requires a separate **username + PIN** per attendee
- Admin panel (`/admin`) is protected by a distinct **admin password**

---

## Pages & Sections

### Home
- Brief description of the homebar and its story (~1 year running)
- Sets the mood and vibe for new visitors

### Menu
- Displays the **current occasion's menu** (replaced each event, no history kept)
- Each drink card shows: name, description, optional photo
- **Hover a drink** → shows past approved comments from guests

### Gallery
- Guest-uploaded photos from their experiences
- All uploads are held for **host approval** before going live

### Community
- General comments and reviews about the homebar
- All comments are held for **host approval** before going live

### OpenBar
Attendees log in with username + PIN to access a personal dashboard:

- **Credit balance** — shows current credits
- **Wishlist** — alcohol the host wants, each item labeled with its credit value so attendees know what to bring
- **Order a drink** — browse the current menu, place an order; host approves and deducts credits
- **Order history** — record of past drink orders

---

## Admin Panel (`/admin`)

All managed visually, behind an admin password:

| Section | What you can do |
|---|---|
| Menu | Replace current menu — add/edit/remove drinks (name, description, photo) |
| Gallery | Approve or reject guest photo uploads |
| Comments | Approve or reject drink comments and general homebar comments |
| OpenBar | Add attendees (assign alias), manually add credits when alcohol is brought in, view & approve drink orders |
| Wishlist | Add/edit/remove wishlist items with their credit values |
| Settings | Change the site passcode |

---

## OpenBar Credit System

- Host adds attendees manually, assigning each an **alias**
- Attendee chooses their own **username** and **PIN**
- Credits are assigned **manually by the host** based on what alcohol an attendee brings (value varies per item per the wishlist)
- Attendees place drink orders through the site; host **approves each order** before credits are deducted and the drink is made
- Wishlist items each have an associated credit value set by the host

---

## Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / JavaScript (static) |
| Hosting | GitHub Pages, connected to Porkbun domain |
| Backend / Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (photo uploads) |
| Auth | Supabase Auth (admin) + custom passcode + username/PIN (OpenBar) |
| Cost | Free (GitHub Pages free tier + Supabase free tier) |

---

## Data Models (High Level)

- **drinks** — id, name, description, photo_url, active (current menu flag)
- **comments** — id, drink_id (nullable for general comments), body, approved, created_at
- **photos** — id, url, approved, created_at
- **attendees** — id, username, alias, pin_hash, credits
- **orders** — id, attendee_id, drink_id, status (pending/approved/rejected), created_at
- **wishlist** — id, item_name, credit_value, active
- **settings** — site_passcode (hashed)
