import { supabase } from './supabase-client.js'

// Fetch all active drinks ordered by ABV ascending (nulls last)
export async function loadDrinks() {
  const { data, error } = await supabase
    .from('drinks')
    .select('id, name, description, abv, flavors, active')
    .eq('active', true)
    .order('abv', { ascending: true, nullsFirst: false })
  return error ? [] : data
}

// Fetch all vote rows and return a Map<drinkId, count>
export async function loadAllVotes() {
  const { data, error } = await supabase
    .from('drink_votes')
    .select('drink_id')
  if (error || !data) return new Map()
  const counts = new Map()
  for (const row of data) {
    counts.set(row.drink_id, (counts.get(row.drink_id) ?? 0) + 1)
  }
  return counts
}

// Return the drink_id the attendee voted for in this event, or null
export async function getMyVote(attendeeId, eventId) {
  const { data, error } = await supabase
    .from('drink_votes')
    .select('drink_id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (error || !data) return null
  return data.drink_id
}

// Delete existing vote for this attendee+event, then insert new vote.
// Returns { ok: boolean, previousDrinkId: string | null }
export async function submitVote(drinkId, attendeeId, eventId) {
  // Step 1: find and delete existing vote
  const { data: existing } = await supabase
    .from('drink_votes')
    .select('drink_id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .maybeSingle()

  const previousDrinkId = existing?.drink_id ?? null

  if (previousDrinkId) {
    const { error: delError } = await supabase
      .from('drink_votes')
      .delete()
      .eq('attendee_id', attendeeId)
      .eq('event_id', eventId)
    if (delError) return { ok: false, previousDrinkId }
  }

  // Step 2: insert new vote
  const { error: insError } = await supabase
    .from('drink_votes')
    .insert({ drink_id: drinkId, attendee_id: attendeeId, event_id: eventId })

  if (insError) return { ok: false, previousDrinkId }
  return { ok: true, previousDrinkId }
}
