import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Register from '@/views/Auth/RegisterForm.vue'
import Dashboard from '@/views/Client/ClientDashbaord.vue'
import supabase from '@/lib/Supabase'
import AdminDashboard from '@/views/admin/AdminDashboard.vue'
import ProviderApplication from '@/views/Auth/ProviderApplication.vue'
import RulesSubmission from '@/views/admin/RulesSubmission.vue'
import ViewRules from '@/views/Client/ViewRules.vue'
import ClientApproved from '@/views/Client/ClientApproved.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/register',
      name: 'register',
      component: Register,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'AdminDashboard',
      component: AdminDashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/application',
      name: 'Provider Application',
      component: ProviderApplication,
      meta: { requiresAuth: true },
    },
    {
      path: '/myrules',
      name: 'Provider Rules',
      component: RulesSubmission,
      meta: { requiresAuth: true },
    },
    {
      path: '/rules',
      name: 'View Rules',
      component: ViewRules,
      meta: { requiresAuth: true },
    },
    {
      path: '/approved',
      name: 'Client Approved',
      component: ClientApproved,
      meta: { requiresAuth: true },
    },
  ],
})

//  Global navigation guard
router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return next({ name: 'home' })
    }
  }
  if (to.name === 'register' || to.name === 'home') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      return next({ name: 'dashboard' })
    }
  }

  return next()
})

export default router
