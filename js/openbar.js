import { supabase } from './supabase-client.js'

export async function loadWishlist() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('item_name, credit_value')
    .eq('active', true)
    .order('credit_value', { ascending: false })
  return error ? [] : data
}

export async function loadAttendeeOrders(attendeeId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, created_at, drinks(name)')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function placeOrder(attendeeId, drinkId) {
  const { data: attendee } = await supabase
    .from('attendees')
    .select('credits')
    .eq('id', attendeeId)
    .single()
  if (!attendee || attendee.credits <= 0) return { ok: false, reason: 'Insufficient credits' }

  const { data: pending } = await supabase
    .from('orders')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('status', 'pending')
  if (pending && pending.length > 0) return { ok: false, reason: 'You already have a pending order' }

  const { error } = await supabase
    .from('orders')
    .insert({ attendee_id: attendeeId, drink_id: drinkId, status: 'pending' })
  return error ? { ok: false, reason: 'Order failed' } : { ok: true }
}

export async function refreshAttendeeCredits(attendeeId) {
  const { data, error } = await supabase
    .from('attendees')
    .select('credits')
    .eq('id', attendeeId)
    .single()
  return error ? null : data.credits
}
