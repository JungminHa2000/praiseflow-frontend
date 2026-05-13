<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import HarmonyNotation from '../components/HarmonyNotation.vue'
import HarmonyPlayer from '../components/HarmonyPlayer.vue'

const route = useRoute()
const router = useRouter()

const pieceId = route.params.id as string

// -- PIECE STATE --
const piece = ref<any>(null)
const analysis = ref<any>(null)
const isLoading = ref(true)
const isAnalysing = ref(false)
const analysisError = ref('')

// -- IMPROV STATE --
const performerType = ref<'instrument' | 'voice'>('instrument')
const instrument = ref('keyboard')
const voiceType = ref('alto')
const isGeneratingImprov = ref(false)
const improv = ref<any>(null)
const improvError = ref('')

// -- FILE VIEWER STATE --
const showOriginal = ref(false)

// -- SHARE STATE --
const shareUrl = ref('')
const isSharing = ref(false)
const showShareLink = ref(false)

// -- SAVED IMPROVS --
const savedImprovs = ref<any[]>([])

// -- LOAD PIECE DATA --
onMounted(async () => {
  try {
    const response = await api.get(`/pieces/${pieceId}`)
    piece.value = response.data.piece
    analysis.value = response.data.piece.analysis || null
    savedImprovs.value = response.data.piece.improvSuggestions || []
  } catch (err: any) {
    console.error('Failed to load piece:', err)
  } finally {
    isLoading.value = false
  }
})

async function handleAnalyse() {
  isAnalysing.value = true
  analysisError.value = ''

  try {
    const response = await api.post('/analyse', { pieceId })
    analysis.value = response.data.analysis
  } catch (err: any) {
    analysisError.value = err.response?.data?.error || 'Analysis failed'
  } finally {
    isAnalysing.value = false
  }
}

const showDuplicateWarning = ref(false)
const duplicateMessage = ref('')

async function handleGenerateImprov() {
  if (!analysis.value) return

  // Check if there's already a saved generation for this instrument/voice
  const existingImprov = savedImprovs.value.find((s) => {
    if (performerType.value === 'instrument') {
      return s.instrument === instrument.value
    } else {
      return s.voiceType === voiceType.value
    }
  })

  // If a duplicate exists and user hasn't confirmed yet, show warning
  if (existingImprov && !showDuplicateWarning.value) {
    const label =
      performerType.value === 'instrument' ? instrument.value : voiceType.value + ' vocals'
    duplicateMessage.value = `You already have a ${label} generation for this song. Generate a new version? The previous one will be kept in your saved generations.`
    showDuplicateWarning.value = true
    return
  }

  // Reset the warning state
  showDuplicateWarning.value = false
  duplicateMessage.value = ''

  isGeneratingImprov.value = true
  improvError.value = ''
  improv.value = null

  const body: any = { pieceId }
  if (performerType.value === 'instrument') {
    body.instrument = instrument.value
  } else {
    body.voiceType = voiceType.value
  }

  try {
    const response = await api.post('/improv', body)
    improv.value = response.data.improvSuggestion.suggestions
    savedImprovs.value.unshift(response.data.improvSuggestion)
  } catch (err: any) {
    improvError.value =
      err.response?.data?.reason || err.response?.data?.error || 'Generation failed'
  } finally {
    isGeneratingImprov.value = false
  }
}

function cancelDuplicate() {
  showDuplicateWarning.value = false
  duplicateMessage.value = ''
}

async function handleShare() {
  isSharing.value = true
  try {
    const response = await api.post('/share', { pieceId })
    const token = response.data.shareLink.token
    shareUrl.value = `${window.location.origin}/shared/${token}`
    showShareLink.value = true
  } catch (err: any) {
    console.error('Share failed:', err)
  } finally {
    isSharing.value = false
  }
}

function copyShareLink() {
  navigator.clipboard.writeText(shareUrl.value)
}

function downloadAsPdf() {
  window.print()
}
</script>

