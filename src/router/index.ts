import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Checker',
      component: () => import('@/pages/CheckerPage.vue')
    }
  ],
})

export default router
