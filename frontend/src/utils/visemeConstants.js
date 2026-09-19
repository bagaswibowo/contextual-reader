// CMU-39 OpenPronounce Mapping (IPA & letters -> Viseme Frame PNG)
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
  n: 'N.png', 'ŋ': 'NG.png', ng: 'NG.png',
  s: 'S.png', z: 'Z.png',
  'ʃ': 'SH.png', sh: 'SH.png', 'ʒ': 'ZH.png', zh: 'ZH.png',
  w: 'W.png',
  // Vowels
  'ə': 'AH.png', 'ʌ': 'AH.png', 'ɐ': 'AH.png',
  a: 'AE.png', 'æ': 'AE.png',
  'ɑ': 'AA.png', 'ɒ': 'AA.png', aa: 'AA.png',
  o: 'AO.png', 'ɔ': 'AO.png',
  i: 'IY.png', 'ɪ': 'IH.png', ee: 'IY.png',
  e: 'EH.png', 'ɛ': 'EH.png',
  u: 'UW.png', 'ʊ': 'UH.png', oo: 'UW.png',
  'o͞o': 'UW.png', 'o͝o': 'UH.png',
  'ɜ': 'ER.png', 'ɝ': 'ER.png', 'ɚ': 'ER.png', er: 'ER.png',
  'eɪ': 'EY.png', ey: 'EY.png', ay: 'AY.png', 'aɪ': 'AY.png',
  'ɔɪ': 'OY.png', oy: 'OY.png',
  'oʊ': 'OW.png', 'əʊ': 'OW.png', ow: 'OW.png',
  'aʊ': 'AW.png', aw: 'AW.png',
  c: 'K.png', x: 'S.png', q: 'K.png'
};

// DHH Specific Classification (Color coding & guidance priority)
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

// Indonesian articulation instructions specifically tailored for Deaf/Hard-of-Hearing (DHH)
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

export function parsePhonemes(rawIpa, word) {
  const result = [];
  const cleanIpa = (rawIpa || '').replace(/[\/\[\]ˈˌː.]/g, '').trim();

  if (cleanIpa) {
    let i = 0;
    while (i < cleanIpa.length) {
      const three = cleanIpa.slice(i, i + 3).toLowerCase();
      const two = cleanIpa.slice(i, i + 2).toLowerCase();
      const one = cleanIpa[i].toLowerCase();

      if (PHONEME_TO_VISEME[three]) {
        result.push({ symbol: cleanIpa.slice(i, i + 3), frame: PHONEME_TO_VISEME[three] });
        i += 3;
      } else if (PHONEME_TO_VISEME[two]) {
        result.push({ symbol: cleanIpa.slice(i, i + 2), frame: PHONEME_TO_VISEME[two] });
        i += 2;
      } else if (PHONEME_TO_VISEME[one]) {
        result.push({ symbol: cleanIpa[i], frame: PHONEME_TO_VISEME[one] });
        i += 1;
      } else {
        result.push({ symbol: cleanIpa[i], frame: 'rest.png' });
        i += 1;
      }
    }
  }

  // Fallback to letters if IPA was empty
  if (result.length === 0 && word) {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    let i = 0;
    while (i < cleanWord.length) {
      const two = cleanWord.slice(i, i + 2);
      const one = cleanWord[i];
      if (PHONEME_TO_VISEME[two]) {
        result.push({ symbol: two.toUpperCase(), frame: PHONEME_TO_VISEME[two] });
        i += 2;
      } else if (PHONEME_TO_VISEME[one]) {
        result.push({ symbol: one.toUpperCase(), frame: PHONEME_TO_VISEME[one] });
        i += 1;
      } else {
        result.push({ symbol: one.toUpperCase(), frame: 'rest.png' });
        i += 1;
      }
    }
  }

  const list = result.length > 0 ? result : [{ symbol: word || '·', frame: 'rest.png' }];

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
