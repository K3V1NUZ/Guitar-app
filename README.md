# Fretbook

An offline guitar theory app — chords, scales and the tools around them — inspired by all-guitar-chords.com, built as a dependency-free web app that installs as a PWA.

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 01 | **Chord Library** | 12 roots × 44 chord types. Formula, spelled notes, playable shapes, slash-chord bass notes, inversions, and every chord tone mapped on the neck. |
| 02 | **Chord Identifier** | Tap a shape on the fretboard (or type `x32010`), or pick notes — get the name, including slash chords, omitted tones and alternative names. |
| 03 | **Scale Explorer** | 44 scales/modes on the full neck, positions (P1…P5), step pattern, interval colouring, playback, related scales and modes. |
| 04 | **Scale Identifier** | Enter notes of a riff → every scale that contains them (exact matches first). |
| 05 | **Scales → Chords** | Diatonic triads & sevenths with Roman numerals and diagrams, plus every library chord that fits any scale. |
| 06 | **Chords → Scales** | Scales to solo over a chord, and the keys where the chord is diatonic. |
| 07 | **Circle of Fifths** | Interactive wheel with relative minors, diminished ring, key signatures on a staff and the chords of each key. |
| 08 | **Fretboard Map** | All notes, find-a-note, interval map from any root, and a note-naming quiz. |
| 09 | **Progression Builder** | Build by Roman numeral, classic presets, borrowed chords, transpose instantly, play back with strum patterns, save progressions. |
| 10 | **Tuner** | Chromatic microphone tuner (on-device pitch detection) + reference tones for the current tuning, A4 calibration. |
| 11 | **Metronome** | Accents, subdivisions, tap tempo, keyboard control and a speed trainer. |
| 12 | **Transposer & Capo** | Paste a chord sheet, transpose it, detect the key, rank capo positions by easy shapes. |
| 13 | **Ear Trainer** | Intervals, chord qualities, scales & modes, with your own selection. |

Global: optional piano-keyboard view (Settings → Display), alternate tunings (Drop D, DADGAD, open G/D/E/C/A, half/whole step down, 7‑string, ukulele, bass), left‑handed mode, sharps/flats preference, light and dark themes, and a <kbd>Ctrl/⌘ K</kbd> search that understands chord symbols (`F#m7b5`) and scales (`d dorian`).

## How it works

- **No build step, no dependencies.** Plain JavaScript (classic scripts sharing a `GA` namespace), HTML and CSS.
- **Voicings are computed, not stored.** `js/voicings.js` searches the neck for every playable shape of a chord in the current tuning, scores them for ergonomics and assigns fingers/barres — so every chord works in every tuning.
- **Correct spelling.** `js/theory.js` spells notes by interval degree and chooses the enharmonic root with the fewest accidentals (D♭ major, C♯ minor, B𝄫 in C°7).
- **Sound is synthesised** with Karplus–Strong plucked strings (`js/audio.js`) — no samples to download.
- **Offline.** A service worker precaches everything (fonts are bundled in `assets/fonts`). Settings, saved progressions and your chord sheet live in `localStorage`.

## Running

Open `index.html` directly from disk, or serve the folder (needed for offline install and the microphone tuner):

```bash
npm start
```

Then visit http://localhost:8080 and use your browser's *Install app* option to keep it as a standalone app.

## Tests

```bash
npm test
```

Fonts: Fraunces, Instrument Sans and IBM Plex Mono — SIL Open Font License.
