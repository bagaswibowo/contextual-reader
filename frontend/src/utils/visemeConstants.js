// CMU-39 OpenPronounce Mapping (IPA and letters -> Viseme Frame PNG)
// Expanded with multi-language phonemes (FR, ES, DE, IT, PT, NL, ID) and DHH articulation guides
export const PHONEME_TO_VISEME = {
  // Consonants
  b: 'B.png', p: 'P.png', m: 'M.png',
  'tʃ': 'CH.png', ch: 'CH.png', 'dʒ': 'JH.png', jh: 'JH.png',
  d: 'D.png', t: 'T.png', 'ɾ': 'D.png',
  'ð': 'DH.png', dh: 'DH.png', 'θ': 'TH.png', th: 'TH.png',
  f: 'F.png', v: 'V.png',
  g: 'G.png', 'ɡ': 'G.png', k: 'K.png',
  h: 'H.png', 'ɦ': 'HH.png',
  j: 'Y.png', y: 'Y.png',
  l: 'L.png', 'ɹ': 'R.png', r: 'R.png', 'ʁ': 'R.png',
  n: 'N.png', 'ŋ': 'NG.png', ng: 'NG.png', 'ɲ': 'N.png', ny: 'N.png',
  s: 'S.png', z: 'Z.png',
  'ʃ': 'SH.png', sh: 'SH.png', sy: 'SH.png', 'ʒ': 'ZH.png', zh: 'ZH.png',
  w: 'W.png',
  kh: 'K.png', x: 'SH.png', 'ç': 'SH.png', 'ɣ': 'G.png',
  // Mandarin Pinyin & Japanese Romaji consonants
  zh: 'JH.png', q: 'CH.png', c: 'S.png',
  // Accented Latin letters for European language fallbacks (FR, ES, DE, IT, PT)
  'ñ': 'N.png', 'ç': 'S.png',
  'é': 'EH.png', 'è': 'EH.png', 'ê': 'EH.png', 'ë': 'EH.png',
  'à': 'AE.png', 'á': 'AE.png', 'â': 'AE.png', 'ä': 'AE.png',
  'ü': 'IY.png', 'ö': 'EH.png',
  'ó': 'AO.png', 'ò': 'AO.png', 'ô': 'AO.png', 'õ': 'AO.png',
  'í': 'IY.png', 'ì': 'IY.png', 'î': 'IY.png', 'ï': 'IY.png',
  'ú': 'UW.png', 'ù': 'UW.png', 'û': 'UW.png',
  ts: 'S.png', 't͡s': 'S.png', pf: 'P.png', 'p͡f': 'P.png',
  c: 'K.png', q: 'K.png',

  // Vowels
  'ə': 'AH.png', 'ʌ': 'AH.png', 'ɐ': 'AH.png',
  a: 'AE.png', 'æ': 'AE.png',
  'ɑ': 'AA.png', 'ɒ': 'AA.png', aa: 'AA.png',
  o: 'AO.png', 'ɔ': 'AO.png',
  i: 'IY.png', 'ɪ': 'IH.png', ee: 'IY.png',
  e: 'EH.png', 'ɛ': 'EH.png', 'ø': 'EH.png', 'œ': 'EH.png',
  u: 'UW.png', 'ʊ': 'UH.png', oo: 'UW.png',
  'o͞o': 'UW.png', 'o͝o': 'UH.png',
  'ɜ': 'ER.png', 'ɝ': 'ER.png', 'ɚ': 'ER.png', er: 'ER.png',
  'eɪ': 'EY.png', ey: 'EY.png', ay: 'AY.png', 'aɪ': 'AY.png', ai: 'AY.png',
  'ɔɪ': 'OY.png', oy: 'OY.png', 'oɪ': 'OY.png', oi: 'OY.png',
  'oʊ': 'OW.png', 'əʊ': 'OW.png', ow: 'OW.png',
  'aʊ': 'AW.png', aw: 'AW.png', au: 'AW.png',
  // Japanese Romaji & Mandarin Pinyin accented vowels
  'ā': 'AE.png', 'á': 'AE.png', 'ǎ': 'AE.png', 'à': 'AE.png',
  'ē': 'EH.png', 'é': 'EH.png', 'ě': 'EH.png', 'è': 'EH.png',
  'ī': 'IY.png', 'í': 'IY.png', 'ǐ': 'IY.png', 'ì': 'IY.png',
  'ō': 'AO.png', 'ó': 'AO.png', 'ǒ': 'AO.png', 'ò': 'AO.png',
  'ū': 'UW.png', 'ú': 'UW.png', 'ǔ': 'UW.png', 'ù': 'UW.png',
  'ǖ': 'IY.png', 'ǘ': 'IY.png', 'ǚ': 'IY.png', 'ǜ': 'IY.png'
};

