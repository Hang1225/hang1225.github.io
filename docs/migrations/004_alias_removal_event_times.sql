-- Migration 004: add removed_at to attendees, start_time/end_time to events
-- Run in Supabase SQL editor

alter table attendees
  add column if not exists removed_at timestamptz default null;

alter table events
  add column if not exists start_time time default null,
  add column if not exists end_time   time default null;

-- To revert:
-- alter table attendees drop column if exists removed_at;
-- alter table events drop column if exists start_time, drop column if exists end_time;
