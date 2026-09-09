import React, { useState, useEffect, useRef } from 'react'
import { Play, Square, Volume2, Sparkles, Sliders, Check } from 'lucide-react'

// Generate phonetic respelling and mouth articulation steps for English words
export function getArticulationGuide(word = '', ipa = '') {
  const cleanWord = word.trim().toLowerCase()

  // Common pronunciation dictionary for high-frequency irregular words
  const KNOWN_MAP = {
    cough: {
      soundsLike: 'kaaf',
      tip: 'Buka rahang ke bawah secara lebar, bulatkan sedikit bibir, lalu tutup dengan hembusan konsonan /f/.',
      visemes: [
        { label: 'K', shape: 'open-back', desc: 'Pangkal lidah menyentuh langit-langit lunak belakang' },
        { label: 'AA', shape: 'open-wide', desc: 'Rahang turun terbuka lebar, bibir rileks membulat' },
        { label: 'F', shape: 'labiodental', desc: 'Gigi atas menempel lembut pada bibir bawah' }
      ]
    },
    rough: {
      soundsLike: 'ruhf',
      tip: 'Mulut sedikit membulat untuk /r/, lalu vokal pendek /uh/, akhiri gigi atas pada bibir bawah.',
      visemes: [
        { label: 'R', shape: 'rounded', desc: 'Bibir sedikit maju membulat' },
        { label: 'UH', shape: 'neutral', desc: 'Mulut terbuka rileks' },
        { label: 'F', shape: 'labiodental', desc: 'Gigi atas di atas bibir bawah' }
      ]
    },
    through: {
      soundsLike: 'throo',
      tip: 'Ujung lidah di antara gigi untuk /th/, lalu dorong bibir maju membulat untuk /oo/.',
      visemes: [
        { label: 'TH', shape: 'dental', desc: 'Ujung lidah di antara gigi depan' },
        { label: 'R', shape: 'rounded', desc: 'Bibir sedikit mengerucut' },
        { label: 'OO', shape: 'pucker', desc: 'Bibir maju membulat kecil' }
      ]
    },
    thought: {
      soundsLike: 'thawt',
      tip: 'Ujung lidah di antara gigi, rahang turun untuk /aw/, lidah naik ke langit-langit untuk /t/.',
      visemes: [
        { label: 'TH', shape: 'dental', desc: 'Ujung lidah di antara gigi' },
        { label: 'AW', shape: 'open-wide', desc: 'Rahang terbuka lebar' },
        { label: 'T', shape: 'alveolar', desc: 'Ujung lidah menepuk langit-langit gigi depan' }
      ]
    },
    benevolent: {
      soundsLike: 'buh-NEV-uh-luhnt',
      tip: 'Katupkan kedua bibir untuk /b/, buka tersenyum lebar pada /nev/, akhiri dengan lidah di langit-langit.',
      visemes: [
        { label: 'B', shape: 'bilabial', desc: 'Bibir atas dan bawah terkatup rapat' },
        { label: 'NEV', shape: 'spread', desc: 'Bibir melebar sedikit tersenyum, gigi atas sentuh bibir bawah' },
        { label: 'LNT', shape: 'alveolar', desc: 'Ujung lidah menyentuh gusi atas' }
      ]
    },
    interaction: {
      soundsLike: 'in-ter-AK-shuhn',
      tip: 'Mulai dengan senyum pendek /in/, tekuk lidah pada /ter/, rahang turun di /ak/, lalu majukan bibir untuk /sh/.',
      visemes: [
        { label: 'IN', shape: 'spread', desc: 'Bibir sedikit melebar, lidah naik' },
        { label: 'AK', shape: 'open-wide', desc: 'Rahang turun terbuka lebar' },
        { label: 'SHUN', shape: 'rounded', desc: 'Bibir maju membulat dengan hembusan desis' }
      ]
    }
  }

  if (KNOWN_MAP[cleanWord]) {
    return KNOWN_MAP[cleanWord]
  }

  // Dynamic Rule-based Generator
  const syllables = cleanWord.length <= 4 
    ? [cleanWord] 
    : cleanWord.match(/.{1,4}/g) || [cleanWord]

  const soundsLike = cleanWord
    .replace(/tion/g, 'shuhn')
    .replace(/ph/g, 'f')
    .replace(/ough/g, 'aw')
    .replace(/igh/g, 'eye')
    .replace(/ea/g, 'ee')
    .replace(/ee/g, 'ee')
    .replace(/oo/g, 'oo')
    .replace(/ch/g, 'ch')
    .replace(/th/g, 'th')

  const visemes = [
    { label: 'Start', shape: 'neutral', desc: 'Bibir rileks dalam posisi netral' }
  ]

  if (/^[pbm]/i.test(cleanWord)) {
    visemes.push({ label: cleanWord[0].toUpperCase(), shape: 'bilabial', desc: 'Bibir atas dan bawah terkatup rapat' })
  } else if (/^[fv]/i.test(cleanWord)) {
    visemes.push({ label: cleanWord[0].toUpperCase(), shape: 'labiodental', desc: 'Gigi atas menempel di bibir bawah' })
  } else if (/^th/i.test(cleanWord)) {
    visemes.push({ label: 'TH', shape: 'dental', desc: 'Ujung lidah berada di antara gigi depan' })
  } else if (/^[aeiou]/i.test(cleanWord)) {
    visemes.push({ label: 'Vowel', shape: 'open-wide', desc: 'Rahang turun dan mulut terbuka' })
  }

  if (/[aeiou]/i.test(cleanWord)) {
    visemes.push({ label: 'Vocal', shape: 'open-wide', desc: 'Rongga mulut terbuka untuk mengalirkan vokal utama' })
  }

  if (/[fv]$/i.test(cleanWord)) {
    visemes.push({ label: 'End', shape: 'labiodental', desc: 'Gigi atas menempel pada bibir bawah' })
  } else if (/[pbm]$/i.test(cleanWord)) {
    visemes.push({ label: 'End', shape: 'bilabial', desc: 'Bibir terkatup menutup bunyi' })
  } else {
    visemes.push({ label: 'End', shape: 'alveolar', desc: 'Ujung lidah naik menyentuh langit-langit mulut' })
  }

  return {
    soundsLike: ipa ? `/${ipa}/` : soundsLike,
    tip: 'Perhatikan bukaan rahang dan posisi ujung lidah serta bibir saat menyuarakan kata.',
    visemes
  }
}

