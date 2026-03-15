import { supabase } from '../../js/supabase-client.js'

export async function adminLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export async function adminLogout() {
  await supabase.auth.signOut()
  window.location.href = '/admin/index.html'
}

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
