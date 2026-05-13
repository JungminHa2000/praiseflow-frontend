<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const folders = ref<any[]>([])
const isLoading = ref(true)
const newFolderName = ref('')
const showNewFolder = ref(false)

const shareFolderUrl = ref('')
const sharingFolderId = ref('')

const searchQuery = ref('')
const confirmDeleteFolder = ref('')
const confirmDeletePiece = ref('')

// -- RENAME STATE --
const renamingFolderId = ref('')
const renamingPieceId = ref('')
const renameValue = ref('')

// -- COPY/MOVE STATE --
const clipboardPiece = ref<any>(null)
const clipboardAction = ref<'copy' | 'move' | null>(null)
const clipboardSourceFolderId = ref('')

const filteredFolders = computed(() => {
  if (!searchQuery.value.trim()) return folders.value

  const query = searchQuery.value.toLowerCase()
  return folders.value
    .map((folder) => {
      const folderNameMatch = folder.name.toLowerCase().includes(query)
      const matchingPieces = folder.pieces.filter((p: any) => {
        const titleMatch = p.title.toLowerCase().includes(query)
        const songMatch = p.analysis?.songTitle?.toLowerCase().includes(query)
        return titleMatch || songMatch
      })

      if (folderNameMatch) return folder
      if (matchingPieces.length > 0) return { ...folder, pieces: matchingPieces }
      return null
    })
    .filter(Boolean)
})

if (!auth.isLoggedIn) {
  router.push('/auth')
}

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
    const response = await api.post('/library/folders', { name: newFolderName.value.trim() })
    folders.value.push({ ...response.data.folder, pieces: [] })
    newFolderName.value = ''
    showNewFolder.value = false
  } catch (err: any) {
    console.error('Failed to create folder:', err)
  }
}

async function deleteFolder(folderId: string) {
  try {
    await api.delete(`/library/folders/${folderId}`)
    folders.value = folders.value.filter((f) => f.id !== folderId)
    confirmDeleteFolder.value = ''
  } catch (err: any) {
    console.error('Delete folder failed:', err)
  }
}

async function deletePiece(folderId: string, pieceId: string) {
  try {
    await api.delete(`/library/pieces/${pieceId}`)
    const folder = folders.value.find((f) => f.id === folderId)
    if (folder) {
      folder.pieces = folder.pieces.filter((p: any) => p.id !== pieceId)
    }
    confirmDeletePiece.value = ''
  } catch (err: any) {
    console.error('Delete piece failed:', err)
  }
}

async function renameFolder(folderId: string) {
  if (!renameValue.value.trim()) return
  try {
    await api.patch(`/library/folders/${folderId}`, { name: renameValue.value.trim() })
    const folder = folders.value.find((f) => f.id === folderId)
    if (folder) folder.name = renameValue.value.trim()
    renamingFolderId.value = ''
    renameValue.value = ''
  } catch (err: any) {
    console.error('Rename folder failed:', err)
  }
}

async function renamePiece(folderId: string, pieceId: string) {
  if (!renameValue.value.trim()) return
  try {
    await api.patch(`/library/pieces/${pieceId}/rename`, { title: renameValue.value.trim() })
    const folder = folders.value.find((f) => f.id === folderId)
    if (folder) {
      const piece = folder.pieces.find((p: any) => p.id === pieceId)
      if (piece) piece.title = renameValue.value.trim()
    }
    renamingPieceId.value = ''
    renameValue.value = ''
  } catch (err: any) {
    console.error('Rename piece failed:', err)
  }
}

function startRenameFolder(folder: any) {
  renamingFolderId.value = folder.id
  renameValue.value = folder.name
  renamingPieceId.value = ''
}

function startRenamePiece(piece: any) {
  renamingPieceId.value = piece.id
  renameValue.value = piece.title
  renamingFolderId.value = ''
}