// DHH Specific Classification (Color coding and guidance priority)
export const DIFFICULT_VISEMES = new Set([
  'TH.png', 'DH.png', 'R.png', 'L.png', 'V.png', 'W.png', 'CH.png', 'JH.png', 'SH.png', 'ZH.png'
]);

export const VOWEL_VISEMES = new Set([
  'AA.png', 'AE.png', 'AH.png', 'AO.png', 'AW.png', 'AY.png',
  'EH.png', 'ER.png', 'EY.png', 'IH.png', 'IY.png', 'OW.png',
  'OY.png', 'UH.png', 'UW.png'
]);

export function getPhonemeType(frame) {
  if (DIFFICULT_VISEMES.has(frame)) return 'difficult';
  if (VOWEL_VISEMES.has(frame)) return 'vowel';
  return 'consonant';
}

// Multi-Language DHH Articulation Guidance Registry
export const DHH_LANGUAGE_SUPPORT = {
  en: { code: 'en', name: 'English', label: 'dhh: full', badge: 'Full', desc: 'CMU-39 Native + Durasi Fonem Terkalibrasi' },
  id: { code: 'id', name: 'Indonesian', label: 'dhh: full', badge: 'Full', desc: '100% CMU-39 (termasuk ny, ng, sy, kh, diftong ai/au/oi)' },
  ja: { code: 'ja', name: 'Japanese', label: 'dhh: full', badge: 'Full', desc: 'Sistem 5 vokal murni (a-i-u-e-o) & konsonan Romaji Hepburn terpetakan 100% ke CMU-39' },
  zh: { code: 'zh', name: 'Mandarin', label: 'dhh: moderate', badge: 'Moderate', desc: 'Pīnyīn initials & finals terpetakan ke CMU-39 (nada vokal disederhanakan ke bentuk bibir)' },
  es: { code: 'es', name: 'Spanish', label: 'dhh: full', badge: 'Full', desc: 'Transparan fonetik tinggi (ɾ, ɲ)' },
  fr: { code: 'fr', name: 'French', label: 'dhh: full', badge: 'Full', desc: 'Artikulasi bibir lengkap (ʁ, ɲ, ø, œ, y)' },
  de: { code: 'de', name: 'German', label: 'dhh: full', badge: 'Full', desc: 'Vokal bulat dan konsonan frikatif (ø, œ, y, ɐ)' },
  it: { code: 'it', name: 'Italian', label: 'dhh: full', badge: 'Full', desc: 'Artikulasi bibir anterior terbuka (ɲ, ɾ)' },
  pt: { code: 'pt', name: 'Portuguese', label: 'dhh: moderate', badge: 'Moderate', desc: 'Artikulasi bibir (vokal nasal disederhanakan)' },
  nl: { code: 'nl', name: 'Dutch', label: 'dhh: moderate', badge: 'Moderate', desc: 'Artikulasi bibir (y, ɦ terpetakan)' },
  ko: { code: 'ko', name: 'Korean', label: 'dhh: moderate', badge: 'Moderate', desc: 'Transliterasi Romaja fonetik Hangeul terpetakan ke CMU-39' },
  ar: { code: 'ar', name: 'Arabic', label: 'dhh: moderate', badge: 'Moderate', desc: 'Transliterasi konsonan & vokal Arab terpetakan ke CMU-39' },
  ru: { code: 'ru', name: 'Russian', label: 'dhh: moderate', badge: 'Moderate', desc: 'Transliterasi Latin fonetik Cyrillic terpetakan ke CMU-39' },
  tr: { code: 'tr', name: 'Turkish', label: 'dhh: full', badge: 'Full', desc: 'Alfabet Latin fonetik transparan terpetakan 100% ke CMU-39' }
};

