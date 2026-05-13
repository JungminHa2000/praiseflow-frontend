<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import HarmonyNotation from '../components/HarmonyNotation.vue'
import HarmonyPlayer from '../components/HarmonyPlayer.vue'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const shareType = ref<'piece' | 'folder' | null>(null)
const piece = ref<any>(null)
const folder = ref<any>(null)
const selectedPiece = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    const response = await api.get(`/share/${token}`)
    shareType.value = response.data.type

    if (response.data.type === 'piece') {
      piece.value = response.data.piece
      selectedPiece.value = response.data.piece
    } else if (response.data.type === 'folder') {
      folder.value = response.data.folder
    }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || 'This share link is invalid or has expired.'
  } finally {
    isLoading.value = false
  }
})

function selectPiece(p: any) {
  selectedPiece.value = p
}

function backToFolder() {
  selectedPiece.value = null
}

function downloadAsPdf() {
  window.print()
}
</script>

<template>
  <div>
    <!-- Loading -->
    <p v-if="isLoading" style="color: #6b7280; text-align: center; padding: 3rem">
      Loading shared content...
    </p>

    <!-- Error -->
    <div v-else-if="errorMessage" style="text-align: center; padding: 3rem">
      <p style="font-size: 16px; color: #dc2626; margin-bottom: 0.5rem">Unable to load</p>
      <p style="color: #6b7280; font-size: 14px">{{ errorMessage }}</p>
    </div>

    <!-- SHARED FOLDER VIEW -->
    <template v-else-if="shareType === 'folder' && folder && !selectedPiece">
      <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0.3rem" class="no-print">
        🔗 Shared folder via PraiseFlow
      </p>
      <h2 style="margin-bottom: 1.5rem">📁 {{ folder.name }}</h2>

      <div
        v-if="folder.pieces.length === 0"
        style="text-align: center; padding: 2rem; color: #9ca3af"
      >
        This folder is empty.
      </div>

      <div v-else>
        <div
          v-for="p in folder.pieces"
          :key="p.id"
          @click="selectPiece(p)"
          style="
            background: white;
            padding: 1rem 1.25rem;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            margin-bottom: 0.6rem;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
          "
        >
          <div>
            <p style="font-weight: 500; font-size: 15px">{{ p.title }}</p>
            <p style="font-size: 12px; color: #9ca3af">
              {{ p.analysis?.keySignature || 'Not analysed' }}
              {{ p.analysis?.songTitle ? ' · ' + p.analysis.songTitle : '' }}
            </p>
          </div>
          <span style="color: #d1d5db">→</span>
        </div>
      </div>
    </template>

    <!-- SHARED PIECE VIEW (single piece or selected from folder) -->
    <template v-else-if="selectedPiece">
      <span
        v-if="shareType === 'folder'"
        @click="backToFolder"
        style="
          cursor: pointer;
          color: #6b7280;
          font-size: 14px;
          display: inline-block;
          margin-bottom: 1rem;
        "
        class="no-print"
      >
        ← Back to folder
      </span>

      <div style="margin-bottom: 1.5rem">
        <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0.3rem" class="no-print">
          🔗 Shared via PraiseFlow
        </p>
        <h2>{{ selectedPiece.title }}</h2>
      </div>

      <!-- Original file viewer -->
      <div
        v-if="selectedPiece.fileUrl"
        style="
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
        "
      >
        <h3 style="font-size: 16px; margin-bottom: 1rem">Sheet music</h3>
        <img
          v-if="selectedPiece.fileType?.startsWith('image/')"
          :src="`http://localhost:3000/${selectedPiece.fileUrl}`"
          style="max-width: 100%; border-radius: 6px; border: 1px solid #e5e7eb"
          alt="Sheet music"
        />
        <iframe
          v-else-if="selectedPiece.fileType === 'application/pdf'"
          :src="`http://localhost:3000/${selectedPiece.fileUrl}`"
          style="width: 100%; height: 600px; border: 1px solid #e5e7eb; border-radius: 6px"
        ></iframe>
      </div>

      <!-- Analysis -->
      <div
        v-if="selectedPiece.analysis"
        style="
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
        "
      >
        <h3 style="font-size: 16px; margin-bottom: 0.8rem">Analysis</h3>
        <div
          style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 2rem; font-size: 14px"
        >
          <p><strong>Song:</strong> {{ selectedPiece.analysis.songTitle || 'Unknown' }}</p>
          <p><strong>Key:</strong> {{ selectedPiece.analysis.keySignature }}</p>
          <p><strong>Time:</strong> {{ selectedPiece.analysis.timeSignature }}</p>
          <p><strong>Tempo:</strong> {{ selectedPiece.analysis.tempo || 'Not marked' }}</p>
        </div>
      </div>

      <!-- Improv suggestions -->
      <div
        v-if="selectedPiece.improvSuggestions && selectedPiece.improvSuggestions.length > 0"
        style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb"
      >
        <div
          v-for="(suggestion, idx) in selectedPiece.improvSuggestions"
          :key="idx"
          style="margin-bottom: 2rem"
        >
          <!-- Instrument version -->
          <template v-if="suggestion.suggestions.harmonyType === 'instrument_improv'">
            <h4 style="font-size: 14px; margin-bottom: 0.6rem">
              Suggestions for {{ suggestion.suggestions.performerType }}
            </h4>
            <div
              v-for="(s, i) in suggestion.suggestions.suggestions"
              :key="i"
              style="
                border: 1px solid #e5e7eb;
                padding: 0.9rem;
                border-radius: 6px;
                margin-bottom: 0.6rem;
                font-size: 13px;
              "
            >
              <p style="font-weight: 500">
                {{ s.section }} — {{ s.type }}
                <span
                  style="
                    font-size: 11px;
                    padding: 1px 8px;
                    border-radius: 99px;
                    background: #f3f4f6;
                    color: #6b7280;
                    margin-left: 6px;
                  "
                >
                  {{ s.difficulty }}
                </span>
              </p>
              <p style="color: #1a1a1a; margin-top: 0.4rem">{{ s.description }}</p>
            </div>
            <p
              style="
                background: #fffbeb;
                padding: 0.9rem;
                border-radius: 6px;
                border-left: 3px solid #f59e0b;
                font-size: 13px;
                margin-top: 1rem;
              "
            >
              <strong>Advice:</strong> {{ suggestion.suggestions.generalAdvice }}
            </p>
          </template>

          <!-- Vocal version -->
          <template v-if="suggestion.suggestions.harmonyType === 'vocal_part'">
            <h4 style="font-size: 14px; margin-bottom: 0.6rem">
              {{ suggestion.suggestions.performerType }} harmony for "{{
                suggestion.suggestions.songTitle
              }}"
            </h4>
            <HarmonyPlayer
              :sections="suggestion.suggestions.sections"
              :tempo="selectedPiece.analysis?.tempo"
            />
            <div v-for="(section, i) in suggestion.suggestions.sections" :key="i">
              <HarmonyNotation
                :section-name="section.name"
                :harmony-notes="section.harmonyNotes"
                :key-signature="selectedPiece.analysis?.keySignature"
                :time-signature="selectedPiece.analysis?.timeSignature"
              />
              <p style="color: #6b7280; font-size: 12px; margin: -0.3rem 0 0.8rem 1rem">
                <em>{{ section.performanceNote }}</em>
              </p>
            </div>
            <p
              style="
                background: #fffbeb;
                padding: 0.9rem;
                border-radius: 6px;
                border-left: 3px solid #f59e0b;
                font-size: 13px;
                margin-top: 1rem;
              "
            >
              <strong>Advice:</strong> {{ suggestion.suggestions.generalAdvice }}
            </p>
          </template>
        </div>

        <button @click="downloadAsPdf" class="no-print" style="background: #1a1a1a">
          📄 Download as PDF
        </button>
      </div>
    </template>
  </div>
</template>

<style>
@media print {
  .no-print,
  .no-print * {
    display: none !important;
  }
  header,
  nav {
    display: none !important;
  }
  body {
    background: white !important;
  }
  #app {
    max-width: 100% !important;
    padding: 0.4in !important;
    margin: 0 !important;
  }
  div {
    background: white !important;
    box-shadow: none !important;
  }
  svg {
    page-break-inside: avoid;
  }
}
</style>
