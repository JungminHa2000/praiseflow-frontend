<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

// Toggle between login and signup forms
const mode = ref<'login' | 'signup'>('login')

// Form fields
const name = ref('')
const email = ref('')
const password = ref('')
const instrumentDefault = ref('')
const voiceType = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    if (mode.value === 'signup') {
      await auth.signup(
        name.value,
        email.value,
        password.value,
        instrumentDefault.value || undefined,
        voiceType.value || undefined,
      )
    } else {
      await auth.login(email.value, password.value)
    }

    // After successful login/signup, go to the library page
    router.push('/')
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div style="max-width: 420px; margin: 2rem auto">
    <h2 style="text-align: center; margin-bottom: 0.5rem">
      {{ mode === 'login' ? 'Welcome back' : 'Create your account' }}
    </h2>
    <p style="text-align: center; color: #6b7280; margin-bottom: 2rem; font-size: 14px">
      {{
        mode === 'login'
          ? 'Log in to access your song library'
          : 'Sign up to start building your worship library'
      }}
    </p>

    <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb">
      <!-- Name field (signup only) -->
      <div v-if="mode === 'signup'" style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.3rem; font-weight: 500; font-size: 14px"
          >Name</label
        >
        <input v-model="name" placeholder="Your name" />
      </div>

      <!-- Email -->
      <div style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.3rem; font-weight: 500; font-size: 14px"
          >Email</label
        >
        <input v-model="email" type="email" placeholder="you@example.com" />
      </div>

      <!-- Password -->
      <div style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.3rem; font-weight: 500; font-size: 14px"
          >Password</label
        >
        <input v-model="password" type="password" placeholder="At least 6 characters" />
      </div>

      <!-- Instrument (signup only) -->
      <div v-if="mode === 'signup'" style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.3rem; font-weight: 500; font-size: 14px">
          Primary instrument <span style="color: #9ca3af">(optional)</span>
        </label>
        <select v-model="instrumentDefault">
          <option value="">Select...</option>
          <option value="keyboard">Keyboard</option>
          <option value="acoustic guitar">Acoustic guitar</option>
          <option value="electric guitar">Electric guitar</option>
          <option value="bass guitar">Bass guitar</option>
          <option value="drums">Drums</option>
          <option value="violin">Violin</option>
        </select>
      </div>

      <!-- Voice type (signup only) -->
      <div v-if="mode === 'signup'" style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.3rem; font-weight: 500; font-size: 14px">
          Voice type <span style="color: #9ca3af">(optional)</span>
        </label>
        <select v-model="voiceType">
          <option value="">Select...</option>
          <option value="soprano">Soprano</option>
          <option value="alto">Alto</option>
          <option value="tenor">Tenor</option>
          <option value="bass">Bass</option>
        </select>
      </div>

      <button @click="handleSubmit" :disabled="isLoading" style="width: 100%; margin-top: 0.5rem">
        {{
          isLoading
            ? mode === 'login'
              ? 'Logging in...'
              : 'Creating account...'
            : mode === 'login'
              ? 'Log in'
              : 'Sign up'
        }}
      </button>

      <p
        v-if="errorMessage"
        style="color: #dc2626; margin-top: 1rem; font-size: 14px; text-align: center"
      >
        {{ errorMessage }}
      </p>
    </div>

    <p style="text-align: center; margin-top: 1.5rem; font-size: 14px; color: #6b7280">
      <span v-if="mode === 'login'">
        Don't have an account?
        <a
          @click="mode = 'signup'"
          style="color: #1a1a1a; font-weight: 500; cursor: pointer; text-decoration: underline"
          >Sign up</a
        >
      </span>
      <span v-else>
        Already have an account?
        <a
          @click="mode = 'login'"
          style="color: #1a1a1a; font-weight: 500; cursor: pointer; text-decoration: underline"
          >Log in</a
        >
      </span>
    </p>
  </div>
</template>
