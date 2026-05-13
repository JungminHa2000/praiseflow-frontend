<script setup lang="ts">
import { ref } from 'vue'
import * as Tone from 'tone'

const props = defineProps<{
  sections: Array<{
    name: string
    harmonyNotes: Array<{
      harmonyNote: string
      syllableCue: string
      duration?: string
      beats?: number
      chord?: string
      intervalFromMelody?: string
    }>
  }>
  tempo?: string
  keySignature?: string
}>()

const isPlaying = ref(false)
const currentSection = ref('')
const isPaused = ref(false)
const playbackMode = ref<'harmony' | 'melody' | 'both'>('harmony')

let synths: Tone.PolySynth[] = []
let currentPart: Tone.Part | null = null
let melodyPart: Tone.Part | null = null

function parseTempo(): number {
  if (!props.tempo) return 80
  const match = props.tempo.match(/(\d+)/)
  if (match) return parseInt(match[1])
  const lower = props.tempo.toLowerCase()
  if (lower.includes('slow') || lower.includes('adagio')) return 60
  if (lower.includes('moderate') || lower.includes('andante')) return 80
  if (lower.includes('fast') || lower.includes('allegro')) return 120
  return 80
}

function durationToToneLength(duration?: string, beats?: number): string {
  if (beats) {
    if (beats >= 4) return '1n'
    if (beats >= 2) return '2n'
    if (beats >= 1) return '4n'
    if (beats >= 0.5) return '8n'
    return '16n'
  }
  switch (duration) {
    case 'w':
      return '1n'
    case 'h':
      return '2n'
    case 'q':
      return '4n'
    case '8':
      return '8n'
    case '16':
      return '16n'
    default:
      return '4n'
  }
}

// -- ESTIMATE MELODY NOTE FROM HARMONY --
// Claude tells us the interval (e.g. "third below" means
// the harmony is a third below the melody). We reverse that
// to estimate what the melody note would be.
function estimateMelodyNote(harmonyNote: string, interval?: string): string {
  if (!interval) return harmonyNote

  // Parse the harmony note into components
  const match = harmonyNote.match(/^([A-G])([#b]?)(\d)$/)
  if (!match) return harmonyNote

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const flatToSharp: Record<string, string> = {
    Db: 'C#',
    Eb: 'D#',
    Fb: 'E',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
    Cb: 'B',
  }

  let [, letter, accidental, octaveStr] = match
  let octave = parseInt(octaveStr)

  // Normalize flats to sharps for lookup
  let noteName = letter + accidental
  if (flatToSharp[noteName]) noteName = flatToSharp[noteName]

  let noteIndex = noteNames.indexOf(noteName)
  if (noteIndex === -1) noteIndex = noteNames.indexOf(letter)
  if (noteIndex === -1) return harmonyNote

  const lower = (interval || '').toLowerCase()

  // Calculate semitone shift based on interval description
  let semitones = 0
  if (lower.includes('unison') || lower.includes('root')) {
    semitones = 0
  } else if (lower.includes('third below')) {
    // Harmony is a third below melody → melody is ~4 semitones above
    semitones = 4
  } else if (lower.includes('third above') || lower === 'third') {
    // Harmony is a third above melody → melody is ~4 semitones below
    semitones = -4
  } else if (lower.includes('fifth below')) {
    semitones = 7
  } else if (lower.includes('fifth above') || lower === 'fifth') {
    semitones = -7
  } else if (lower.includes('octave below')) {
    semitones = 12
  } else if (lower.includes('octave above')) {
    semitones = -12
  } else {
    // Default: assume harmony is a third below
    semitones = 4
  }

  let newIndex = noteIndex + semitones
  let newOctave = octave

  // Handle octave wrapping
  while (newIndex >= 12) {
    newIndex -= 12
    newOctave++
  }
  while (newIndex < 0) {
    newIndex += 12
    newOctave--
  }

  return noteNames[newIndex] + newOctave
}

async function play() {
  await Tone.start()

  if (isPaused.value) {
    Tone.getTransport().start()
    isPaused.value = false
    isPlaying.value = true
    return
  }

  // Clean up any previous playback
  cleanup()

  Tone.getTransport().bpm.value = parseTempo()

  // Create synths with different tones so you can tell them apart
  // Harmony = soft triangle wave (warm, blends underneath)
  const harmonySynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -8,
  }).toDestination()

  // Melody = brighter sine wave (clear, sits on top)
  const melodySynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.6 },
    volume: -5,
  }).toDestination()

  synths = [harmonySynth, melodySynth]

  // Build note lists
  const harmonyNotes: Array<{ time: number; note: string; duration: string; section: string }> = []
  const melodyNotes: Array<{ time: number; note: string; duration: string; section: string }> = []

  let currentTime = 0

  for (const section of props.sections) {
    for (const noteData of section.harmonyNotes) {
      const toneLength = durationToToneLength(noteData.duration, noteData.beats)
      const beatsForNote = noteData.beats || 1

      // Harmony note
      harmonyNotes.push({
        time: currentTime,
        note: noteData.harmonyNote,
        duration: toneLength,
        section: section.name,
      })

      // Estimated melody note (reversed from the interval)
      const melodyNote = estimateMelodyNote(noteData.harmonyNote, noteData.intervalFromMelody)
      melodyNotes.push({
        time: currentTime,
        note: melodyNote,
        duration: toneLength,
        section: section.name,
      })

      currentTime += (60 / parseTempo()) * beatsForNote
    }
  }

  const mode = playbackMode.value
  const playHarmony = mode === 'harmony' || mode === 'both'
  const playMelody = mode === 'melody' || mode === 'both'

  // Schedule harmony playback
  if (playHarmony) {
    currentPart = new Tone.Part(
      (time, event) => {
        harmonySynth.triggerAttackRelease(event.note, event.duration, time)
        Tone.getDraw().schedule(() => {
          currentSection.value = event.section
        }, time)
      },
      harmonyNotes.map((n) => [n.time, n]),
    ).start(0)
  }

  // Schedule melody playback
  if (playMelody) {
    melodyPart = new Tone.Part(
      (time, event) => {
        melodySynth.triggerAttackRelease(event.note, event.duration, time)
        if (!playHarmony) {
          Tone.getDraw().schedule(() => {
            currentSection.value = event.section
          }, time)
        }
      },
      melodyNotes.map((n) => [n.time, n]),
    ).start(0)
  }

  // Schedule cleanup when done
  Tone.getTransport().schedule(() => {
    Tone.getDraw().schedule(() => {
      stop()
    }, Tone.now())
  }, currentTime + 0.5)

  Tone.getTransport().start()
  isPlaying.value = true
}

