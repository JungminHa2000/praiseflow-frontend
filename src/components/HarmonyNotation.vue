<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Renderer, Stave, StaveNote, Voice, Formatter, Annotation, Accidental } from 'vexflow'

const props = defineProps<{
  sectionName: string
  keySignature?: string
  timeSignature?: string
  harmonyNotes: Array<{
    chord: string
    harmonyNote: string
    syllableCue: string
    intervalFromMelody: string
    order: number
    duration?: string
    beats?: number
  }>
}>()

const containerRef = ref<HTMLDivElement | null>(null)

// -- KEY SIGNATURE PARSER --
// Convert "E major" or "C# minor" into VexFlow's format ("E" or "C#m")
function parseKey(keyString?: string): string {
  if (!keyString) return 'C'
  const trimmed = keyString.trim()
  const isMinor = /minor|min|m\b/i.test(trimmed)
  const tonic = trimmed.match(/^([A-G][#b]?)/)?.[1] || 'C'
  return isMinor ? `${tonic}m` : tonic
}

function parseTimeSignature(ts?: string): { num: number; den: number } {
  if (!ts) return { num: 4, den: 4 }
  const match = ts.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return { num: 4, den: 4 }
  return { num: parseInt(match[1]), den: parseInt(match[2]) }
}

function parseNote(noteString: string): string[] {
  const match = noteString.match(/^([A-Ga-g])([#b]*)(\d)$/)
  if (!match) return ['c/4']
  const [, letter, accidental, octave] = match
  return [`${letter.toLowerCase()}${accidental}/${octave}`]
}

// -- GROUP NOTES INTO MEASURES --
// Walk through all the notes, summing their beat values until we reach
// one full measure, then start a new measure.
function groupIntoMeasures(
  notes: typeof props.harmonyNotes,
  beatsPerMeasure: number,
): Array<typeof props.harmonyNotes> {
  const measures: Array<typeof props.harmonyNotes> = []
  let currentMeasure: typeof props.harmonyNotes = []
  let currentBeats = 0

  for (const note of notes) {
    const beats = note.beats ?? 1
    if (currentBeats + beats > beatsPerMeasure && currentMeasure.length > 0) {
      measures.push(currentMeasure)
      currentMeasure = []
      currentBeats = 0
    }
    currentMeasure.push(note)
    currentBeats += beats
  }

  if (currentMeasure.length > 0) {
    measures.push(currentMeasure)
  }

  return measures
}

function drawNotation() {
  if (!containerRef.value) return
  containerRef.value.innerHTML = ''

  const notes = props.harmonyNotes
  if (notes.length === 0) return

  const ts = parseTimeSignature(props.timeSignature)
  const key = parseKey(props.keySignature)
  const measures = groupIntoMeasures(notes, ts.num)

  // -- LAYOUT --
  // 4 measures per line, ~180px per measure
  const measuresPerLine = 2
  const lineCount = Math.ceil(measures.length / measuresPerLine)
  const measureWidth = 320
  const startX = 10
  const firstMeasureExtra = 80 // extra space on first measure for clef/key/time
  const lineWidth = startX + firstMeasureExtra + measureWidth * measuresPerLine + 20
  const lineHeight = 130

  const renderer = new Renderer(containerRef.value, Renderer.Backends.SVG)
  renderer.resize(lineWidth, lineHeight * lineCount + 40)
  const context = renderer.getContext()

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    const startMeasure = lineIndex * measuresPerLine
    const endMeasure = Math.min(startMeasure + measuresPerLine, measures.length)
    const yPosition = lineIndex * lineHeight + 30

    let xPosition = startX

    for (let m = startMeasure; m < endMeasure; m++) {
      const measureNotes = measures[m]
      const isFirstOfLine = m === startMeasure
      const width = isFirstOfLine ? measureWidth + firstMeasureExtra : measureWidth

      const stave = new Stave(xPosition, yPosition, width)
      if (isFirstOfLine) {
        stave.addClef('treble')
        try {
          stave.addKeySignature(key)
        } catch (e) {
          // Fallback if key is unrecognised
        }
        if (lineIndex === 0 && m === 0) {
          stave.addTimeSignature(`${ts.num}/${ts.den}`)
        }
      }
      stave.setContext(context).draw()

      const staveNotes = measureNotes.map((noteData) => {
        const keys = parseNote(noteData.harmonyNote)
        // Sanitise the duration value — only accept VexFlow-supported values
        const rawDuration = noteData.duration ?? 'q'
        const allowed = ['w', 'h', 'q', '8', '16', '32', 'wd', 'hd', 'qd', '8d', '16d']
        const duration = allowed.includes(rawDuration) ? rawDuration : 'q'

        const note = new StaveNote({
          keys,
          duration,
          clef: 'treble',
        })

        if (noteData.harmonyNote.includes('#')) {
          note.addModifier(new Accidental('#'), 0)
        } else if (noteData.harmonyNote.includes('b')) {
          note.addModifier(new Accidental('b'), 0)
        }

        const lyricAnnotation = new Annotation(noteData.syllableCue)
          .setFont('Arial', 11)
          .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
        note.addModifier(lyricAnnotation, 0)

        const chordAnnotation = new Annotation(noteData.chord)
          .setFont('Arial', 10, 'bold')
          .setVerticalJustification(Annotation.VerticalJustify.TOP)
        note.addModifier(chordAnnotation, 0)

        return note
      })

      const voice = new Voice({ numBeats: ts.num, beatValue: ts.den })
      voice.setStrict(false)
      voice.addTickables(staveNotes)
      new Formatter().joinVoices([voice]).format([voice], width - 50)
      voice.draw(context, stave)

      xPosition += width
    }
  }
}

onMounted(drawNotation)
watch(() => props.harmonyNotes, drawNotation, { deep: true })
</script>

<template>
  <div
    style="
      background: white;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 0.6rem;
      border: 1px solid #e5e7eb;
      overflow-x: auto;
    "
  >
    <p style="font-weight: 500; margin-bottom: 0.6rem; font-size: 14px">{{ sectionName }}</p>
    <div ref="containerRef"></div>
  </div>
</template>
