import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Checker',
      component: () => import('@/pages/CheckerPage.vue')
    }
  ],
})

export default router
