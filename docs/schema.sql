-- Site settings (passcode etc.)
create table settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values ('site_passcode', 'changeme');

-- Menu drinks
create table drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Comments (drink_id null = general homebar comment)
create table comments (
  id uuid primary key default gen_random_uuid(),
  drink_id uuid references drinks(id) on delete cascade,
  author_name text,
  body text not null,
  approved boolean default false,
  created_at timestamptz default now()
);

-- Gallery photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  approved boolean default false,
  created_at timestamptz default now()
);

-- OpenBar attendees
create table attendees (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  alias text,
  pin_hash text not null,
  credits integer default 0,
  created_at timestamptz default now()
);

-- Drink orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid references attendees(id),
  drink_id uuid references drinks(id),
  status text default 'pending',
  created_at timestamptz default now()
);

-- Wishlist
create table wishlist (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  credit_value integer not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table settings enable row level security;
alter table drinks enable row level security;
alter table comments enable row level security;
alter table photos enable row level security;
alter table attendees enable row level security;
alter table orders enable row level security;
alter table wishlist enable row level security;

-- Public can read settings
create policy "public read settings" on settings for select using (true);

-- Public can read active drinks
create policy "public read drinks" on drinks for select using (active = true);

-- Public can read approved comments
create policy "public read comments" on comments for select using (approved = true);

-- Public can insert unapproved comments
create policy "public insert comments" on comments for insert with check (approved = false);

-- Public can read approved photos
create policy "public read photos" on photos for select using (approved = true);

-- Public can insert unapproved photos
create policy "public insert photos" on photos for insert with check (approved = false);

-- Public can read attendees (needed for PIN login)
create policy "public read attendees" on attendees for select using (true);

-- Public can insert orders
create policy "public insert orders" on orders for insert with check (true);

-- Public can read orders
create policy "public read orders" on orders for select using (true);

-- Public can read active wishlist
create policy "public read wishlist" on wishlist for select using (active = true);

-- Admin (authenticated Supabase user) has full access to everything
create policy "admin full access settings" on settings for all using (auth.role() = 'authenticated');
create policy "admin full access drinks" on drinks for all using (auth.role() = 'authenticated');
create policy "admin full access comments" on comments for all using (auth.role() = 'authenticated');
create policy "admin full access photos" on photos for all using (auth.role() = 'authenticated');
create policy "admin full access attendees" on attendees for all using (auth.role() = 'authenticated');
create policy "admin full access orders" on orders for all using (auth.role() = 'authenticated');
create policy "admin full access wishlist" on wishlist for all using (auth.role() = 'authenticated');