<template>
  <div>
    <!-- Back button -->
    <span
      @click="router.push('/')"
      style="
        cursor: pointer;
        color: #6b7280;
        font-size: 14px;
        display: inline-block;
        margin-bottom: 1rem;
      "
      class="no-print"
      >← Back to library</span
    >

    <!-- Loading -->
    <p v-if="isLoading" style="color: #6b7280">Loading...</p>

    <div v-else-if="piece">
      <!-- Song header with share button -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        "
      >
        <div>
          <h2>{{ piece.title }}</h2>
          <p style="color: #6b7280; font-size: 14px">
            Uploaded {{ new Date(piece.createdAt).toLocaleDateString() }} ·
            {{ piece.fileType === 'application/pdf' ? 'PDF' : 'Image' }}
          </p>
        </div>
        <button
          @click="handleShare"
          :disabled="isSharing"
          class="no-print"
          style="font-size: 13px; padding: 0.4rem 0.8rem"
        >
          {{ isSharing ? 'Creating link...' : '🔗 Share' }}
        </button>
      </div>

      <!-- Share link display -->
      <div
        v-if="showShareLink"
        style="
          background: #ecfdf5;
          border: 1px solid #6ee7b7;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 13px;
        "
        class="no-print"
      >
        <p style="font-weight: 500; color: #065f46; margin-bottom: 0.5rem">
          ✓ Share link created (expires in 30 days)
        </p>
        <div style="display: flex; gap: 0.5rem; align-items: center">
          <input :value="shareUrl" readonly style="flex: 1; background: white; font-size: 12px" />
          <button @click="copyShareLink" style="font-size: 12px; padding: 0.4rem 0.8rem">
            Copy
          </button>
        </div>
      </div>

      <!-- Original sheet music viewer -->
      <div
        style="
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
        "
      >
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h3 style="font-size: 16px">Original sheet music</h3>
          <button
            @click="showOriginal = !showOriginal"
            style="font-size: 12px; padding: 0.3rem 0.8rem; background: #f3f4f6; color: #1a1a1a"
            class="no-print"
          >
            {{ showOriginal ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div v-if="showOriginal">
          <img
            v-if="piece.fileType.startsWith('image/')"
            :src="`http://localhost:3000/${piece.fileUrl}`"
            style="max-width: 100%; border-radius: 6px; border: 1px solid #e5e7eb"
            alt="Original sheet music"
          />
          <iframe
            v-else-if="piece.fileType === 'application/pdf'"
            :src="`http://localhost:3000/${piece.fileUrl}`"
            style="width: 100%; height: 600px; border: 1px solid #e5e7eb; border-radius: 6px"
          ></iframe>
        </div>
      </div>

      <!-- Analysis section -->
      <div
        style="
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 1.5rem;
        "
      >
        <div v-if="!analysis">
          <h3 style="font-size: 16px; margin-bottom: 0.5rem" class="no-print">Analysis</h3>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 1rem" class="no-print">
            Run AI analysis to extract the key, chords, and structure from your sheet music.
          </p>
          <button @click="handleAnalyse" :disabled="isAnalysing" class="no-print">
            {{ isAnalysing ? 'Analysing... (10–20 sec)' : 'Analyse with AI' }}
          </button>
          <p v-if="analysisError" style="color: #dc2626; margin-top: 1rem; font-size: 14px">
            {{ analysisError }}
          </p>
        </div>

        <div v-else style="font-size: 14px">
          <h3 style="font-size: 16px; margin-bottom: 0.8rem">Analysis</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 2rem">
            <p><strong>Song:</strong> {{ analysis.songTitle || 'Unknown' }}</p>
            <p><strong>Key:</strong> {{ analysis.keySignature }}</p>
            <p><strong>Time:</strong> {{ analysis.timeSignature }}</p>
            <p><strong>Tempo:</strong> {{ analysis.tempo || 'Not marked' }}</p>
            <p><strong>Type:</strong> {{ analysis.chartType }}</p>
            <p><strong>Melody known:</strong> {{ analysis.melodyRecognised ? 'Yes' : 'No' }}</p>
          </div>
        </div>
      </div>

      <!-- Improv / Harmony section -->
      <div
        v-if="analysis"
        style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb"
      >
        <!-- Controls (hidden in print) -->
        <div class="no-print">
          <h3 style="font-size: 16px; margin-bottom: 1rem">Generate improv or harmony</h3>

          <div style="display: flex; gap: 1rem; margin-bottom: 1rem">
            <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 14px">
              <input type="radio" value="instrument" v-model="performerType" style="width: auto" />
              Instrument
            </label>
            <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 14px">
              <input type="radio" value="voice" v-model="performerType" style="width: auto" />
              Voice
            </label>
          </div>

          <div v-if="performerType === 'instrument'" style="margin-bottom: 1rem">
            <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px"
              >Instrument</label
            >
            <select v-model="instrument">
              <option value="keyboard">Keyboard</option>
              <option value="acoustic guitar">Acoustic guitar</option>
              <option value="electric guitar">Electric guitar</option>
              <option value="bass guitar">Bass guitar</option>
              <option value="drums">Drums</option>
              <option value="violin">Violin</option>
              <option value="saxophone">Saxophone</option>
            </select>
          </div>

          <div v-if="performerType === 'voice'" style="margin-bottom: 1rem">
            <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px"
              >Voice type</label
            >
            <select v-model="voiceType">
              <option value="soprano">Soprano</option>
              <option value="alto">Alto</option>
              <option value="tenor">Tenor</option>
              <option value="bass">Bass</option>
            </select>
          </div>

          <button @click="handleGenerateImprov" :disabled="isGeneratingImprov">
            {{ isGeneratingImprov ? 'Generating... (20–30 sec)' : 'Generate' }}
          </button>

          <p v-if="improvError" style="color: #dc2626; margin-top: 1rem; font-size: 14px">
            {{ improvError }}
          </p>
          <!-- Duplicate warning -->
          <div
            v-if="showDuplicateWarning"
            style="
              background: #fef3c7;
              border-left: 3px solid #f59e0b;
              padding: 1rem;
              border-radius: 6px;
              margin-top: 1rem;
              font-size: 13px;
              color: #78350f;
            "
          >
            <p style="margin-bottom: 0.75rem">{{ duplicateMessage }}</p>
            <div style="display: flex; gap: 0.5rem">
              <button
                @click="handleGenerateImprov"
                style="font-size: 12px; padding: 0.4rem 0.8rem; background: #1a1a1a"
              >
                Yes, generate new version
              </button>
              <button
                @click="cancelDuplicate"
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
        </div>

        <!-- INSTRUMENT RESULTS -->
        <div v-if="improv && improv.harmonyType === 'instrument_improv'" style="margin-top: 1.5rem">
          <h4 style="font-size: 14px; margin-bottom: 0.6rem">
            Suggestions for {{ improv.performerType }}
          </h4>
          <div
            v-for="(s, i) in improv.suggestions"
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
            <p style="color: #6b7280; margin-top: 0.4rem; font-size: 12px">
              <em>{{ s.rationale }}</em>
            </p>
          </div>

          <button
            @click="downloadAsPdf"
            class="no-print"
            style="margin-top: 1rem; background: #1a1a1a"
          >
            📄 Download as PDF
          </button>

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
            <strong>Advice:</strong> {{ improv.generalAdvice }}
          </p>
        </div>

        <!-- VOCAL RESULTS -->
        <div v-if="improv && improv.harmonyType === 'vocal_part'" style="margin-top: 1.5rem">
          <h4 style="font-size: 14px; margin-bottom: 0.6rem">
            {{ improv.performerType }} harmony for "{{ improv.songTitle }}"
          </h4>

          <!-- Audio playback -->
          <HarmonyPlayer :sections="improv.sections" :tempo="analysis?.tempo" />

          <!-- Accuracy notice... -->

          <div
            v-if="analysis?.chartType === 'chord_chart'"
            style="
              background: #fef3c7;
              border-left: 3px solid #f59e0b;
              padding: 0.85rem 1rem;
              border-radius: 6px;
              margin-bottom: 1rem;
              font-size: 13px;
              color: #78350f;
            "
          >
            <p style="font-weight: 500; margin-bottom: 0.25rem">
              ⚠ Heads up — generated from a chord chart
            </p>
            <p style="line-height: 1.5">
              This harmony was inferred from a chord chart, which means note durations and exact
              pitches may not perfectly match the original recording. For more accurate output,
              upload a
              <strong>lead sheet</strong> with the melody on a music staff.
            </p>
          </div>

          <div v-for="(section, i) in improv.sections" :key="i">
            <HarmonyNotation
              :section-name="section.name"
              :harmony-notes="section.harmonyNotes"
              :key-signature="analysis?.keySignature"
              :time-signature="analysis?.timeSignature"
            />
            <p style="color: #6b7280; font-size: 12px; margin: -0.3rem 0 0.8rem 1rem">
              <em>{{ section.performanceNote }}</em>
            </p>
          </div>

          <button
            @click="downloadAsPdf"
            class="no-print"
            style="margin-top: 1rem; background: #1a1a1a"
          >
            📄 Download as PDF
          </button>

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
            <strong>Advice:</strong> {{ improv.generalAdvice }}
          </p>
        </div>
        <!-- SAVED GENERATIONS -->
        <div
          v-if="savedImprovs.length > 0"
          style="
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            margin-top: 1.5rem;
          "
        >
          <h3 style="font-size: 16px; margin-bottom: 1rem">Saved generations</h3>

          <div v-for="(saved, idx) in savedImprovs" :key="saved.id" style="margin-bottom: 1.5rem">
            <!-- Header for each saved generation -->
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                background: #f9fafb;
                border-radius: 6px;
                cursor: pointer;
                margin-bottom: 0.5rem;
              "
              @click="saved._expanded = !saved._expanded"
            >
              <div>
                <p style="font-weight: 500; font-size: 14px">
                  {{ saved.instrument || saved.voiceType + ' vocals' }}
                  <span style="color: #9ca3af; font-weight: 400"> · {{ saved.style }}</span>
                </p>
                <p style="font-size: 12px; color: #9ca3af">
                  Generated {{ new Date(saved.createdAt).toLocaleDateString() }}
                </p>
              </div>
              <span style="color: #6b7280">{{ saved._expanded ? '▲' : '▼' }}</span>
            </div>

            <!-- Expanded content -->
            <div v-if="saved._expanded">
              <!-- Instrument version -->
              <template v-if="saved.suggestions.harmonyType === 'instrument_improv'">
                <div
                  v-for="(s, i) in saved.suggestions.suggestions"
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
                  <p style="color: #6b7280; margin-top: 0.4rem; font-size: 12px">
                    <em>{{ s.rationale }}</em>
                  </p>
                </div>
                <p
                  style="
                    background: #fffbeb;
                    padding: 0.9rem;
                    border-radius: 6px;
                    border-left: 3px solid #f59e0b;
                    font-size: 13px;
                    margin-top: 0.5rem;
                  "
                >
                  <strong>Advice:</strong> {{ saved.suggestions.generalAdvice }}
                </p>
              </template>

              <!-- Vocal version -->
              <template v-if="saved.suggestions.harmonyType === 'vocal_part'">
                <HarmonyPlayer :sections="saved.suggestions.sections" :tempo="analysis?.tempo" />
                <div v-for="(section, i) in saved.suggestions.sections" :key="i">
                  <HarmonyNotation
                    :section-name="section.name"
                    :harmony-notes="section.harmonyNotes"
                    :key-signature="analysis?.keySignature"
                    :time-signature="analysis?.timeSignature"
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
                    margin-top: 0.5rem;
                  "
                >
                  <strong>Advice:</strong> {{ saved.suggestions.generalAdvice }}
                </p>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    color: black !important;
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