function pause() {
  Tone.getTransport().pause()
  isPaused.value = true
  isPlaying.value = false
}

function cleanup() {
  Tone.getTransport().stop()
  Tone.getTransport().cancel()
  if (currentPart) {
    currentPart.dispose()
    currentPart = null
  }
  if (melodyPart) {
    melodyPart.dispose()
    melodyPart = null
  }
  synths.forEach((s) => s.dispose())
  synths = []
}

function stop() {
  cleanup()
  isPlaying.value = false
  isPaused.value = false
  currentSection.value = ''
}
</script>

<template>
  <div
    style="padding: 0.75rem 1rem; background: #f9fafb; border-radius: 8px; margin-bottom: 1rem"
    class="no-print"
  >
    <!-- Mode selector -->
    <div style="display: flex; gap: 0.8rem; margin-bottom: 0.6rem">
      <label
        style="display: flex; align-items: center; gap: 0.3rem; font-size: 13px; cursor: pointer"
      >
        <input
          type="radio"
          value="harmony"
          v-model="playbackMode"
          style="width: auto"
          :disabled="isPlaying"
        />
        Harmony only
      </label>
      <label
        style="display: flex; align-items: center; gap: 0.3rem; font-size: 13px; cursor: pointer"
      >
        <input
          type="radio"
          value="melody"
          v-model="playbackMode"
          style="width: auto"
          :disabled="isPlaying"
        />
        Melody only
      </label>
      <label
        style="display: flex; align-items: center; gap: 0.3rem; font-size: 13px; cursor: pointer"
      >
        <input
          type="radio"
          value="both"
          v-model="playbackMode"
          style="width: auto"
          :disabled="isPlaying"
        />
        Both together
      </label>
    </div>

    <!-- Transport controls -->
    <div style="display: flex; align-items: center; gap: 0.6rem">
      <button
        v-if="!isPlaying"
        @click="play"
        style="padding: 0.5rem 1rem; font-size: 13px; background: #1a1a1a"
      >
        ▶ {{ isPaused ? 'Resume' : 'Play' }}
      </button>
      <button
        v-else
        @click="pause"
        style="padding: 0.5rem 1rem; font-size: 13px; background: #6b7280"
      >
        ⏸ Pause
      </button>

      <button
        v-if="isPlaying || isPaused"
        @click="stop"
        style="padding: 0.5rem 1rem; font-size: 13px; background: #dc2626"
      >
        ⏹ Stop
      </button>

      <span v-if="isPlaying" style="font-size: 12px; color: #6b7280">
        Playing: {{ currentSection }}
      </span>

      <span style="font-size: 11px; color: #9ca3af; margin-left: auto">
        {{
          playbackMode === 'harmony'
            ? '🎵 Harmony'
            : playbackMode === 'melody'
              ? '🎶 Melody'
              : '🎵🎶 Both'
        }}
      </span>
    </div>
  </div>
</template>
