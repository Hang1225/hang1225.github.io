-- ============================================================
-- Migration: Menu Voting System
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
-- Prerequisites: drinks and attendees tables must already exist
-- ============================================================

-- 1. Add ABV and flavors to drinks table
alter table drinks add column if not exists abv numeric(4,1);
alter table drinks add column if not exists flavors text[] default '{}';

-- 2. Create drink_votes table
create table if not exists drink_votes (
  id           uuid primary key default gen_random_uuid(),
  drink_id     uuid references drinks(id) on delete cascade not null,
  attendee_id  uuid references attendees(id) not null,
  event_id     uuid references events(id) not null,
  created_at   timestamptz default now(),
  unique (attendee_id, event_id)
);

-- 3. Enable RLS
alter table drink_votes enable row level security;

-- 4. RLS Policies
create policy "public read drink_votes" on drink_votes
  for select using (true);

create policy "public insert drink_votes" on drink_votes
  for insert with check (true);

create policy "public delete drink_votes" on drink_votes
  for delete using (true);

create policy "admin full access drink_votes" on drink_votes
  for all using (auth.role() = 'authenticated');
