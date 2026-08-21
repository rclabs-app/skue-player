import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GuideView from '../views/GuideView.vue'
import { usePlaylistStore } from '../stores/playlist'

// Router configuration

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/live',
      name: 'live',
      component: () => import('../views/LiveView.vue')
    },
    {
      path: '/movies',
      name: 'movies',
      component: () => import('../views/MoviesView.vue')
    },
    {
      path: '/series',
      name: 'series',
      component: () => import('../views/SeriesView.vue')
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/pair',
      name: 'pair',
      component: () => import('../views/PairView.vue')
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('../views/OnboardingView.vue')
    },
    {
      path: '/guide',
      name: 'guide',
      component: GuideView
    },
    {
      path: '/details/:id',
      name: 'details',
      component: () => import('../views/DetailsView.vue')
    },
    {
      path: '/portal',
      name: 'portal-login',
      component: () => import('../views/PortalLoginView.vue')
    },
    {
      path: '/portal/dashboard',
      name: 'portal-dashboard',
      component: () => import('../views/PortalDashboardView.vue')
    }
  ]
})

let initialized = false

router.beforeEach(async (to) => {
  const store = usePlaylistStore()

  // Initialize the DB once on the first navigation
  if (!initialized) {
    await store.initialize()
    initialized = true
  }

  // Allow access to public routes
  const publicRoutes = ['onboarding', 'settings', 'pair', 'portal-login', 'portal-dashboard']
  if (publicRoutes.includes(to.name as string)) {
    return true
  }

  // Redirect to onboarding if no playlist loaded
  if (!store.isLoaded) return { name: 'onboarding' }

  return true
})

export default router