export function getDhhSupport(lang = 'en') {
  const code = (lang || 'en').toLowerCase().slice(0, 2);
  return DHH_LANGUAGE_SUPPORT[code] || {
    code,
    name: code.toUpperCase(),
    label: 'dhh: experimental',
    badge: 'Experimental',
    desc: 'Artikulasi bibir berbasis heuristik fonetik'
  };
}

// Articulation instructions specifically tailored for Deaf/Hard-of-Hearing (DHH)
export const VISEME_GUIDANCE = {
  'B.png': { title: 'Bibir Rapat', tip: 'Katupkan kedua bibir atas dan bawah rapat sebelum melepas hembusan.' },
  'P.png': { title: 'Bibir Rapat (Letupan)', tip: 'Tutup rapat kedua bibir, lepaskan udara dengan letupan tanpa getaran leher.' },
  'M.png': { title: 'Bibir Rapat (Dengung)', tip: 'Kedua bibir terkatup rapat, rasakan getaran di rongga hidung.' },
  'F.png': { title: 'Gigi Seri ke Bibir Bawah', tip: 'Letakkan ujung gigi seri atas di bibir bawah bagian dalam, tiup lembut.' },
  'V.png': { title: 'Gigi Seri ke Bibir Bawah (Bersuara)', tip: 'Gigi atas menyentuh bibir bawah, rasakan getaran di bibir.' },
  'TH.png': { title: 'Lidah Antargigi', tip: 'Julurkan sedikit ujung lidah di antara celah gigi atas dan bawah.' },
  'DH.png': { title: 'Lidah Antargigi (Bersuara)', tip: 'Ujung lidah di antara gigi seri dengan getaran di pangkal lidah.' },
  'T.png': { title: 'Ujung Lidah Gusi Atas', tip: 'Sentuhkan ujung lidah ke gusi atas tepat di belakang gigi depan.' },
  'D.png': { title: 'Ujung Lidah Gusi Atas (Bersuara)', tip: 'Tekan ujung lidah ke langit-langit depan lalu lepas cepat.' },
  'S.png': { title: 'Gigi Rapat Mendesis', tip: 'Rapatkan gigi atas dan bawah hampir bersentuhan, hembuskan desis udara tipis.' },
  'Z.png': { title: 'Gigi Rapat Bergetar', tip: 'Posisi gigi seperti huruf S tetapi sertai getaran pita suara.' },
  'SH.png': { title: 'Bibir Maju Membulat', tip: 'Bibir dimajukan sedikit membulat seperti meminta orang lain tenang/diam.' },
  'CH.png': { title: 'Letupan Bibir Maju', tip: 'Ujung lidah menepuk gusi atas lalu lepaskan bersama bibir yang maju.' },
  'JH.png': { title: 'Letupan Bersuara Bibir Maju', tip: 'Kombinasi letupan lidah gusi atas dengan bibir sedikit moncong.' },
  'K.png': { title: 'Pangkal Lidah Belakang', tip: 'Mulut terbuka, pangkal lidah naik menempel langit-langit lunak belakang.' },
  'G.png': { title: 'Pangkal Lidah Bersuara', tip: 'Pangkal lidah menempel langit-langit belakang disertai getaran leher.' },
  'L.png': { title: 'Ujung Lidah Naik', tip: 'Ujung lidah menempel tegak di gusi atas, udara mengalir dari samping lidah.' },
  'R.png': { title: 'Lidah Melengkung ke Belakang', tip: 'Bibir sedikit membulat, ujung lidah melengkung ke belakang tanpa sentuh langit-langit.' },
  'W.png': { title: 'Bibir Mengerucut Bulat', tip: 'Moncongkan bibir membulat kecil ke depan seperti akan bersiul.' },
  'Y.png': { title: 'Bibir Melebar Senyum', tip: 'Sudut bibir ditarik melebar ke kiri dan kanan, lidah naik ke tengah.' },
  'AA.png': { title: 'Rahang Turun Lebar', tip: 'Turunkan rahang bawah ke bawah maksimal, mulut terbuka luas.' },
  'AE.png': { title: 'Mulut Buka Sambil Senyum', tip: 'Buka mulut lebar namun tarik sudut bibir ke samping seperti tertawa.' },
  'AH.png': { title: 'Mulut Terbuka Rileks', tip: 'Posisi mulut dan bibir rileks alami, tidak terlalu tegang atau lebar.' },
  'AO.png': { title: 'Bibir Bentuk Huruf O', tip: 'Rahang terbuka sedang dengan bibir membulat oval.' },
  'AW.png': { title: 'Meluncur Buka ke Bulat', tip: 'Mulai dari mulut terbuka lebar lalu segera mengerucut membulat.' },
  'AY.png': { title: 'Meluncur Buka ke Senyum', tip: 'Mulai dari rahang turun lalu sudut bibir ditarik tersenyum lebar.' },
  'EH.png': { title: 'Bukaan Sedang Agak Senyum', tip: 'Buka rahang separuh dengan bibir santai melebar sedikit.' },
  'ER.png': { title: 'Mulut Terbuka Sedikit Lidah Lipat', tip: 'Bukaan kecil dengan badan lidah ditarik sedikit ke belakang.' },
  'EY.png': { title: 'Meluncur ke Senyum', tip: 'Bibir terbuka separuh lalu ditarik melebar ke samping.' },
  'IH.png': { title: 'Senyum Rileks Singkat', tip: 'Bibir sedikit melebar dengan rahang hampir rapat santai.' },
  'IY.png': { title: 'Senyum Lebar Penuh', tip: 'Tarik sudut bibir ke kiri dan kanan maksimal seperti mengucapkan "iiii".' },
  'OW.png': { title: 'Bibir Membulat Meluncur', tip: 'Bibir membentuk lingkaran sedang lalu mengecil mengerucut.' },
  'OY.png': { title: 'Bibir Bulat ke Senyum', tip: 'Mulai dari membulat oval lalu segera ditarik ke senyum.' },
  'UH.png': { title: 'Bibir Agak Maju Rileks', tip: 'Bibir sedikit maju membulat santai.' },
  'UW.png': { title: 'Bibir Mengerucut Rapat', tip: 'Moncongkan kedua bibir membulat rapat ke depan seperti meniup lilin.' },
  'rest.png': { title: 'Posisi Istirahat (Diam)', tip: 'Bibir tertutup rileks secara alami tanpa ketegangan otot wajah.' }
};

