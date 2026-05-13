import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'

// defineStore creates a shared state container that any
// Vue component can access. The first argument is a unique name.
export const useAuthStore = defineStore('auth', () => {
  // -- STATE --
  // These are reactive variables that persist across page navigations.
  // When any of these change, any component using them re-renders.
  const token = ref<string | null>(localStorage.getItem('pf-token'))
  const user = ref<any>(JSON.parse(localStorage.getItem('pf-user') || 'null'))
  const folders = ref<any[]>(JSON.parse(localStorage.getItem('pf-folders') || '[]'))

  // -- COMPUTED --
  // A computed property that derives a value from state.
  // Components can check `isLoggedIn` instead of `token !== null`.
  const isLoggedIn = computed(() => !!token.value)

  // -- ACTIONS --
  // Functions that modify state. Components call these.

  async function signup(
    name: string,
    email: string,
    password: string,
    instrumentDefault?: string,
    voiceType?: string,
  ) {
    const response = await api.post('/auth/signup', {
      name,
      email,
      password,
      instrumentDefault,
      voiceType,
    })

    const data = response.data
    token.value = data.token
    user.value = data.user
    folders.value = [{ id: data.defaultFolderId, name: 'My Songs', pieces: [] }]

    // Save to localStorage so the user stays logged in
    // even if they close the browser and come back
    localStorage.setItem('pf-token', data.token)
    localStorage.setItem('pf-user', JSON.stringify(data.user))
    localStorage.setItem('pf-folders', JSON.stringify(folders.value))

    // Set the token on all future API requests automatically
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
  }

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password })

    const data = response.data
    token.value = data.token
    user.value = data.user
    folders.value = data.folders

    localStorage.setItem('pf-token', data.token)
    localStorage.setItem('pf-user', JSON.stringify(data.user))
    localStorage.setItem('pf-folders', JSON.stringify(data.folders))

    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
  }

  function logout() {
    token.value = null
    user.value = null
    folders.value = []

    localStorage.removeItem('pf-token')
    localStorage.removeItem('pf-user')
    localStorage.removeItem('pf-folders')

    delete api.defaults.headers.common['Authorization']
  }

  // If there's a saved token from a previous session, set it
  // on the API client so requests are authenticated immediately
  if (token.value) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return { token, user, folders, isLoggedIn, signup, login, logout }
})
