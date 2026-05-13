<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
</script>

<template>
  <header
    style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
    "
  >
    <h1 style="font-size: 1.5rem; font-weight: 600">🎵 PraiseFlow</h1>
    <nav style="display: flex; gap: 1rem; align-items: center">
      <template v-if="auth.isLoggedIn">
        <RouterLink to="/" style="text-decoration: none; color: #1a1a1a">Library</RouterLink>
        <RouterLink to="/upload" style="text-decoration: none; color: #1a1a1a">Upload</RouterLink>
        <span style="color: #6b7280; font-size: 13px">{{ auth.user?.name }}</span>
        <a @click="auth.logout()" style="color: #dc2626; font-size: 13px; cursor: pointer"
          >Log out</a
        >
      </template>
      <template v-else>
        <RouterLink to="/auth" style="text-decoration: none; color: #1a1a1a; font-weight: 500"
          >Log in</RouterLink
        >
      </template>
    </nav>
  </header>

  <RouterView />
</template>
