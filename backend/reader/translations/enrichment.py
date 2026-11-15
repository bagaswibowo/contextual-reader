"""Mother-tongue enrichment for a dictionary entry.

``dictionary.lookup`` answers "what does this word mean in its own language".
A reader also needs, in one open, three things the source-language entry cannot
provide:

1. the meaning in the reader's mother tongue, with the other senses that word
   can carry (a single translation hides the alternatives);
2. a readable pronunciation guide, because IPA is not readable for a beginner;
3. example sentences in the source language next to their mother-tongue
   translation.

Everything here is derived from Google Translate's public web endpoint, the same
provider ``services.GoogleTranslateClient`` already uses, so no new credential
or upstream contract is introduced. Results are cached in ``LocMemCache``: the
data is derived, so losing it costs one extra call and nothing else.

Failure policy: every helper returns an empty value instead of raising. A
partially enriched card beats an error page while someone is reading.
"""

from __future__ import annotations

import hashlib
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List

from django.core.cache import cache

from .provider import (
    is_latin_script,
    is_translate_payload,
    normalize_lang,
    translate_query,
)

ENRICHMENT_CACHE_TTL = 86400 * 7
MAX_EXAMPLES = 4
MAX_TRANSLATIONS = 8


def _cache_key(prefix: str, *parts: str) -> str:
    """Hash the variable part so the key is safe for any cache backend."""
    digest = hashlib.sha256('|'.join(parts).encode()).hexdigest()[:32]
    return f'{prefix}:{digest}'

# Multi-character IPA symbols must be replaced before their single-character
# parts, otherwise "tʃ" would become "c" plus a stray "sy".
_IPA_SEQUENCES = [
    ('tʃ', 'c'), ('dʒ', 'j'), ('eɪ', 'ei'), ('aɪ', 'ai'), ('ɔɪ', 'oi'),
    ('aʊ', 'au'), ('oʊ', 'ou'), ('əʊ', 'ou'), ('ɪə', 'ia'), ('eə', 'ea'),
    ('ʊə', 'ua'), ('ɜːr', 'er'), ('ɜr', 'er'), ('ɜː', 'er'), ('ɜ', 'er'), ('ɝ', 'er'), ('ɚ', 'er'),
    ('ʃ', 'sy'), ('ʒ', 'j'), ('θ', 'th'), ('ð', 'dh'), ('ŋ', 'ng'),
    ('ɡ', 'g'), ('ʔ', ''), ('ː', ''), ('ˌ', ''), ('ˑ', ''),
]

_IPA_SINGLE = {
    'ɪ': 'i', 'i': 'i', 'ɛ': 'e', 'e': 'e', 'æ': 'a', 'ʌ': 'a', 'ə': 'e',
    'ɑ': 'o', 'ɒ': 'o', 'ɔ': 'o', 'ʊ': 'u', 'u': 'u', 'y': 'i', 'ø': 'e',
    'œ': 'e', 'ɐ': 'a', 'ɨ': 'i', 'ʉ': 'u', 'ɯ': 'u', 'j': 'y', 'r': 'r',
    'ɹ': 'r', 'ɾ': 'r', 'ʤ': 'j', 'ʧ': 'c', 'x': 'kh', 'ɣ': 'g', 'c': 'k',
    # Google's reading field uses macrons and circumflexes for long vowels.
    'ā': 'ei', 'ē': 'i', 'ī': 'ai', 'ō': 'ou', 'ū': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
}


def _transliterate(text: str) -> str:
    """Map IPA symbols to Latin letters, dropping stress and length marks."""
    text = text.replace('ˈ', '').replace('ˌ', '')
    for symbol, latin in _IPA_SEQUENCES:
        text = text.replace(symbol, latin)
    text = ''.join(_IPA_SINGLE.get(char, char) for char in text)
    return re.sub(r"[^a-zA-Z'\- ]+", '', text).strip()


def ipa_to_guide(ipa: str) -> str:
    """Turn an IPA transcription into a Latin spelling a beginner can read.

    This is a deterministic transliteration, not a transcription: it keeps the
    syllable the IPA marks as stressed in capitals ("rəˈzilēənt" -> "ri-ZIL-ent").
    Returns an empty string when there is nothing usable to convert.
    """
    if not isinstance(ipa, str):
        return ''
    raw = ipa.strip().strip('/[]')
    if not raw:
        return ''

    plain = _transliterate(raw)
    if not plain:
        return ''

    marker = raw.find('ˈ')
    if marker == -1:
        return plain

    # Uppercase the syllable that follows the primary stress mark, the
    # convention printed dictionaries use for a respelling.
    consumed = len(_transliterate(raw[:marker]))
    return _uppercase_stressed_syllable(plain, consumed)


