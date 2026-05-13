<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../lib/api'
import { useRoute } from 'vue-router'
import HarmonyNotation from '../components/HarmonyNotation.vue'

const route = useRoute()
const folderId = (route.query.folderId as string) || ''
// -- DUPLICATE STATE --
const duplicateWarning = ref<any>(null)

// -- UPLOAD STATE --
const title = ref('')
const selectedFile = ref<File | null>(null)
const isUploading = ref(false)
const uploadResult = ref<any>(null)
const errorMessage = ref('')

// -- ANALYSIS STATE --
const isAnalysing = ref(false)
const analysis = ref<any>(null)
const analysisError = ref('')

// -- IMPROV STATE --
const performerType = ref<'instrument' | 'voice'>('instrument')
const instrument = ref('keyboard')
const voiceType = ref('alto')
const isGeneratingImprov = ref(false)
const improv = ref<any>(null)
const improvError = ref('')

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedFile.value = input.files[0]
  }
}

async function handleUpload(allowDuplicate = false) {
  if (!selectedFile.value || !title.value) {
    errorMessage.value = 'Please choose a file and enter a title'
    return
  }

  isUploading.value = true
  errorMessage.value = ''
  uploadResult.value = null
  analysis.value = null
  improv.value = null
  duplicateWarning.value = null

  const formData = new FormData()
  formData.append('title', title.value)
  formData.append('folderId', folderId)
  formData.append('file', selectedFile.value)
  if (allowDuplicate) {
    formData.append('allowDuplicate', 'true')
  }

  try {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    uploadResult.value = response.data.piece
  } catch (err: any) {
    if (err.response?.status === 409) {
      duplicateWarning.value = err.response.data
    } else {
      errorMessage.value = err.response?.data?.error || 'Upload failed'
    }
  } finally {
    isUploading.value = false
  }
}

async function handleAnalyse() {
  if (!uploadResult.value) return
  isAnalysing.value = true
  analysisError.value = ''
  analysis.value = null

  try {
    const response = await api.post('/analyse', {
      pieceId: uploadResult.value.id,
    })
    analysis.value = response.data.analysis
  } catch (err: any) {
    analysisError.value = err.response?.data?.error || 'Analysis failed'
  } finally {
    isAnalysing.value = false
  }
}

async function handleGenerateImprov() {
  if (!analysis.value) return
  isGeneratingImprov.value = true
  improvError.value = ''
  improv.value = null

  const body: any = { pieceId: uploadResult.value.id }
  if (performerType.value === 'instrument') {
    body.instrument = instrument.value
  } else {
    body.voiceType = voiceType.value
  }

  try {
    const response = await api.post('/improv', body)
    improv.value = response.data.improvSuggestion.suggestions
  } catch (err: any) {
    improvError.value =
      err.response?.data?.reason || err.response?.data?.error || 'Improv generation failed'
  } finally {
    isGeneratingImprov.value = false
  }
}

function downloadAsPdf() {
  // window.print() opens the browser's print dialog.
  // Modern browsers let you choose "Save as PDF" as the destination,
  // which generates a real PDF file based on the current page styled
  // with our @media print rules.
  window.print()
}
</script>

