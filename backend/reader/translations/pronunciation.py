"""Syllable breakdown and a readable respelling for the word card.

The pronunciation tab needs three things the dictionary entry does not carry:
the IPA, a respelling a beginner can read, and the syllables that the audio
highlight follows. The respelling comes from ``enrichment.ipa_to_guide``; this
module splits it into syllables with a vowel-nucleus heuristic.

The split is a reading aid, not a phonetic transcription. It follows the
maximal-onset rule (a single consonant between vowels starts the next
syllable, a cluster splits before its last consonant), which matches the
common dictionary hyphenation for English and most Latin-script languages.
"""

from __future__ import annotations

import re
from typing import Dict, List

_VOWELS = 'aeiouy'


def syllabify(text: str) -> List[str]:
    """Split a word or respelling into syllables, keeping its letter case."""
    letters = re.sub(r'[^A-Za-z]', '', text or '')
    if not letters:
        return []

    lower = letters.lower()
    nuclei = [(match.start(), match.end()) for match in re.finditer(r'[aeiouy]+', lower)]
    if not nuclei:
        return [letters]

    # A final silent "e" is not a syllable of its own ("believe", "make").
    if len(nuclei) > 1 and lower.endswith('e') and nuclei[-1] == (len(lower) - 1, len(lower)):
        nuclei = nuclei[:-1]

    boundaries = []
    for (_, previous_end), (next_start, _) in zip(nuclei, nuclei[1:]):
        cluster = next_start - previous_end
        # Maximal onset: a single consonant starts the next syllable, a
        # cluster splits before its last consonant.
        boundaries.append(previous_end if cluster <= 1 else next_start - 1)

    syllables: List[str] = []
    start = 0
    for boundary in boundaries:
        syllables.append(letters[start:boundary])
        start = boundary
    syllables.append(letters[start:])

    # A one-letter tail ("ho-ne-y") reads better joined to the previous
    # syllable ("ho-ney"); a one-letter head ("a-bout") stays on its own.
    merged: List[str] = []
    for syllable in syllables:
        if merged and len(syllable) == 1:
            merged[-1] += syllable
        else:
            merged.append(syllable)
    return [syllable for syllable in merged if syllable]


def _stressed_run(text: str):
    """Return (start, end) of the uppercase run, or None when there is none."""
    match = re.search(r'[A-Z]+', text)
    if not match:
        return None
    return match.start(), match.end()


def syllabify_guide(guide: str) -> List[str]:
    """Split a respelling, keeping the stressed syllable whole.

    The respelling marks stress in capitals ("reZILient"). Splitting on vowel
    nuclei alone can cut that run in half, which hides the very syllable the
    highlight is meant to show, so the stressed part is syllabified as its own
    block and the parts around it are split separately.
    """
    text = (guide or '').strip()
    if not text:
        return []

    run = _stressed_run(text)
    if not run:
        return syllabify(text)

    start, end = run
    syllables: List[str] = []
    prefix, stressed, suffix = text[:start], text[start:end], text[end:]
    if prefix:
        syllables.extend(syllabify(prefix))
    syllables.append(stressed)
    if suffix:
        syllables.extend(syllabify(suffix))
    return syllables


def build_pronunciation(
    ipa: str,
    guide: str,
    romanization: str,
    source_lang: str,
) -> Dict:
    """Return the pronunciation block: IPA, hyphenated respelling, syllables."""
    base = (guide or romanization or '').strip()
    syllables = syllabify_guide(base)
    return {
        'ipa': (ipa or '').strip(),
        'fonetik': '-'.join(syllables),
        'suku_kata': [syllable.lower() for syllable in syllables],
    }
