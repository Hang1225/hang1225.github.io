import { supabase } from './supabase-client.js'

export async function loadApprovedPhotos() {
  const { data, error } = await supabase
    .from('photos')
    .select('url, caption, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
  return error ? [] : data
}

export async function uploadPhoto(file, caption) {
  const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
  const { error: uploadError } = await supabase.storage
    .from('gallery')
    .upload(filename, file, { cacheControl: '3600', upsert: false })
  if (uploadError) return false

  const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filename)

  const { error: dbError } = await supabase
    .from('photos')
    .insert({ url: urlData.publicUrl, caption: caption || null, approved: false })
  return !dbError
}
