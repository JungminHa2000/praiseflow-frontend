<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'
import HarmonyNotation from '../components/HarmonyNotation.vue'

const route = useRoute()
const token = route.params.token as string

const piece = ref<any>(null)
const isLoading = ref(true)
const errorMessage = ref('')

// Load the shared piece when the page opens.
// This calls the public endpoint — no auth token needed.
onMounted(async () => {
  try {
    const response = await api.get(`/share/${token}`)
    piece.value = response.data.piece
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || 'This share link is invalid or has expired.'
  } finally {
    isLoading.value = false
  }
})

function downloadAsPdf() {
  window.print()
}
</script>

<template>
  <div>
    <!-- Loading -->
    <p v-if="isLoading" style="color: #6b7280; text-align: center; padding: 3rem">
      Loading shared song...
    </p>

    <!-- Error -->
    <div v-else-if="errorMessage" style="text-align: center; padding: 3rem">
      <p style="font-size: 16px; color: #dc2626; margin-bottom: 0.5rem">Unable to load</p>
      <p style="color: #6b7280; font-size: 14px">{{ errorMessage }}</p>
    </div>

    <!-- Shared piece content -->
    <template v-else-if="piece">
      <div style="margin-bottom: 1.5rem">
        <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0.3rem" class="no-print">
          🔗 Shared with you via PraiseFlow
        </p>
        <h2>{{ piece.title }}</h2>
      </div>

      <!-- Analysis -->
      <div
        v-if="piece.analysis"
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
          <p><strong>Song:</strong> {{ piece.analysis.songTitle || 'Unknown' }}</p>
          <p><strong>Key:</strong> {{ piece.analysis.keySignature }}</p>
          <p><strong>Time:</strong> {{ piece.analysis.timeSignature }}</p>
          <p><strong>Tempo:</strong> {{ piece.analysis.tempo || 'Not marked' }}</p>
        </div>
      </div>

      <!-- Improv suggestions (show the most recent one) -->
      <div
        v-if="piece.improvSuggestions && piece.improvSuggestions.length > 0"
        style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb"
      >
        <div
          v-for="(suggestion, idx) in piece.improvSuggestions"
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
            <div v-for="(section, i) in suggestion.suggestions.sections" :key="i">
              <HarmonyNotation
                :section-name="section.name"
                :harmony-notes="section.harmonyNotes"
                :key-signature="piece.analysis?.keySignature"
                :time-signature="piece.analysis?.timeSignature"
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
