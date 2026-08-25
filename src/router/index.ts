import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  // HTML5 history (clean URLs, no #). GitHub Pages has no SPA rewrite, so the
  // build copies dist/index.html to dist/404.html — GH serves that for unknown
  // paths and the router takes over client-side.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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

export default router
