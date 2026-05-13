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

// -- SAVED GENERATION MANAGEMENT --
const selectedImprovs = ref<Set<string>>(new Set())
const bulkMode = ref(false)

function cancelBulkMode() {
  bulkMode.value = false
  selectedImprovs.value.clear()
}

function toggleSelect(id: string) {
  if (selectedImprovs.value.has(id)) {
    selectedImprovs.value.delete(id)
  } else {
    selectedImprovs.value.add(id)
  }
}

function selectAll() {
  if (selectedImprovs.value.size === savedImprovs.value.length) {
    selectedImprovs.value.clear()
  } else {
    savedImprovs.value.forEach((s: any) => selectedImprovs.value.add(s.id))
  }
}

async function deleteImprov(id: string) {
  try {
    await api.delete(`/library/improvs/${id}`)
    savedImprovs.value = savedImprovs.value.filter((s: any) => s.id !== id)
  } catch (err: any) {
    console.error('Delete generation failed:', err)
  }
}

async function bulkDelete() {
  const ids = Array.from(selectedImprovs.value)
  if (ids.length === 0) return
  try {
    await api.post('/library/improvs/bulk-delete', { ids })
    savedImprovs.value = savedImprovs.value.filter((s: any) => !selectedImprovs.value.has(s.id))
    selectedImprovs.value.clear()
    bulkMode.value = false
  } catch (err: any) {
    console.error('Bulk delete failed:', err)
  }
}

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
    const rawImprov = response.data.improvSuggestion.suggestions

    // Auto-detect harmonyType if Claude didn't include it
    if (!rawImprov.harmonyType) {
      if (
        rawImprov.suggestions &&
        Array.isArray(rawImprov.suggestions) &&
        rawImprov.suggestions[0]?.type
      ) {
        rawImprov.harmonyType = 'instrument_improv'
      } else if (rawImprov.sections && rawImprov.sections[0]?.chordGuide) {
        rawImprov.harmonyType = 'vocal_chord_guide'
      } else if (rawImprov.sections && rawImprov.sections[0]?.harmonyNotes) {
        rawImprov.harmonyType = 'vocal_part'
      }
    }

    improv.value = rawImprov

    // Also fix the harmonyType in the saved version
    const savedVersion = response.data.improvSuggestion
    if (!savedVersion.suggestions.harmonyType) {
      savedVersion.suggestions.harmonyType = rawImprov.harmonyType
    }
    savedImprovs.value.unshift(savedVersion)
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

        <!-- VOCAL RESULTS (note-by-note from lead sheet) -->
        <div v-if="improv && improv.harmonyType === 'vocal_part'" style="margin-top: 1.5rem">
          <h4 style="font-size: 14px; margin-bottom: 0.6rem">
            {{ improv.performerType }} harmony for "{{ improv.songTitle }}"
          </h4>

          <HarmonyPlayer :sections="improv.sections" :tempo="analysis?.tempo" />

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

        <!-- VOCAL CHORD GUIDE RESULTS (chord-tone based) -->
        <div v-if="improv && improv.harmonyType === 'vocal_chord_guide'" style="margin-top: 1.5rem">
          <h4 style="font-size: 14px; margin-bottom: 0.6rem">
            {{ improv.performerType }} harmony guide for "{{ improv.songTitle }}"
          </h4>

          <div
            style="
              background: #eef2ff;
              border-left: 3px solid #6366f1;
              padding: 0.85rem 1rem;
              border-radius: 6px;
              margin-bottom: 1rem;
              font-size: 13px;
              color: #3730a3;
            "
          >
            <p style="font-weight: 500; margin-bottom: 0.25rem">Chord-tone harmony guide</p>
            <p style="line-height: 1.5">
              This guide shows you which notes to sing for each chord. The recommended notes are
              musically correct chord tones — you can't go wrong with them. Move smoothly between
              the suggested notes following the voice leading tips.
            </p>
          </div>

          <div
            v-for="(section, i) in improv.sections"
            :key="i"
            style="
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 1rem;
              margin-bottom: 0.8rem;
            "
          >
            <p style="font-weight: 500; font-size: 14px; margin-bottom: 0.6rem">
              {{ section.name }}
            </p>

            <div style="display: grid; gap: 0.4rem">
              <div
                v-for="(guide, j) in section.chordGuide"
                :key="j"
                style="
                  display: flex;
                  align-items: center;
                  gap: 0.8rem;
                  padding: 0.5rem 0.6rem;
                  background: #f9fafb;
                  border-radius: 6px;
                  font-size: 13px;
                "
              >
                <div style="min-width: 60px; font-weight: 600; color: #1a1a1a">
                  {{ guide.chord }}
                </div>
                <div style="min-width: 50px; text-align: center">
                  <span
                    style="
                      background: #ecfdf5;
                      color: #065f46;
                      padding: 2px 8px;
                      border-radius: 4px;
                      font-weight: 500;
                    "
                  >
                    {{ guide.harmonyNote }}{{ guide.octaveSuggestion }}
                  </span>
                </div>
                <div style="color: #6b7280; flex: 1">{{ guide.voiceLeading }}</div>
                <div style="font-size: 11px; color: #9ca3af">
                  ({{ guide.chordTones?.join(', ') }})
                </div>
              </div>
            </div>

            <p
              v-if="section.performanceNote"
              style="color: #6b7280; font-size: 12px; margin-top: 0.5rem; font-style: italic"
            >
              {{ section.performanceNote }}
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
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1rem;
            "
          >
            <h3 style="font-size: 16px">Saved generations</h3>
            <div style="display: flex; gap: 0.5rem">
              <button
                v-if="!bulkMode"
                @click="bulkMode = true"
                style="font-size: 12px; padding: 0.3rem 0.8rem; background: #f3f4f6; color: #1a1a1a"
              >
                Clean Up
              </button>
              <template v-else>
                <button
                  @click="selectAll"
                  style="
                    font-size: 12px;
                    padding: 0.3rem 0.8rem;
                    background: #f3f4f6;
                    color: #1a1a1a;
                  "
                >
                  {{ selectedImprovs.size === savedImprovs.length ? 'Deselect all' : 'Select all' }}
                </button>
                <button
                  v-if="selectedImprovs.size > 0"
                  @click="bulkDelete"
                  style="font-size: 12px; padding: 0.3rem 0.8rem; background: #dc2626"
                >
                  Delete {{ selectedImprovs.size }} selected
                </button>
                <button
                  @click="cancelBulkMode"
                  style="
                    font-size: 12px;
                    padding: 0.3rem 0.8rem;
                    background: white;
                    color: #1a1a1a;
                    border: 1px solid #d1d5db;
                  "
                >
                  Cancel
                </button>
              </template>
            </div>
          </div>

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
              @click="bulkMode ? toggleSelect(saved.id) : (saved._expanded = !saved._expanded)"
            >
              <!-- Checkbox in bulk mode -->
              <div
                v-if="bulkMode"
                style="margin-right: 0.6rem"
                @click.stop="toggleSelect(saved.id)"
              >
                <input
                  type="checkbox"
                  :checked="selectedImprovs.has(saved.id)"
                  style="width: 16px; height: 16px; cursor: pointer"
                />
              </div>
              <div>
                <p style="font-weight: 500; font-size: 14px">
                  {{ saved.instrument || saved.voiceType + ' vocals' }}
                  <span style="color: #9ca3af; font-weight: 400"> · {{ saved.style }}</span>
                </p>
                <p style="font-size: 12px; color: #9ca3af">
                  Generated {{ new Date(saved.createdAt).toLocaleDateString() }}
                </p>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem">
                <!-- Single delete (hover menu style) -->
                <div v-if="!bulkMode" class="hover-menu" @click.stop>
                  <span class="menu-trigger" style="font-size: 14px">⋯</span>
                  <div class="menu-dropdown" style="right: 0; min-width: 120px">
                    <div class="menu-item menu-item-danger" @click="deleteImprov(saved.id)">
                      🗑 Delete
                    </div>
                  </div>
                </div>
                <span style="color: #6b7280">{{ saved._expanded ? '▲' : '▼' }}</span>
              </div>
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
              <!-- Vocal chord guide version -->
              <template v-if="saved.suggestions.harmonyType === 'vocal_chord_guide'">
                <h4 style="font-size: 14px; margin-bottom: 0.6rem">
                  {{ saved.suggestions.performerType }} harmony guide for "{{
                    saved.suggestions.songTitle
                  }}"
                </h4>
                <div
                  v-for="(section, i) in saved.suggestions.sections"
                  :key="i"
                  style="
                    background: #f9fafb;
                    border-radius: 6px;
                    padding: 0.8rem;
                    margin-bottom: 0.5rem;
                  "
                >
                  <p style="font-weight: 500; font-size: 13px; margin-bottom: 0.4rem">
                    {{ section.name }}
                  </p>
                  <div
                    v-for="(guide, j) in section.chordGuide"
                    :key="j"
                    style="display: flex; gap: 0.6rem; font-size: 12px; padding: 0.2rem 0"
                  >
                    <span style="font-weight: 600; min-width: 50px">{{ guide.chord }}</span>
                    <span style="color: #065f46; font-weight: 500"
                      >{{ guide.harmonyNote }}{{ guide.octaveSuggestion }}</span
                    >
                    <span style="color: #6b7280">{{ guide.voiceLeading }}</span>
                  </div>
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
/* Hover menu */
.hover-menu {
  position: relative;
  display: inline-block;
}
.menu-trigger {
  cursor: pointer;
  color: #9ca3af;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  user-select: none;
}
.menu-trigger:hover {
  background: #e5e7eb;
  color: #6b7280;
}
.menu-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  margin-top: 4px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}
.hover-menu:hover .menu-dropdown {
  display: block;
}
.menu-item {
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
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
