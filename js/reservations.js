import { supabase } from './supabase-client.js'

// --- ADMIN ---

// Returns all reservations for an event with attendee data (admin use).
// Ordered by created_at ASC (waitlist position is determined by this order).
export async function loadEventReservations(eventId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, attendees(username, alias, gender, gender_visibility)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return error ? [] : data
}

// --- GUEST-FACING ---

// Returns masked guest list data for a single event according to its display flags.
// Returns null if no display flags are set (guest list hidden).
// showGender only reveals gender for attendees with gender_visibility = 'public'.
export async function loadEventGuestList(eventId, showCount, showNames, showGender) {
  if (!showCount && !showNames && !showGender) return null

  const { data, error } = await supabase
    .from('reservations')
    .select('id, guest_count, attendees(alias, username, gender, gender_visibility, mbti)')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })

  if (error) return null
  const confirmed = data || []

  return {
    count: showCount
      ? confirmed.reduce((sum, r) => sum + r.guest_count, 0)
      : null,
    guests: confirmed.map(r => ({
      name: showNames ? (r.attendees.alias || r.attendees.username) : null,
      gender: showGender && r.attendees.gender_visibility === 'public'
        ? r.attendees.gender
        : null,
      mbti: showGender ? r.attendees.mbti : null,
      guestCount: r.guest_count
    }))
  }
}

// Returns all reservations for a given attendee, joined with event data.
// Used for both the dashboard (upcoming) and history (past).
export async function loadAttendeeReservations(attendeeId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, events(id, title, event_date, event_type, status, capacity, admin_reserved, show_count, show_names, show_gender, start_time, end_time)')
    .eq('attendee_id', attendeeId)
  return error ? [] : data
}

// Inserts a reservation. status must be 'confirmed', 'waitlisted', or 'interested'.
// For open events: guestCount is 1 or 2. For curated: guestCount is 1 (default).
// message is optional (pass null if empty).
export async function createReservation(eventId, attendeeId, guestCount, message, status) {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      event_id: eventId,
      attendee_id: attendeeId,
      guest_count: guestCount,
      message: message || null,
      status
    })
    .select()
    .single()
  return { data, error }
}

// Sets reservation status to 'cancelled'. Used by both open-event cancellation
// and curated-event interest withdrawal.
export async function cancelReservation(reservationId) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
  return { error }
}

// Updates a previously-removed reservation back to an active status.
// Use instead of createReservation when the attendee already has a removed row
// for this event, to avoid duplicate rows.
export async function reapplyReservation(reservationId, guestCount, message, status) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ guest_count: guestCount, message: message || null, status })
    .eq('id', reservationId)
    .select()
    .single()
  return { data, error }
}

// Updates an invited reservation to confirmed (guest accepts invite).
export async function acceptInvite(reservationId) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmed' })
    .eq('id', reservationId)
    .eq('status', 'invited')
  return { error }
}

// Sets an invited reservation to declined and decrements admin_reserved by 1.
// currentAdminReserved is the event's current admin_reserved value (read from
// the reservation's joined event data before calling this function).
export async function declineInvite(reservationId, eventId, currentAdminReserved) {
  const [resResult, eventResult] = await Promise.all([
    supabase.from('reservations').update({ status: 'declined' }).eq('id', reservationId),
    supabase.from('events').update({ admin_reserved: Math.max(0, currentAdminReserved - 1) }).eq('id', eventId)
  ])
  return { error: resResult.error || eventResult.error, eventError: eventResult.error }
}
