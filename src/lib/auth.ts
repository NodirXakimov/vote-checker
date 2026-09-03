import type { Session } from '@supabase/supabase-js'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * Current Supabase session, or null when signed out.
 *
 * The session is what the database actually trusts: once db/auth.sql runs, RLS
 * on `votes` requires the `authenticated` role, so a missing session means the
 * queries return nothing regardless of what the router allows. The guard in
 * src/router/index.ts is UX on top of that, not the access control itself.
 */
const session = ref<Session | null>(null)

export const currentSession = computed(() => session.value)
export const isSignedIn = computed(() => session.value !== null)
export const userEmail = computed(() => session.value?.user.email ?? '')

/**
 * Resolves once the stored session has been read back.
 *
 * supabase-js restores the session from localStorage asynchronously, so a
 * router guard that runs before this settles would bounce a signed-in user to
 * the login page on every hard refresh. main.ts awaits this before mounting and
 * the guard awaits it again for safety.
 */
export const authReady: Promise<void> = supabase.auth
  .getSession()
  .then(({ data }) => {
    session.value = data.session
  })
  .catch(() => {
    // Unreadable storage (private mode, blocked cookies) means signed out, which
    // is the safe default. Never leave the app hanging on the splash instead.
    session.value = null
  })

// Keeps the ref in step with token refreshes, sign-outs in another tab, and
// expiry. Registered once at module load and never torn down.
supabase.auth.onAuthStateChange((_event, next) => {
  session.value = next
})

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}
