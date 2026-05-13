<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const allPieces = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

if (!auth.isLoggedIn) {
  router.push('/auth')
}

onMounted(async () => {
  if (!auth.isLoggedIn) return
  try {
    const response = await api.get('/library/all-songs')
    allPieces.value = response.data.pieces
  } catch (err: any) {
    console.error('Failed to load songs:', err)
  } finally {
    isLoading.value = false
  }
})

// Filter pieces based on search query
const filteredPieces = computed(() => {
  if (!searchQuery.value.trim()) return allPieces.value

  const query = searchQuery.value.toLowerCase()
  return allPieces.value.filter((piece) => {
    const titleMatch = piece.title.toLowerCase().includes(query)
    const songMatch = piece.analysis?.songTitle?.toLowerCase().includes(query)
    const keyMatch = piece.analysis?.keySignature?.toLowerCase().includes(query)
    const folderMatch = piece.folder?.name?.toLowerCase().includes(query)
    return titleMatch || songMatch || keyMatch || folderMatch
  })
})
</script>

<template>
  <div>
    <h2 style="margin-bottom: 0.5rem">Library</h2>
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 1.5rem">
      All songs you've uploaded, across all collections.
    </p>

    <!-- Search bar -->
    <div style="margin-bottom: 1.5rem">
      <input
        v-model="searchQuery"
        placeholder="Search by title, key, or collection..."
        style="
          width: 100%;
          padding: 0.7rem 1rem;
          font-size: 14px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
        "
      />
    </div>

    <!-- Loading -->
    <p v-if="isLoading" style="color: #6b7280">Loading your songs...</p>

    <!-- Empty -->
    <div
      v-else-if="allPieces.length === 0"
      style="text-align: center; padding: 3rem; color: #6b7280"
    >
      <p style="font-size: 16px; margin-bottom: 0.5rem">No songs yet</p>
      <p style="font-size: 14px">Upload your first song to get started.</p>
    </div>

    <!-- No search results -->
    <div
      v-else-if="filteredPieces.length === 0"
      style="text-align: center; padding: 2rem; color: #6b7280"
    >
      <p style="font-size: 14px">No songs match "{{ searchQuery }}"</p>
    </div>

    <!-- Song list -->
    <div v-else>
      <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0.75rem">
        {{ filteredPieces.length }} {{ filteredPieces.length === 1 ? 'song' : 'songs' }}
        <span v-if="searchQuery"> matching "{{ searchQuery }}"</span>
      </p>

      <div
        v-for="piece in filteredPieces"
        :key="piece.id"
        @click="router.push(`/piece/${piece.id}`)"
        style="
          background: white;
          padding: 1rem 1.25rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 0.5rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <div>
          <p style="font-size: 14px; font-weight: 500">{{ piece.title }}</p>
          <p style="font-size: 12px; color: #9ca3af">
            {{ piece.analysis?.keySignature || 'Not analysed' }}
            {{ piece.analysis?.songTitle ? ' · ' + piece.analysis.songTitle : '' }}
            · 📁 {{ piece.folder?.name || 'Unknown folder' }}
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem">
          <span
            style="font-size: 11px; padding: 2px 8px; border-radius: 99px"
            :style="{
              background:
                piece.processingStatus === 'ready'
                  ? '#ecfdf5'
                  : piece.processingStatus === 'error'
                    ? '#fef2f2'
                    : '#f9fafb',
              color:
                piece.processingStatus === 'ready'
                  ? '#065f46'
                  : piece.processingStatus === 'error'
                    ? '#991b1b'
                    : '#6b7280',
            }"
            >{{ piece.processingStatus }}</span
          >
          <span style="color: #d1d5db">→</span>
        </div>
      </div>
    </div>
  </div>
</template>
