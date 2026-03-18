import { supabase } from './supabase-client.js'

export async function loadWishlist() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('item_name, credit_value')
    .eq('active', true)
    .order('credit_value', { ascending: false })
  return error ? [] : data
}