// Acoustic weight for realistic speech timing
export function getPhonemeWeight(frame) {
  if (['UW.png', 'AA.png', 'AO.png', 'AW.png', 'AY.png', 'OW.png', 'OY.png'].includes(frame)) return 2.0;
  if (['IY.png', 'EH.png', 'IH.png', 'AE.png', 'ER.png', 'UH.png', 'AH.png'].includes(frame)) return 1.2;
  if (['M.png', 'N.png', 'NG.png', 'L.png', 'R.png', 'W.png', 'Y.png'].includes(frame)) return 1.0;
  if (['S.png', 'Z.png', 'SH.png', 'ZH.png', 'F.png', 'V.png', 'TH.png', 'DH.png'].includes(frame)) return 0.9;
  return 0.6; // Plosives K, P, T, D, B, G, CH, JH
}

export function parsePhonemes(rawIpa, word, lang = 'en', transliteration = '') {
  const result = [];
  // Strict sanitization: strip all punctuation, stress marks, tones, numbers, brackets, hyphens
  const cleanIpa = (rawIpa || '')
    .replace(/[\/\[\]ˈˌː.0-9\-_'"`,;:?!()«»“”‘’~]/g, '')
    .replace(/[^\p{L}\p{M}ʃʒθðŋɲɹʁɾçɣɦ]/gu, '')
    .trim();

  if (cleanIpa) {
    let i = 0;
    while (i < cleanIpa.length) {
      const three = cleanIpa.slice(i, i + 3).toLowerCase();
      const two = cleanIpa.slice(i, i + 2).toLowerCase();
      const one = cleanIpa[i].toLowerCase();

      // OpenPronounce special: Close front rounded vowel /y/ in IPA maps to IY.png
      if (one === 'y') {
        result.push({ symbol: cleanIpa[i], frame: 'IY.png' });
        i += 1;
      } else if (PHONEME_TO_VISEME[three]) {
        result.push({ symbol: cleanIpa.slice(i, i + 3), frame: PHONEME_TO_VISEME[three] });
        i += 3;
      } else if (PHONEME_TO_VISEME[two]) {
        result.push({ symbol: cleanIpa.slice(i, i + 2), frame: PHONEME_TO_VISEME[two] });
        i += 2;
      } else if (PHONEME_TO_VISEME[one]) {
        result.push({ symbol: cleanIpa[i], frame: PHONEME_TO_VISEME[one] });
        i += 1;
      } else {
        // Abaikan tanda baca/simbol non-fonetik! Hanya huruf valid yang dipetakan
        if (/\p{L}/u.test(cleanIpa[i])) {
          result.push({ symbol: cleanIpa[i], frame: 'AH.png' });
        }
        i += 1;
      }
    }
  }

  // Fallback to letters or Latin transliteration (for Japanese/Mandarin/Korean/Arabic/Russian)
  if (result.length === 0 && (word || transliteration)) {
    // Check if word contains non-Latin scripts (CJK, Arabic, Cyrillic, Hangul)
    const hasNonLatin = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0600-\u06ff\u0400-\u04ff]/.test(word || '');
    const sourceText = (hasNonLatin && transliteration) ? transliteration : (word || transliteration || '');

    // Extract primary lemma if translation contains comma/semicolon/parentheses
    const primary = sourceText.split(/[,;(]/)[0].trim() || sourceText;
    const cleanWord = primary.replace(/[^\p{L}]/gu, '').toLowerCase();
    let i = 0;
    while (i < cleanWord.length) {
      const three = cleanWord.slice(i, i + 3);
      const two = cleanWord.slice(i, i + 2);
      const one = cleanWord[i];
      if (PHONEME_TO_VISEME[three]) {
        result.push({ symbol: three.toUpperCase(), frame: PHONEME_TO_VISEME[three] });
        i += 3;
      } else if (PHONEME_TO_VISEME[two]) {
        result.push({ symbol: two.toUpperCase(), frame: PHONEME_TO_VISEME[two] });
        i += 2;
      } else if (PHONEME_TO_VISEME[one]) {
        result.push({ symbol: one.toUpperCase(), frame: PHONEME_TO_VISEME[one] });
        i += 1;
      } else {
        if (/\p{L}/u.test(one)) {
          result.push({ symbol: one.toUpperCase(), frame: 'AH.png' });
        }
        i += 1;
      }
    }
  }

  let list = result;
  if (list.length === 0) {
    const firstLetter = (word || '').replace(/[^\p{L}]/gu, '')[0];
    if (firstLetter) {
      list = [{ symbol: firstLetter.toUpperCase(), frame: PHONEME_TO_VISEME[firstLetter.toLowerCase()] || 'AH.png' }];
    } else {
      return [];
    }
  }

  // Calculate cumulative acoustic intervals
  const weights = list.map(p => getPhonemeWeight(p.frame));
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  let cum = 0;
  return list.map((p, idx) => {
    const startRatio = cum / totalW;
    cum += weights[idx];
    const endRatio = cum / totalW;
    const type = getPhonemeType(p.frame);
    return { ...p, startRatio, endRatio, type };
  });
}
