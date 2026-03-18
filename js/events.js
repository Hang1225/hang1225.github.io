import { supabase } from './supabase-client.js'

// Returns all non-cancelled events ordered by event_date ASC.
// Includes all events (past + future) — callers filter by date as needed.
export async function loadEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true })
  return error ? [] : data
}
