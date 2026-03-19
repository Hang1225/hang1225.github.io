import { supabase } from './supabase-client.js'

// Returns all non-cancelled events ordered by event_date ASC.
// Includes all events (past + future) — callers filter by date as needed.
export async function loadEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, event_type, status, capacity, show_count, show_names, show_gender, start_time, end_time')
    .neq('status', 'cancelled')
    .neq('status', 'closed')
    .order('event_date', { ascending: true })
  return error ? [] : data
}

// Converts a Supabase `time` string ("HH:MM:SS") to 12-hour AM/PM display.
// Returns:
//   "7:00 PM – 9:30 PM"  when both start and end are set
//   "7:00 PM"            when only start is set
//   ""                   when start is null/falsy
export function formatTimeRange(start_time, end_time) {
  if (!start_time) return ''
  return end_time
    ? `${fmt12h(start_time)} – ${fmt12h(end_time)}`
    : fmt12h(start_time)
}

function fmt12h(timeStr) {
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr.padStart(2, '0')
  const period = h < 12 ? 'AM' : 'PM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}