function startCopy(piece: any, folderId: string) {
  clipboardPiece.value = piece
  clipboardAction.value = 'copy'
  clipboardSourceFolderId.value = folderId
}

function startMove(piece: any, folderId: string) {
  clipboardPiece.value = piece
  clipboardAction.value = 'move'
  clipboardSourceFolderId.value = folderId
}

function cancelClipboard() {
  clipboardPiece.value = null
  clipboardAction.value = null
  clipboardSourceFolderId.value = ''
}

async function pasteToFolder(targetFolderId: string) {
  if (!clipboardPiece.value || !clipboardAction.value) return
  try {
    if (clipboardAction.value === 'copy') {
      const response = await api.post(`/library/pieces/${clipboardPiece.value.id}/copy`, {
        targetFolderId,
      })
      const targetFolder = folders.value.find((f) => f.id === targetFolderId)
      if (targetFolder) targetFolder.pieces.unshift(response.data.piece)
    } else if (clipboardAction.value === 'move') {
      await api.patch(`/library/pieces/${clipboardPiece.value.id}/move`, { targetFolderId })
      const sourceFolder = folders.value.find((f) => f.id === clipboardSourceFolderId.value)
      if (sourceFolder) {
        sourceFolder.pieces = sourceFolder.pieces.filter(
          (p: any) => p.id !== clipboardPiece.value.id,
        )
      }
      const targetFolder = folders.value.find((f) => f.id === targetFolderId)
      if (targetFolder) {
        clipboardPiece.value.folderId = targetFolderId
        targetFolder.pieces.unshift(clipboardPiece.value)
      }
    }
    cancelClipboard()
  } catch (err: any) {
    console.error(`${clipboardAction.value} failed:`, err)
  }
}

function startDeleteFolder(folderId: string) {
  confirmDeleteFolder.value = folderId
}

function startDeletePiece(pieceId: string) {
  confirmDeletePiece.value = pieceId
}

async function shareFolder(folderId: string) {
  try {
    const response = await api.post('/share', { folderId })
    const token = response.data.shareLink.token
    shareFolderUrl.value = `${window.location.origin}/shared/${token}`
    sharingFolderId.value = folderId
  } catch (err: any) {
    console.error('Share failed:', err)
  }
}