<template>
  <div>
    <h2 class="no-print">Upload sheet music</h2>
    <p class="no-print" style="color: #6b7280; margin: 0.5rem 0 2rem">
      Upload a chord chart or lead sheet. The AI will analyse it and generate improvisation
      suggestions or vocal harmonies.
    </p>

    <!-- STEP 1: UPLOAD -->
    <div
      class="no-print"
      style="
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        margin-bottom: 1.5rem;
      "
    >
      <h3 style="font-size: 16px; margin-bottom: 1rem">1. Upload your file</h3>

      <div style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px">
          Song title
        </label>
        <input v-model="title" placeholder="e.g. Build My Life" />
      </div>

      <div style="margin-bottom: 1rem">
        <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px">
          File
        </label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" @change="handleFileSelect" />
        <p v-if="selectedFile" style="font-size: 12px; color: #6b7280; margin-top: 0.4rem">
          Selected: {{ selectedFile.name }}
        </p>
      </div>

      <button @click="handleUpload" :disabled="isUploading">
        {{ isUploading ? 'Uploading...' : 'Upload' }}
      </button>

      <p v-if="errorMessage" style="color: #dc2626; margin-top: 1rem; font-size: 14px">
        {{ errorMessage }}
      </p>
      <!-- Duplicate warning -->
      <div
        v-if="duplicateWarning"
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
        <p style="font-weight: 500; margin-bottom: 0.5rem">⚠ Duplicate file detected</p>
        <p style="margin-bottom: 0.75rem">{{ duplicateWarning.message }}</p>
        <div style="display: flex; gap: 0.5rem">
          <button
            @click="handleUpload(true)"
            style="font-size: 12px; padding: 0.4rem 0.8rem; background: #1a1a1a"
          >
            Upload anyway
          </button>
          <button
            @click="duplicateWarning = null"
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

      <div
        v-if="uploadResult"
        style="
          background: #ecfdf5;
          border: 1px solid #6ee7b7;
          padding: 1rem;
          border-radius: 6px;
          margin-top: 1rem;
        "
      >
        <p style="font-weight: 500; color: #065f46; font-size: 14px">
          ✓ Uploaded: {{ uploadResult.title }}
        </p>
      </div>
    </div>

    <!-- STEP 2: ANALYSE -->
    <div
      v-if="uploadResult"
      class="no-print"
      style="
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        margin-bottom: 1.5rem;
      "
    >
      <h3 style="font-size: 16px; margin-bottom: 1rem">2. Analyse with AI</h3>
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 1rem">
        Claude will read the chord chart and extract the song's key, structure, and chord
        progression.
      </p>
      <button @click="handleAnalyse" :disabled="isAnalysing || analysis">
        {{ isAnalysing ? 'Analysing... (10–20 sec)' : analysis ? '✓ Analysed' : 'Analyse' }}
      </button>

      <p v-if="analysisError" style="color: #dc2626; margin-top: 1rem; font-size: 14px">
        {{ analysisError }}
      </p>

      <div
        v-if="analysis"
        style="
          background: #f9fafb;
          padding: 1rem;
          border-radius: 6px;
          margin-top: 1rem;
          font-size: 14px;
        "
      >
        <p><strong>Song:</strong> {{ analysis.songTitle || 'Unknown' }}</p>
        <p><strong>Key:</strong> {{ analysis.keySignature }}</p>
        <p><strong>Time signature:</strong> {{ analysis.timeSignature }}</p>
        <p><strong>Tempo:</strong> {{ analysis.tempo || 'Not marked' }}</p>
        <p><strong>Chart type:</strong> {{ analysis.chartType }}</p>
        <p><strong>Melody recognised:</strong> {{ analysis.melodyRecognised ? 'Yes' : 'No' }}</p>
      </div>
    </div>

    <!-- STEP 3: IMPROV (the wrapper itself stays so results are visible in print) -->
    <div
      v-if="analysis"
      class="step-three-wrapper"
      style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb"
    >
      <!-- CONTROLS — hidden when printing -->
      <div class="no-print">
        <h3 style="font-size: 16px; margin-bottom: 1rem">3. Generate improv or harmony</h3>

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
          <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px">
            Instrument
          </label>
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
          <label style="display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 14px">
            Voice type
          </label>
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
      </div>

      <!-- IMPROV RESULTS — INSTRUMENT VERSION -->
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

      <!-- IMPROV RESULTS — VOCAL VERSION (with VexFlow notation) -->
      <div v-if="improv && improv.harmonyType === 'vocal_part'" style="margin-top: 1.5rem">
        <h4 style="font-size: 14px; margin-bottom: 0.6rem">
          {{ improv.performerType }} harmony for "{{ improv.songTitle }}"
        </h4>

        <!-- Accuracy notice — shown only when generated from a chord chart -->
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
            pitches may not perfectly match the original recording. For more accurate, note-precise
            output, upload a <strong>lead sheet</strong> that includes the melody written on a music
            staff.
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
    </div>
  </div>
</template>

<style>
/* Print-only styles. When the user saves as PDF, only the harmony
   notation is visible, with clean white background and no UI chrome. */
@media print {
  /* Hide everything explicitly marked no-print */
  .no-print,
  .no-print * {
    display: none !important;
  }

  /* Hide page-level chrome */
  header,
  nav {
    display: none !important;
  }

  /* Reset page styling for clean print */
  body {
    background: white !important;
    color: black !important;
  }

  #app {
    max-width: 100% !important;
    padding: 0.4in !important;
    margin: 0 !important;
  }

  /* Strip backgrounds and borders from the step-three wrapper
     so the harmony section sits on a clean white page */
  .step-three-wrapper {
    background: white !important;
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  /* Strip all decorative styling from inner divs */
  div {
    background: white !important;
    box-shadow: none !important;
  }

  /* Prevent notation from breaking mid-staff across pages */
  svg {
    page-break-inside: avoid;
  }

  /* Tighten spacing */
  h4 {
    font-size: 14pt;
    margin-bottom: 0.4rem !important;
  }
}
</style>