export function MouthArticulationVisualizer({ word = 'cough', ipa = '' }) {
  const [isSlow, setIsSlow] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const guide = getArticulationGuide(word, ipa)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const playPronunciation = () => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsPlaying(false)
      setActiveStep(0)
      return
    }

    setIsPlaying(true)
    setActiveStep(0)

    // Play TTS Audio at speed
    try {
      const audioUrl = `/api/translations/tts/?text=${encodeURIComponent(word)}&lang=en`
      const audio = new Audio(audioUrl)
      audio.playbackRate = isSlow ? 0.55 : 1.0
      audio.onended = () => {
        setIsPlaying(false)
        setActiveStep(0)
        if (timerRef.current) clearInterval(timerRef.current)
      }
      audio.onerror = () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const utt = new SpeechSynthesisUtterance(word)
          utt.lang = 'en-US'
          utt.rate = isSlow ? 0.55 : 0.95
          utt.onend = () => {
            setIsPlaying(false)
            setActiveStep(0)
            if (timerRef.current) clearInterval(timerRef.current)
          }
          window.speechSynthesis.speak(utt)
        } else {
          setIsPlaying(false)
        }
      }
      audio.play().catch(() => {})
    } catch (e) {}

    // Animate mouth shapes step-by-step
    const intervalTime = isSlow ? 600 : 350
    let step = 0
    timerRef.current = setInterval(() => {
      step += 1
      if (step < guide.visemes.length) {
        setActiveStep(step)
      } else {
        clearInterval(timerRef.current)
        setTimeout(() => {
          setIsPlaying(false)
          setActiveStep(0)
        }, intervalTime)
      }
    }, intervalTime)
  }

  const currentViseme = guide.visemes[activeStep] || guide.visemes[0]
  const shape = currentViseme?.shape || 'neutral'

  return (
    <div className="rounded-2xl border-2 border-sky-500/30 bg-slate-900/90 text-slate-100 p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Header with Title & Slow Toggle */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-sky-400" />
            <span>American Pronunciation</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-white mt-0.5">
            Sounds like: <span className="font-mono text-sky-300 font-extrabold bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">{guide.soundsLike}</span>
          </div>
        </div>

        {/* Slow Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          <span className="text-xs font-bold text-slate-300">Slow</span>
          <button
            onClick={() => setIsSlow(!isSlow)}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
              isSlow ? 'bg-sky-500 justify-end' : 'bg-slate-600 justify-start'
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow-md" />
          </button>
        </div>
      </div>

      {/* Interactive Mouth/Lip Articulation Graphic (SVG Canvas) */}
      <div className="relative bg-slate-950 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800/80 min-h-[190px]">
        {/* SVG Mouth Shape Model */}
        <svg viewBox="0 0 200 120" className="w-48 sm:w-56 h-28 select-none transition-all duration-300">
          {/* Face / Jaw contour silhouette */}
          <path
            d={shape === 'open-wide' ? "M 20 20 Q 100 10 180 20 Q 180 115 100 118 Q 20 115 20 20 Z" : "M 20 25 Q 100 15 180 25 Q 180 105 100 108 Q 20 105 20 25 Z"}
            fill="#1e293b"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* Oral Cavity (Dark inside mouth) */}
          {shape === 'bilabial' ? (
            <line x1="55" y1="60" x2="145" y2="60" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          ) : shape === 'labiodental' ? (
            <path d="M 60 55 Q 100 68 140 55 Q 100 70 60 55 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          ) : shape === 'open-wide' ? (
            <ellipse cx="100" cy="62" rx="42" ry="26" fill="#090d16" stroke="#475569" strokeWidth="2" />
          ) : shape === 'pucker' || shape === 'rounded' ? (
            <ellipse cx="100" cy="60" rx="24" ry="18" fill="#090d16" stroke="#475569" strokeWidth="2" />
          ) : shape === 'dental' ? (
            <path d="M 50 56 Q 100 66 150 56 Q 100 72 50 56 Z" fill="#090d16" stroke="#475569" strokeWidth="2" />
          ) : (
            <ellipse cx="100" cy="60" rx="36" ry="14" fill="#090d16" stroke="#475569" strokeWidth="2" />
          )}

          {/* Upper Teeth */}
          {shape !== 'bilabial' && (
            <path
              d={shape === 'open-wide' ? "M 74 44 Q 100 48 126 44 L 124 50 Q 100 54 76 50 Z" : "M 70 50 Q 100 53 130 50 L 128 55 Q 100 58 72 55 Z"}
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          )}

          {/* Tongue Visualizer */}
          {shape === 'dental' ? (
            // Tongue sticking forward between teeth
            <path d="M 85 58 Q 100 65 115 58 Q 110 72 90 72 Z" fill="#f43f5e" stroke="#e11d48" strokeWidth="1.5" />
          ) : shape === 'alveolar' ? (
            // Tongue tip raised to upper ridge
            <path d="M 80 54 Q 100 46 120 54 Q 100 70 80 54 Z" fill="#f43f5e" stroke="#e11d48" strokeWidth="1.5" />
          ) : shape === 'open-wide' ? (
            // Tongue resting flat on floor
            <path d="M 72 74 Q 100 64 128 74 Q 100 84 72 74 Z" fill="#e11d48" stroke="#be123c" strokeWidth="1.5" />
          ) : null}

          {/* Lower Teeth (Visible in labiodental / open) */}
          {shape === 'labiodental' ? (
            <path d="M 75 64 Q 100 67 125 64 L 123 60 Q 100 63 77 60 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
          ) : null}

          {/* Upper Lip */}
          <path
            d={
              shape === 'open-wide'
                ? "M 46 44 Q 78 30 100 36 Q 122 30 154 44 Q 100 48 46 44 Z"
                : shape === 'pucker' || shape === 'rounded'
                ? "M 70 46 Q 88 38 100 42 Q 112 38 130 46 Q 100 50 70 46 Z"
                : "M 48 52 Q 78 40 100 45 Q 122 40 152 52 Q 100 54 48 52 Z"
            }
            fill="#e11d48"
            stroke="#be123c"
            strokeWidth="2"
          />

          {/* Lower Lip */}
          <path
            d={
              shape === 'open-wide'
                ? "M 46 44 Q 100 88 154 44 Q 100 74 46 44 Z"
                : shape === 'labiodental'
                ? "M 52 54 Q 100 76 148 54 Q 100 66 52 54 Z"
                : shape === 'pucker' || shape === 'rounded'
                ? "M 70 46 Q 100 76 130 46 Q 100 66 70 46 Z"
                : "M 48 52 Q 100 76 152 52 Q 100 65 48 52 Z"
            }
            fill="#f43f5e"
            stroke="#e11d48"
            strokeWidth="2"
          />
        </svg>

        {/* Central Play/Replay Button Overlay */}
        <button
          onClick={playPronunciation}
          className={`absolute bottom-3 right-3 p-3 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
            isPlaying ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-sky-500 text-white hover:bg-sky-400'
          }`}
          title={isPlaying ? "Berhenti" : "Dengarkan & Gerakkan Bibir"}
        >
          {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Real-time Phoneme Viseme Pill */}
        <div className="mt-2 flex items-center gap-1.5">
          {guide.visemes.map((v, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                activeStep === idx 
                  ? 'bg-sky-500 text-white shadow-sm ring-2 ring-sky-400/50' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Articulation Guidance Text */}
      <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <div className="text-xs font-extrabold text-sky-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Panduan Gerakan Bibir & Lidah ({currentViseme?.label || 'Utama'}):</span>
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
          {currentViseme?.desc || guide.tip}
        </p>
      </div>
    </div>
  )
}