def _uppercase_stressed_syllable(plain: str, consumed: int) -> str:
    """Uppercase the syllable at ``consumed``: onset + vowel group + coda."""
    groups = [(match.start(), match.end()) for match in re.finditer(r'[aeiouy]+', plain)]
    if not groups:
        return plain

    target = next((group for group in groups if group[0] >= consumed), groups[-1])
    start = 0
    for group in groups:
        if group[1] <= target[0]:
            start = group[1]
    end = len(plain)
    for group in groups:
        if group[0] >= target[1]:
            end = group[0]
            break
    return f'{plain[:start]}{plain[start:end].upper()}{plain[end:]}'


def _translate_text(text: str, source_lang: str, mother_lang: str) -> str:
    if not text:
        return ''
    payload = translate_query({
        'sl': source_lang or 'auto', 'tl': mother_lang,
        'dt': 't', 'q': text,
    })
    if not is_translate_payload(payload):
        return ''
    return ''.join(
        segment[0] for segment in payload[0]
        if isinstance(segment, list) and segment and isinstance(segment[0], str)
    ).strip()


def fetch_word_enrichment(word: str, source_lang: str, mother_lang: str) -> Dict:
    """Mother-tongue meanings, pronunciation guide and alternatives for one word."""
    source = normalize_lang(source_lang) or 'auto'
    mother = normalize_lang(mother_lang) or 'id'
    if not word:
        return _empty_enrichment(mother)

    cache_key = _cache_key('dict_enrich', source, mother, word.lower())
    cached = cache.get(cache_key)
    if cached:
        return cached

    payload = translate_query({
        'client': 'gtx', 'sl': source, 'tl': mother,
        'dt': ['t', 'bd', 'rm'], 'q': word,
    })
    if not is_translate_payload(payload):
        return _empty_enrichment(mother)

    primary = ''
    if payload[0] and isinstance(payload[0][0], list) and payload[0][0]:
        primary = (payload[0][0][0] or '').strip()

    romanization = ''
    ipa = ''
    if len(payload[0]) > 1 and isinstance(payload[0][1], list):
        # Google returns the reading in index 3: an IPA-style respelling for
        # Latin scripts, a romanization for every other script.
        segment = payload[0][1]
        reading = str(segment[3]).strip() if len(segment) > 3 and segment[3] else ''
        if is_latin_script(source):
            ipa = reading
        else:
            romanization = reading

    translations: List[Dict] = []
    if len(payload) > 1 and payload[1]:
        for group in payload[1]:
            if not isinstance(group, list) or len(group) < 2:
                continue
            pos = (group[0] or '').strip()
            for option in group[1] or []:
                candidate = option[0] if isinstance(option, list) and option else option
                candidate = (candidate or '').strip() if isinstance(candidate, str) else ''
                if not candidate or len(translations) >= MAX_TRANSLATIONS:
                    continue
                back = option[1] if isinstance(option, list) and len(option) > 1 else []
                translations.append({
                    'target_word': candidate,
                    'pos': pos,
                    'back_translations': [str(value) for value in (back or [])][:6],
                })

    # The contextual translation is the best first variant; Google's sense list
    # does not always repeat it.
    if primary and all(item['target_word'] != primary for item in translations):
        translations.insert(0, {
            'target_word': primary,
            'pos': translations[0]['pos'] if translations else '',
            'back_translations': [],
        })

    guide = ''
    if is_latin_script(source):
        guide = ipa_to_guide(ipa)
    if not guide and romanization and romanization != word:
        guide = romanization

    result = {
        'mother_lang': mother,
        'primary_meaning': primary,
        'pronunciation': {
            'ipa': ipa,
            'guide': guide,
            'romanization': romanization,
        },
        'translations': translations,
    }
    cache.set(cache_key, result, timeout=ENRICHMENT_CACHE_TTL)
    return result


def _empty_enrichment(mother_lang: str) -> Dict:
    return {
        'mother_lang': mother_lang,
        'primary_meaning': '',
        'pronunciation': {'ipa': '', 'guide': '', 'romanization': ''},
        'translations': [],
    }


