import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import UploadView from '../views/UploadView.vue'
import AuthView from '../views/AuthView.vue'
import PieceView from '../views/PieceView.vue'
import SharedView from '../views/SharedView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
    },
    {
      path: '/auth',
      name: 'auth',
      component: AuthView,
    },
    {
      path: '/piece/:id',
      name: 'piece',
      component: PieceView,
    },
    {
      path: '/shared/:token',
      name: 'shared',
      component: SharedView,
    },
  ],
})

export default router
