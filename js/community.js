import { supabase } from './supabase-client.js'

export async function loadGeneralComments() {
  const { data, error } = await supabase
    .from('comments')
    .select('author_name, body, created_at')
    .is('drink_id', null)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function submitGeneralComment(authorName, body) {
  const { error } = await supabase
    .from('comments')
    .insert({ drink_id: null, author_name: authorName, body, approved: false })
  return !error
}