def build_examples(
    source_sentences: List[str],
    word: str,
    source_lang: str,
    mother_lang: str,
    meaning: str = '',
    part_of_speech: str = '',
    minimum: int = 3,
) -> List[Dict]:
    """Return example sentences, topping up with model-written everyday usage.

    Real sentences from the reader's book or the dictionary come first. When
    there are too few, the configured model writes short everyday sentences so
    the card never opens with an empty example block.
    """
    sentences = [text.strip() for text in source_sentences if isinstance(text, str) and text.strip()]
    sentences = list(dict.fromkeys(sentences))[:MAX_EXAMPLES]

    cache_key = _cache_key(
        'dict_examples',
        normalize_lang(source_lang),
        normalize_lang(mother_lang),
        word.lower(),
        str(minimum),
        *sentences,
    )
    cached = cache.get(cache_key)
    if cached:
        return cached

    with ThreadPoolExecutor(max_workers=max(1, len(sentences))) as executor:
        translated = list(executor.map(
            lambda text: _translate_text(text, source_lang, mother_lang),
            sentences,
        )) if sentences else []

    examples = [
        {'source_text': source, 'target_text': target, 'keyword': word, 'origin': 'corpus'}
        for source, target in zip(sentences, translated)
        if source
    ]

    if len(examples) < minimum:
        try:
            generated = generate_everyday_examples(
                word, source_lang, mother_lang, meaning, part_of_speech
            )
        except Exception:
            generated = []
        existing = {item['source_text'].lower() for item in examples}
        for item in generated:
            if len(examples) >= MAX_EXAMPLES:
                break
            if item['source_text'].lower() in existing:
                continue
            examples.append(item)
            existing.add(item['source_text'].lower())

    cache.set(cache_key, examples, timeout=ENRICHMENT_CACHE_TTL)
    return examples


_EXAMPLE_PROMPT = (
    'You write short example sentences for a language learner.\n'
    'Target word: "{word}"\n'
    'Language of the word: "{source}"\n'
    'Meaning in "{mother}": "{meaning}"\n'
    'Part of speech: "{pos}"\n'
    'Write 3 short, natural, everyday sentences in "{source}" that use the word '
    'exactly in the given form, the kind of sentence a person says or reads in '
    'daily life. Then give the "{mother}" translation of each sentence.\n'
    'Output ONLY JSON: '
    '{{"examples": [{{"source": "...", "target": "..."}}]}}'
)


def generate_everyday_examples(
    word: str,
    source_lang: str,
    mother_lang: str,
    meaning: str = '',
    part_of_speech: str = '',
) -> List[Dict]:
    """Ask the configured model for everyday sentences; drop anything unusable."""
    if not word:
        return []

    from .services import LLMClient

    client = LLMClient()
    response = client.get_completion_text([
        {
            'role': 'system',
            'content': _EXAMPLE_PROMPT.format(
                word=word,
                source=normalize_lang(source_lang) or 'auto',
                mother=normalize_lang(mother_lang) or 'id',
                meaning=meaning or word,
                pos=part_of_speech or '-',
            ),
        },
        {'role': 'user', 'content': f'Word: "{word}"'},
    ])
    return _parse_example_response(response, word, source_lang)


def _parse_example_response(response: str, word: str, source_lang: str) -> List[Dict]:
    import json

    if not isinstance(response, str) or '{' not in response:
        return []
    start, end = response.find('{'), response.rfind('}')
    try:
        payload = json.loads(response[start:end + 1])
    except ValueError:
        return []

    raw = payload.get('examples') if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return []

    word_lower = word.lower().strip()
    stem = word_lower[:-2] if word_lower.endswith('ed') and len(word_lower) > 4 else word_lower
    examples = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        source = str(item.get('source') or '').strip()
        target = str(item.get('target') or '').strip()
        if not source or not target or len(source) > 240 or len(target) > 240:
            continue
        lowered = source.lower()
        if word_lower not in lowered and stem not in lowered:
            continue
        examples.append({
            'source_text': source,
            'target_text': target,
            'keyword': word,
            'origin': 'model',
            'lang': normalize_lang(source_lang),
        })
        if len(examples) >= 3:
            break
    return examples


def translate_sentence(text: str, source_lang: str, mother_lang: str) -> Dict:
    """Mother-tongue translation of the sentence the word was clicked in."""
    cleaned = ' '.join((text or '').split())
    if not cleaned:
        return {'source_text': '', 'target_text': ''}

    cache_key = _cache_key('dict_sentence', normalize_lang(source_lang), normalize_lang(mother_lang), cleaned)
    cached = cache.get(cache_key)
    if cached:
        return cached

    result = {
        'source_text': cleaned,
        'target_text': _translate_text(cleaned, source_lang, mother_lang),
    }
    cache.set(cache_key, result, timeout=ENRICHMENT_CACHE_TTL)
    return result

