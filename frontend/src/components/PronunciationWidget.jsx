import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Eye, Info, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import {
  PHONEME_TO_VISEME,
  DIFFICULT_VISEMES,
  VOWEL_VISEMES,
  getPhonemeType,
  VISEME_GUIDANCE,
  getPhonemeWeight,
  parsePhonemes
} from '../utils/visemeConstants';

// Module-level cache for decoded audio & keyframe maps
const MAX_CACHE_SIZE = 50;
const pronunciationCache = new Map();

function setPronunciationCache(key, data) {
  if (pronunciationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pronunciationCache.keys().next().value;
    const old = pronunciationCache.get(firstKey);
    if (old && old.blobUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(old.blobUrl); } catch (_) {}
    }
    pronunciationCache.delete(firstKey);
  }
  pronunciationCache.set(key, data);
}
let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

// Native PCM silence & speech onset/offset detector
function detectSpeechBounds(audioBuffer) {
  const pcm = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const len = pcm.length;
  const threshold = 0.012; // Sensitive threshold for consonants & plosives
  let startIdx = 0;
  let endIdx = len - 1;

  for (let i = 0; i < len; i++) {
    if (Math.abs(pcm[i]) > threshold) {
      startIdx = Math.max(0, i - Math.floor(sampleRate * 0.015)); // 15ms lead-in
      break;
    }
  }

  for (let i = len - 1; i >= 0; i--) {
    if (Math.abs(pcm[i]) > threshold) {
      endIdx = Math.min(len - 1, i + Math.floor(sampleRate * 0.020)); // 20ms release
      break;
    }
  }

  const speechStartSec = startIdx / sampleRate;
  const speechEndSec = Math.max(speechStartSec + 0.1, endIdx / sampleRate);
  return { speechStartSec, speechEndSec };
}

// Precompute timeline keyframe map (fonem -> timestamp -> video frame)
function buildKeyframeMap(phonemes, speechStartSec, speechEndSec) {
  const span = Math.max(0.05, speechEndSec - speechStartSec);
  return phonemes.map((p) => ({
    ...p,
    startSec: speechStartSec + p.startRatio * span,
    endSec: speechStartSec + p.endRatio * span
  }));
}

// Subtle tactile feedback for DHH learners
function triggerHaptic(ms = 15) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch (e) {}
}

