-- Create server-side passcode verification function
create or replace function verify_passcode(input text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from settings
    where key = 'site_passcode' and value = input
  );
$$;

-- Grant execute to anon role
grant execute on function verify_passcode(text) to anon;

-- Remove direct public read access to settings (no longer needed)
drop policy if exists "public read settings" on settings;