function copyFolderLink() {
  navigator.clipboard.writeText(shareFolderUrl.value)
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
      <h2>Collections</h2>
      <button @click="showNewFolder = !showNewFolder" style="font-size: 13px">
        {{ showNewFolder ? 'Cancel' : '+ New folder' }}
      </button>
    </div>

    <!-- Search bar -->
    <div style="margin-bottom: 1rem">
      <input
        v-model="searchQuery"
        placeholder="Search folders and songs..."
        style="
          width: 100%;
          padding: 0.7rem 1rem;
          font-size: 14px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
        "
      />
    </div>

    <!-- Clipboard banner -->
    <div
      v-if="clipboardPiece"
      style="
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
      "
    >
      <p style="color: #3730a3">
        <strong>{{ clipboardAction === 'copy' ? '📋 Copying' : '✂️ Moving' }}:</strong>
        "{{ clipboardPiece.title }}" — click <strong>Paste here</strong> on the destination folder
      </p>
      <button
        @click="cancelClipboard"
        style="
          font-size: 12px;
          padding: 0.3rem 0.6rem;
          background: white;
          color: #1a1a1a;
          border: 1px solid #d1d5db;
        "
      >
        Cancel
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

    <!-- Loading -->
    <p v-if="isLoading" style="color: #6b7280">Loading your library...</p>

    <!-- Empty -->
    <div
      v-else-if="filteredFolders.length === 0"
      style="text-align: center; padding: 3rem; color: #6b7280"
    >
      <p style="font-size: 16px; margin-bottom: 0.5rem">No folders yet</p>
      <p style="font-size: 14px">Create a folder to start organising your music.</p>
    </div>

    <!-- Folder list -->
    <div v-else>
      <div
        v-for="folder in filteredFolders"
        :key="folder.id"
        style="
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
          overflow: visible;
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
          <div style="flex: 1">
            <div
              v-if="renamingFolderId === folder.id"
              style="display: flex; gap: 0.4rem; align-items: center"
              @click.stop
            >
              <input
                v-model="renameValue"
                @keyup.enter="renameFolder(folder.id)"
                style="font-size: 14px; padding: 0.3rem 0.5rem; width: 200px"
              />
              <button
                @click="renameFolder(folder.id)"
                style="font-size: 11px; padding: 0.3rem 0.5rem"
              >
                Save
              </button>
              <button
                @click="renamingFolderId = ''"
                style="
                  font-size: 11px;
                  padding: 0.3rem 0.5rem;
                  background: white;
                  color: #1a1a1a;
                  border: 1px solid #d1d5db;
                "
              >
                Cancel
              </button>
            </div>
            <div v-else>
              <p style="font-weight: 500; font-size: 15px">📁 {{ folder.name }}</p>
              <p style="font-size: 12px; color: #9ca3af">
                {{ folder.pieces.length }} {{ folder.pieces.length === 1 ? 'song' : 'songs' }}
              </p>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem">
            <button
              v-if="clipboardPiece && folder.id !== clipboardSourceFolderId"
              @click.stop="pasteToFolder(folder.id)"
              style="font-size: 12px; padding: 0.4rem 0.8rem; background: #4f46e5; color: white"
            >
              📋 Paste here
            </button>

            <button
              @click.stop="goToUpload(folder.id)"
              style="font-size: 12px; padding: 0.4rem 0.8rem"
            >
              + Add song
            </button>

            <!-- Folder hover menu -->
            <div class="hover-menu" @click.stop>
              <span class="menu-trigger">⋯</span>
              <div class="menu-dropdown">
                <div class="menu-item" @click="shareFolder(folder.id)">🔗 Share folder</div>
                <div class="menu-item" @click="startRenameFolder(folder)">✏️ Rename</div>
                <div class="menu-item menu-item-danger" @click="startDeleteFolder(folder.id)">
                  🗑 Delete folder
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Folder delete confirmation -->
        <div
          v-if="confirmDeleteFolder === folder.id"
          style="
            padding: 0.75rem 1.25rem;
            background: #fef2f2;
            border-bottom: 1px solid #fecaca;
            font-size: 13px;
          "
        >
          <p style="color: #991b1b; margin-bottom: 0.5rem">
            Delete "{{ folder.name }}" and all {{ folder.pieces.length }} songs inside? This cannot
            be undone.
          </p>
          <div style="display: flex; gap: 0.5rem">
            <button
              @click="deleteFolder(folder.id)"
              style="font-size: 12px; padding: 0.4rem 0.8rem; background: #dc2626"
            >
              Yes, delete
            </button>
            <button
              @click="confirmDeleteFolder = ''"
              style="
                font-size: 12px;
                padding: 0.4rem 0.8rem;
                background: white;
                color: #1a1a1a;
                border: 1px solid #d1d5db;
              "
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Folder share link -->
        <div
          v-if="sharingFolderId === folder.id && shareFolderUrl"
          style="
            padding: 0.75rem 1.25rem;
            background: #ecfdf5;
            border-bottom: 1px solid #6ee7b7;
            font-size: 13px;
          "
        >
          <p style="font-weight: 500; color: #065f46; margin-bottom: 0.4rem">
            ✓ Folder share link (expires in 30 days)
          </p>
          <div style="display: flex; gap: 0.5rem; align-items: center">
            <input
              :value="shareFolderUrl"
              readonly
              style="flex: 1; background: white; font-size: 12px"
            />
            <button @click="copyFolderLink" style="font-size: 12px; padding: 0.3rem 0.6rem">
              Copy
            </button>
          </div>
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
              position: relative;
            "
          >
            <!-- Song name / rename -->
            <div style="flex: 1">
              <div
                v-if="renamingPieceId === piece.id"
                style="display: flex; gap: 0.4rem; align-items: center"
                @click.stop
              >
                <input
                  v-model="renameValue"
                  @keyup.enter="renamePiece(folder.id, piece.id)"
                  style="font-size: 13px; padding: 0.2rem 0.5rem; width: 200px"
                />
                <button
                  @click="renamePiece(folder.id, piece.id)"
                  style="font-size: 11px; padding: 0.2rem 0.5rem"
                >
                  Save
                </button>
                <button
                  @click="renamingPieceId = ''"
                  style="
                    font-size: 11px;
                    padding: 0.2rem 0.5rem;
                    background: white;
                    color: #1a1a1a;
                    border: 1px solid #d1d5db;
                  "
                >
                  Cancel
                </button>
              </div>
              <div v-else style="cursor: pointer" @click="router.push(`/piece/${piece.id}`)">
                <p style="font-size: 14px; font-weight: 500">{{ piece.title }}</p>
                <p style="font-size: 12px; color: #9ca3af">
                  {{ piece.analysis?.keySignature || 'Not analysed' }}
                  {{ piece.analysis?.songTitle ? ' · ' + piece.analysis.songTitle : '' }}
                </p>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem">
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

              <!-- Piece hover menu -->
              <div class="hover-menu" @click.stop>
                <span class="menu-trigger">⋯</span>
                <div class="menu-dropdown menu-dropdown-up">
                  <div class="menu-item" @click="startRenamePiece(piece)">✏️ Rename</div>
                  <div class="menu-item" @click="startCopy(piece, folder.id)">📋 Copy to...</div>
                  <div class="menu-item" @click="startMove(piece, folder.id)">✂️ Move to...</div>
                  <div class="menu-item menu-item-danger" @click="startDeletePiece(piece.id)">
                    🗑 Delete
                  </div>
                </div>
              </div>

              <!-- Delete confirmation -->
              <div
                v-if="confirmDeletePiece === piece.id"
                style="display: flex; gap: 0.3rem"
                @click.stop
              >
                <button
                  @click="deletePiece(folder.id, piece.id)"
                  style="font-size: 11px; padding: 0.2rem 0.5rem; background: #dc2626"
                >
                  Delete
                </button>
                <button
                  @click="confirmDeletePiece = ''"
                  style="
                    font-size: 11px;
                    padding: 0.2rem 0.5rem;
                    background: white;
                    color: #1a1a1a;
                    border: 1px solid #d1d5db;
                  "
                >
                  Cancel
                </button>
              </div>

              <span
                style="color: #d1d5db; cursor: pointer"
                @click="router.push(`/piece/${piece.id}`)"
                >→</span
              >
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

<style scoped>
/* Hover menu container */
.hover-menu {
  position: relative;
  display: inline-block;
}

/* The trigger text */
.menu-trigger {
  cursor: pointer;
  font-size: 16px;
  color: #9ca3af;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  user-select: none;
  line-height: 1;
}

.menu-trigger:hover {
  background: #f3f4f6;
  color: #6b7280;
}

/* The dropdown — hidden by default, shown on hover */
.menu-dropdown {
  display: none;
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 170px;
  z-index: 1000;
  overflow: hidden;
}

/* For songs near the bottom, open the menu upward */
.menu-dropdown-up {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 4px;
}

/* Show menu on hover OR when the trigger is clicked/focused */
.hover-menu:hover .menu-dropdown,
.hover-menu:focus-within .menu-dropdown {
  display: block;
}

/* Menu items */
.menu-item {
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: #f9fafb;
}

.menu-item-danger {
  color: #dc2626;
}

.menu-item-danger:hover {
  background: #fef2f2;
}
</style>
