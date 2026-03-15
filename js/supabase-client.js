import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://ouoikjafgjghgplyyyvl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_dGONF7W2nCNsMhzXnI1v2Q_Gztez-pH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
