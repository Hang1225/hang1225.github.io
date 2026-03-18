-- ============================================================
-- Migration: Reservation System & Attendance Tracking
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Events table
create table events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_date    date not null,
  capacity      integer not null default 6,
  status        text not null default 'open'
                  check (status in ('open', 'closed', 'cancelled')),
  event_type    text not null default 'open'
                  check (event_type in ('open', 'curated')),
  show_count    boolean not null default false,
  show_names    boolean not null default false,
  show_gender   boolean not null default false,
  created_at    timestamptz default now()
);

-- 2. Reservations table
create table reservations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  attendee_id   uuid references attendees(id) on delete cascade,
  guest_count   integer not null default 1 check (guest_count in (1, 2)),
  message       text,
  status        text not null default 'confirmed'
                  check (status in (
                    'confirmed', 'waitlisted', 'interested',
                    'cancelled', 'declined', 'removed'
                  )),
  created_at    timestamptz default now()
);

-- 3. Extend attendees
alter table attendees
  add column gender text
    check (gender in ('male', 'female', 'non-binary') or gender is null),
  add column gender_visibility text not null default 'admin_only'
    check (gender_visibility in ('admin_only', 'public'));

-- 4. Enable RLS
alter table events enable row level security;
alter table reservations enable row level security;

-- 5. RLS: events
create policy "public read events"
  on events for select to anon
  using (status != 'cancelled');

create policy "admin full access events"
  on events for all to authenticated
  using (true);

-- 6. RLS: reservations
-- NOTE: Custom auth (username+PIN, no JWT) means row-level ownership
-- cannot be enforced at DB level. Client filters by attendee_id from session.
-- 'cancelled' is the only status a guest may write via update.
create policy "public insert reservations"
  on reservations for insert
  with check (status in ('confirmed', 'waitlisted', 'interested'));

create policy "anon read all reservations"
  on reservations for select
  using (true);

create policy "guest cancel reservation"
  on reservations for update
  using (true)
  with check (status = 'cancelled');

create policy "admin full access reservations"
  on reservations for all to authenticated
  using (true);

-- 7. Waitlist auto-promotion trigger (open events only)
create or replace function promote_waitlist()
returns trigger as $$
declare
  used_slots  integer;
  event_cap   integer;
  ev_type     text;
  avail       integer;
  rec         record;
begin
  if new.status in ('cancelled', 'declined', 'removed')
     and old.status not in ('cancelled', 'declined', 'removed') then

    select capacity, event_type into event_cap, ev_type
      from events where id = new.event_id;

    if ev_type != 'open' then return new; end if;

    select coalesce(sum(guest_count), 0) into used_slots
      from reservations
     where event_id = new.event_id and status = 'confirmed';

    avail := event_cap - used_slots;

    for rec in
      select * from reservations
       where event_id = new.event_id and status = 'waitlisted'
       order by created_at asc
    loop
      if avail >= rec.guest_count then
        update reservations set status = 'confirmed' where id = rec.id;
        avail := avail - rec.guest_count;
      end if;
      -- skip entries that don't fit; continue to next
    end loop;

  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_promote_waitlist
after update on reservations
for each row execute function promote_waitlist();
