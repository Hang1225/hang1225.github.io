import { supabase } from './supabase-client.js'

const PASSCODE_KEY = 'hb_passcode_ok'
const ATTENDEE_KEY = 'hb_attendee'

export function isPasscodeVerified() {
  return sessionStorage.getItem(PASSCODE_KEY) === 'true'
}

export function setPasscodeVerified() {
  sessionStorage.setItem(PASSCODE_KEY, 'true')
}

export async function verifyPasscode(input) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'site_passcode')
    .single()
  if (error) return false
  return data.value === input
}

export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function loginAttendee(username, pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('attendees')
    .select('id, username, alias, credits')
    .eq('username', username.toLowerCase())
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  sessionStorage.setItem(ATTENDEE_KEY, JSON.stringify(data))
  return data
}

export function getAttendeeSession() {
  const raw = sessionStorage.getItem(ATTENDEE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function logoutAttendee() {
  sessionStorage.removeItem(ATTENDEE_KEY)
}

export function requirePasscode() {
  if (!isPasscodeVerified()) {
    window.location.href = '/index.html'
  }
}