export function PronunciationWidget({
  word,
  ipa,
  transliteration,
  showVisemeGuide = true,
  compact = false,
  lang = 'en'
}) {
  if (!word) return null;

  const phonemes = parsePhonemes(ipa, word);
  const [isPlaying, setIsPlaying] = useState(false);
  // Default tempo: 0.70x as specified for DHH OpenPronounce standard
  const [playbackSpeed, setPlaybackSpeed] = useState(0.70);
  const [activePhonemeIndex, setActivePhonemeIndex] = useState(0);

  // Position starts immediately on the first phoneme of the word
  const [currentFrame, setCurrentFrame] = useState(phonemes[0]?.frame || 'rest.png');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const audioRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const activeIndexRef = useRef(0);

  // Update activeIndexRef
  const changeActiveIndex = (idx) => {
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActivePhonemeIndex(idx);
      setCurrentFrame(phonemes[idx]?.frame || 'rest.png');
      triggerHaptic(15);
    }
  };

  // Pre-fetch & pre-compute alignment map offline/ahead of time with AbortController
  useEffect(() => {
    activeIndexRef.current = 0;
    setActivePhonemeIndex(0);
    setCurrentFrame(phonemes[0]?.frame || 'rest.png');
    stopPlayback();

    const cleanWord = (word || '').trim().toLowerCase();
    if (!cleanWord) return;

    const controller = new AbortController();
    const cacheKey = `${lang || 'en'}_${cleanWord}`;

    if (!pronunciationCache.has(cacheKey)) {
      const proxyUrl = `/api/translations/tts/?text=${encodeURIComponent(cleanWord)}&lang=${encodeURIComponent(lang || 'en')}`;
      fetch(proxyUrl, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('TTS fetch failed');
          return res.blob();
        })
        .then(async (blob) => {
          const blobUrl = URL.createObjectURL(blob);
          let keyframes = null;
          try {
            const ctx = getAudioContext();
            if (ctx) {
              const arrayBuffer = await blob.arrayBuffer();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
              const { speechStartSec, speechEndSec } = detectSpeechBounds(audioBuffer);
              keyframes = buildKeyframeMap(phonemes, speechStartSec, speechEndSec);
            }
          } catch (e) {
            // AudioContext decode fallback
          }

          if (!keyframes) {
            const fallbackDur = Math.max(0.6, phonemes.length * 0.15);
            keyframes = buildKeyframeMap(phonemes, fallbackDur * 0.08, fallbackDur * 0.78);
          }

          setPronunciationCache(cacheKey, { blobUrl, keyframes });
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
        });
    }

    return () => {
      controller.abort();
    };
  }, [word, ipa, lang]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const stopPlayback = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
    changeActiveIndex(0);
  };

  const handleTogglePlay = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (isPlaying) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setIsLoadingAudio(true);

    const cleanWord = (word || '').trim().toLowerCase();
    const cacheKey = `${lang || 'en'}_${cleanWord}`;
    let cached = pronunciationCache.get(cacheKey);

    if (!cached) {
      try {
        const proxyUrl = `/api/translations/tts/?text=${encodeURIComponent(cleanWord)}&lang=${encodeURIComponent(lang || 'en')}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          let keyframes = null;
          try {
            const ctx = getAudioContext();
            if (ctx) {
              const arrayBuffer = await blob.arrayBuffer();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
              const { speechStartSec, speechEndSec } = detectSpeechBounds(audioBuffer);
              keyframes = buildKeyframeMap(phonemes, speechStartSec, speechEndSec);
            }
          } catch (e) {}
          if (!keyframes) {
            const fallbackDur = Math.max(0.6, phonemes.length * 0.15);
            keyframes = buildKeyframeMap(phonemes, fallbackDur * 0.08, fallbackDur * 0.78);
          }
          cached = { blobUrl, keyframes };
          setPronunciationCache(cacheKey, cached);
        }
      } catch (err) {}
    }

    setIsLoadingAudio(false);

    if (!cached || !cached.blobUrl) {
      fallbackSpeech(playbackSpeed);
      return;
    }

    const { blobUrl, keyframes } = cached;
    const audio = new Audio(blobUrl);
    audioRef.current = audio;

    // Time-stretch with native pitch preservation
    audio.preservesPitch = true;
    audio.playbackRate = playbackSpeed;

    audio.addEventListener('playing', () => {
      setIsPlaying(true);
      const playStartTime = performance.now();
      const firstStart = keyframes[0]?.startSec || 0;
      const lastEnd = keyframes[keyframes.length - 1]?.endSec || 1.0;

      const loopSync = () => {
        if (!audioRef.current || audioRef.current.paused || audioRef.current.ended) {
          return;
        }

        // Monotonic elapsed time scaled by playback speed (zero lag, no timer quantization)
        const elapsedSec = ((performance.now() - playStartTime) / 1000) * playbackSpeed;

        if (elapsedSec < firstStart) {
          // Pre-speech lead-in: hold first phoneme
          changeActiveIndex(0);
        } else if (elapsedSec >= lastEnd) {
          // Speech ended: hold final phoneme
          changeActiveIndex(keyframes.length - 1);
        } else {
          // Speech voiced: lookup precomputed keyframe
          let foundIdx = 0;
          for (let i = 0; i < keyframes.length; i++) {
            if (elapsedSec >= keyframes[i].startSec && elapsedSec < keyframes[i].endSec) {
              foundIdx = i;
              break;
            }
          }
          changeActiveIndex(foundIdx);
        }

        animFrameIdRef.current = requestAnimationFrame(loopSync);
      };

      animFrameIdRef.current = requestAnimationFrame(loopSync);
    });

    audio.onended = () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setIsPlaying(false);
      changeActiveIndex(0);
    };

    audio.onerror = () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      fallbackSpeech(playbackSpeed);
    };

    audio.play().catch(() => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      fallbackSpeech(playbackSpeed);
    });
  };

  const fallbackSpeech = (rate = 0.70) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang === 'id' ? 'id-ID' : (lang === 'ja' ? 'ja-JP' : (lang === 'zh' ? 'zh-CN' : (lang === 'es' ? 'es-ES' : 'en-US')));
    utterance.rate = rate;

    const totalEstimate = Math.max(500, phonemes.length * (rate < 0.8 ? 260 : 180));
    const startTime = performance.now();
    setIsPlaying(true);

    const loopFallback = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(0.999, elapsed / totalEstimate);
      let foundIdx = 0;
      for (let i = 0; i < phonemes.length; i++) {
        if (progress >= phonemes[i].startRatio && progress < phonemes[i].endRatio) {
          foundIdx = i;
          break;
        }
      }
      changeActiveIndex(foundIdx);

      if (elapsed < totalEstimate) {
        animFrameIdRef.current = requestAnimationFrame(loopFallback);
      }
    };
    animFrameIdRef.current = requestAnimationFrame(loopFallback);

    utterance.onend = () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setIsPlaying(false);
      changeActiveIndex(0);
    };
    utterance.onerror = () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setIsPlaying(false);
      changeActiveIndex(0);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stepPhoneme = (direction) => {
    stopPlayback();
    const nextIdx = Math.max(0, Math.min(phonemes.length - 1, activePhonemeIndex + direction));
    changeActiveIndex(nextIdx);
  };

  const activePhoneme = phonemes[activePhonemeIndex] || phonemes[0];
  const guide = VISEME_GUIDANCE[currentFrame] || VISEME_GUIDANCE[activePhoneme?.frame] || VISEME_GUIDANCE['rest.png'];
  const isDifficultActive = activePhoneme?.type === 'difficult';

  return (
    <ErrorBoundary>
      <div className={`pronunciation-widget rounded-2xl border-2 border-duo-blue/30 bg-duo-blue/5 p-3 sm:p-4 text-left font-ui ${compact ? 'p-2.5' : ''}`}>
        {/* Header: Title, Word, Speed Selector, and Play Button */}
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-duo-blue/15">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-duo-blue flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-duo-blue" />
              Panduan Artikulasi Bibir (DHH)
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-eel dark:text-dark-text tracking-tight">
                {word}
              </h3>
              {ipa && (
                <span className="text-xs font-mono font-bold text-duo-blue bg-duo-blue/10 px-1.5 py-0.5 rounded">
                  /{ipa}/
                </span>
              )}
            </div>
          </div>

          {/* Action Controls: 3-Speed Selector & Play Button */}
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {/* Speed Pill Selector */}
            <div className="flex items-center rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-0.5 shadow-sm">
              {[0.5, 0.7, 1.0].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setPlaybackSpeed(spd);
                    if (isPlaying) stopPlayback();
                  }}
                  className={`text-[10px] font-extrabold px-2 py-1 rounded-full transition-all ${
                    playbackSpeed === spd
                      ? 'bg-duo-blue text-white shadow-xs'
                      : 'text-gray-600 dark:text-dark-muted hover:text-eel dark:hover:text-dark-text'
                  }`}
                  title={
                    spd === 0.7
                      ? 'Tempo Standar DHH (0.70x)'
                      : spd === 0.5
                      ? 'Super Lambat (0.50x)'
                      : 'Kecepatan Normal (1.00x)'
                  }
                >
                  {spd === 0.7 ? '0.7x DHH' : `${spd}x`}
                </button>
              ))}
            </div>

            {/* Play/Stop Button */}
            <button
              onClick={handleTogglePlay}
              type="button"
              disabled={isLoadingAudio}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-duo-yellow text-eel shadow-[0_3px_0_0_#D9A200] animate-pulse'
                  : 'bg-duo-blue text-white shadow-[0_3px_0_0_#1598D9] hover:bg-duo-blue/90 active:translate-y-[2px] active:shadow-none'
              }`}
              title={isPlaying ? 'Berhenti' : 'Putar suara tersinkronisasi gerak bibir'}
            >
              {isLoadingAudio ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Square className="w-4 h-4 fill-current text-eel" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Central Visualizer: High-Contrast Lip Frame Canvas + Articulation Tip */}
        <div className="mt-3 flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-dark-card p-3 rounded-xl border border-duo-blue/20 shadow-sm">
          {/* Mouth Frame Canvas */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-slate-900 rounded-xl p-1.5 border-2 border-duo-blue/30 flex items-center justify-center relative overflow-hidden shadow-inner">
            <img
              src={`/assets/visemes/${currentFrame}`}
              alt={`Bentuk mulut ${guide.title}`}
              className="w-full h-full object-contain filter drop-shadow transition-transform duration-75"
              onError={(e) => {
                if (!e.target.src.endsWith('rest.png')) {
                  e.target.src = '/assets/visemes/rest.png';
                }
              }}
            />
            {/* Active Phoneme Overlay Badge */}
            <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white flex items-center gap-1">
              <span>/{activePhoneme?.symbol}/</span>
            </div>

            {isPlaying && (
              <span className="absolute bottom-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>

          {/* Articulation Guidance Text */}
          <div className="flex-1 min-w-0 space-y-1.5 text-left">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-heading font-extrabold text-duo-blue uppercase tracking-wider">
                Bentuk Bibir:
              </span>
              <span className="text-xs font-bold text-eel dark:text-dark-text bg-gray-100 dark:bg-dark-border px-2 py-0.5 rounded">
                {guide.title}
              </span>
              {isDifficultActive && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Kunci DHH
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-dark-text leading-relaxed font-medium">
              {guide.tip}
            </p>
            <div className="pt-0.5 flex items-center justify-between text-[10px] text-gray-400 dark:text-dark-muted">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0 text-duo-blue" />
                Klik fonem / tombol panah untuk observasi bertahap.
              </span>
            </div>
          </div>
        </div>

        {/* Clickable Phoneme Chips & Interactive Scrubber */}
        {showVisemeGuide && phonemes.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-duo-blue/15">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-dark-muted">
                Urutan Fonem:
              </span>

              {/* Scrubber Stepper Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepPhoneme(-1)}
                  disabled={activePhonemeIndex === 0}
                  className="p-1 rounded bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-30 hover:border-duo-blue"
                  title="Fonem Sebelumnya"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-duo-blue font-bold px-1">
                  {activePhonemeIndex + 1} / {phonemes.length}
                </span>
                <button
                  type="button"
                  onClick={() => stepPhoneme(1)}
                  disabled={activePhonemeIndex === phonemes.length - 1}
                  className="p-1 rounded bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text disabled:opacity-30 hover:border-duo-blue"
                  title="Fonem Selanjutnya"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Phoneme Chips with DHH Color Coding */}
            <div className="flex flex-wrap items-center gap-1.5">
              {phonemes.map((item, idx) => {
                const isActive = activePhonemeIndex === idx;
                const isDifficult = item.type === 'difficult';
                const isVowel = item.type === 'vowel';

                let colorClass = 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text';
                if (isDifficult) {
                  colorClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
                } else if (isVowel) {
                  colorClass = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      if (e && e.stopPropagation) e.stopPropagation();
                      stopPlayback();
                      changeActiveIndex(idx);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      isActive
                        ? 'bg-duo-blue text-white border-duo-blue shadow-sm ring-2 ring-duo-blue/40 scale-105'
                        : `${colorClass} hover:border-duo-blue`
                    }`}
                    title={`Lihat bentuk mulut fonem /${item.symbol}/${isDifficult ? ' (Artikulasi Kompleks DHH)' : ''}`}
                  >
                    /{item.symbol}/
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
