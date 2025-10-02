import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Register from '@/views/Auth/RegisterForm.vue'
import Dashboard from '@/views/Client/ClientDashbaord.vue'
import supabase from '@/lib/Supabase'
import AdminDashboard from '@/views/admin/AdminDashboard.vue'
import ProviderApplication from '@/views/Auth/ProviderApplication.vue'
import ViewRules from '@/views/Client/ViewRules.vue'
import { useUserStore } from '@/stores/users'
import { providersStore } from '@/stores/providers'
import MyProgram from '@/views/admin/MyProgram.vue'
import SuperAdmin from '@/views/SuperAdmin/SuperAdmin.vue'
import AllProviders from '@/views/SuperAdmin/AllProviders.vue'
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
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/application',
      name: 'Provider Application',
      component: ProviderApplication,
      meta: { requiresAuth: true },
    },
    {
      path: '/add-rules',
      name: 'Provider Rules',
      component: MyProgram,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/rules',
      name: 'View Rules',
      component: ViewRules,
      meta: { requiresAuth: true },
    },

    {
      path: '/my-rules',
      name: 'My Rules',
      component: MyProgram,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/super',
      name: 'Super Admin',
      component: SuperAdmin,
      meta: { requiresAuth: true, requiresAdmin: true, requiresSuper: true },
    },
    {
      path: '/super/providers',
      name: 'All Providers',
      component: AllProviders,
      meta: { requiresAuth: true, requiresAdmin: true, requiresSuper: true },
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const ps = providersStore()

  // Check authentication
  if (to.meta.requiresAuth) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return next({ name: 'home' })
    }
  }

  // Redirect authenticated users
  if (to.name === 'register' || to.name === 'home') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      return next({ name: 'dashboard' })
    }
  }

  // (approved provider only)
  if (to.meta.requiresAdmin) {
    if (!userStore.isUserLoaded) {
      await userStore.fetchUser()
    }
    if (ps.providers.length === 0) {
      await ps.fetchProviders()
    }

    const myProvider = ps.providers.find((p) => p.id === userStore.user_id)

    if (!myProvider || myProvider.status !== 'approved') {
      console.warn('Access denied: User is not an approved provider')
      return next({ name: 'dashboard' })
    }

    // Super admin-only sections
    if (to.meta.requiresSuper) {
      if (!myProvider.is_super_admin) {
        console.warn('Access denied: User is not a super admin')
        return next({ name: 'dashboard' })
      }
    }
  }

  return next()
})

export default router
