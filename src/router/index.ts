import { createRouter, createWebHistory } from 'vue-router'
import { trackView } from '@/lib/visits'
import { authReady, isSignedIn } from '@/lib/auth'

const router = createRouter({
  // HTML5 history (clean URLs, no #). GitHub Pages has no SPA rewrite, so the
  // build copies dist/index.html to dist/404.html — GH serves that for unknown
  // paths and the router takes over client-side.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      name: 'Checker',
      component: () => import('@/pages/CheckerPage.vue')
    },
    {
      path: '/stats',
      name: 'Stats',
      component: () => import('@/pages/StatsPage.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/pages/SettingsPage.vue')
    }
  ],
})

// Sends signed-out visitors to /login. This is presentation only — the real
// boundary is the RLS policy from db/auth.sql, which requires the
// `authenticated` role before `votes` returns a single row. Anyone can bypass
// this guard by editing the bundle; nobody can bypass the policy.
router.beforeEach(async (to) => {
  await authReady
  if (to.meta.public || isSignedIn.value) return true
  return { path: '/login', query: { redirect: to.fullPath } }
})

// Counts the first load and every client-side navigation. afterEach, so a
// failed or cancelled navigation is never logged. trackView never throws and
// never awaits — see src/lib/visits.ts.
router.afterEach((to) => {
  trackView(to.path)
})

export default router
