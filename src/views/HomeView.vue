<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const folders = ref<any[]>([])
const isLoading = ref(true)
const newFolderName = ref('')
const showNewFolder = ref(false)

// Redirect to auth if not logged in
if (!auth.isLoggedIn) {
  router.push('/auth')
}

// Load the user's library when the page opens
onMounted(async () => {
  if (!auth.isLoggedIn) return

  try {
    const response = await api.get('/library')
    folders.value = response.data.folders
  } catch (err: any) {
    console.error('Failed to load library:', err)
  } finally {
    isLoading.value = false
  }
})

async function createFolder() {
  if (!newFolderName.value.trim()) return

  try {
    const response = await api.post('/library/folders', {
      name: newFolderName.value.trim(),
    })
    folders.value.push({ ...response.data.folder, pieces: [] })
    newFolderName.value = ''
    showNewFolder.value = false
  } catch (err: any) {
    console.error('Failed to create folder:', err)
  }
}

function goToUpload(folderId: string) {
  router.push({ path: '/upload', query: { folderId } })
}
</script>

<template>
  <div>
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      "
    >
      <h2>Your library</h2>
      <button @click="showNewFolder = !showNewFolder" style="font-size: 13px">
        {{ showNewFolder ? 'Cancel' : '+ New folder' }}
      </button>
    </div>

    <!-- New folder form -->
    <div
      v-if="showNewFolder"
      style="
        background: white;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        margin-bottom: 1.5rem;
        display: flex;
        gap: 0.8rem;
      "
    >
      <input
        v-model="newFolderName"
        placeholder="Folder name (e.g. Sunday Sets)"
        @keyup.enter="createFolder"
      />
      <button @click="createFolder">Create</button>
    </div>

    <!-- Loading state -->
    <p v-if="isLoading" style="color: #6b7280">Loading your library...</p>

    <!-- Empty state -->
    <div v-else-if="folders.length === 0" style="text-align: center; padding: 3rem; color: #6b7280">
      <p style="font-size: 16px; margin-bottom: 0.5rem">No folders yet</p>
      <p style="font-size: 14px">Create a folder to start organising your music.</p>
    </div>

    <!-- Folder list -->
    <div v-else>
      <div
        v-for="folder in folders"
        :key="folder.id"
        style="
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
          overflow: hidden;
        "
      >
        <!-- Folder header -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #f3f4f6;
          "
        >
          <div>
            <p style="font-weight: 500; font-size: 15px">📁 {{ folder.name }}</p>
            <p style="font-size: 12px; color: #9ca3af">
              {{ folder.pieces.length }} {{ folder.pieces.length === 1 ? 'song' : 'songs' }}
            </p>
          </div>
          <button @click="goToUpload(folder.id)" style="font-size: 12px; padding: 0.4rem 0.8rem">
            + Add song
          </button>
        </div>

        <!-- Songs in this folder -->
        <div v-if="folder.pieces.length > 0">
          <div
            v-for="piece in folder.pieces"
            :key="piece.id"
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.75rem 1.25rem;
              border-bottom: 1px solid #f9fafb;
              cursor: pointer;
            "
            @click="router.push(`/piece/${piece.id}`)"
            "
          >
            <div>
              <p style="font-size: 14px; font-weight: 500">{{ piece.title }}</p>
              <p style="font-size: 12px; color: #9ca3af">
                {{ piece.analysis?.keySignature || 'Not analysed' }}
                {{ piece.analysis?.songTitle ? ' · ' + piece.analysis.songTitle : '' }}
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
              >
                {{ piece.processingStatus }}
              </span>
              <span style="color: #d1d5db">→</span>
            </div>
          </div>
        </div>

        <!-- Empty folder -->
        <div v-else style="padding: 1.5rem; text-align: center; color: #9ca3af; font-size: 13px">
          No songs yet — click "Add song" to upload one
        </div>
      </div>
    </div>
  </div>
</template>
