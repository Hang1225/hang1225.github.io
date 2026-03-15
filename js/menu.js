import { supabase } from './supabase-client.js'

export async function loadDrinks() {
  const { data, error } = await supabase
    .from('drinks')
    .select('*')
    .eq('active', true)
    .order('created_at')
  return error ? [] : data
}

export async function loadCommentsForDrink(drinkId) {
  const { data, error } = await supabase
    .from('comments')
    .select('author_name, body, created_at')
    .eq('drink_id', drinkId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function submitComment(drinkId, authorName, body) {
  const { error } = await supabase
    .from('comments')
    .insert({ drink_id: drinkId, author_name: authorName, body, approved: false })
  return !error
}
