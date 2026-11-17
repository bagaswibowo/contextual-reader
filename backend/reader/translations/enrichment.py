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
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import requests
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

TATOEBA_SEARCH_URL = 'https://tatoeba.org/en/api_v0/search'
TATOEBA_TIMEOUT = 6
TATOEBA_CACHE_TTL = 86400
# Tatoeba's bot filter rejects generic browser user agents from servers; an
# honest, descriptive agent gets through and is the polite thing to send.
TATOEBA_HEADERS = {
    'User-Agent': 'ContextualReader/1.0 (word-usage examples; contact: team@bagaswibowo.app)',
    'Accept': 'application/json',
}
# Tatoeba indexes sentences by ISO 639-3, not the ISO 639-1 codes the app uses.
TATOEBA_LANG_CODES = {
    'en': 'eng', 'id': 'ind', 'ms': 'zsm', 'es': 'spa', 'fr': 'fra',
    'de': 'deu', 'it': 'ita', 'pt': 'por', 'nl': 'nld', 'tr': 'tur',
    'vi': 'vie', 'pl': 'pol', 'sv': 'swe', 'da': 'dan', 'no': 'nor',
    'fi': 'fin', 'cs': 'ces', 'sk': 'slk', 'ro': 'ron', 'hu': 'hun',
    'hr': 'hrv', 'sl': 'slv', 'tl': 'tgl', 'sw': 'swh', 'af': 'afr',
    'ca': 'cat', 'ru': 'rus', 'uk': 'ukr', 'ja': 'jpn', 'ko': 'kor',
    'zh': 'cmn', 'ar': 'ara', 'hi': 'hin', 'th': 'tha', 'el': 'ell',
    'he': 'heb', 'fa': 'pes', 'ur': 'urd',
}

# Bump when the shape or the derivation of cached values changes, so entries
# written by an older release are not served after a deploy.
CACHE_VERSION = 'v4'


def _cache_key(prefix: str, *parts: str) -> str:
    """Hash the variable part so the key is safe for any cache backend."""
    digest = hashlib.sha256('|'.join(parts).encode()).hexdigest()[:32]
    return f'{prefix}:{CACHE_VERSION}:{digest}'

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
    'œ': 'e', 'ɐ': 'a', 'ɨ': 'i', 'ʉ': 'u', 'ɯ': 'u', 'j': 'j', 'r': 'r',
    'ɹ': 'r', 'ɾ': 'r', 'ʤ': 'j', 'ʧ': 'c', 'x': 'kh', 'ɣ': 'g', 'c': 'k',
    # Google's reading field uses macrons and circumflexes for long vowels.
    'ā': 'ei', 'ē': 'i', 'ī': 'ai', 'ō': 'ou', 'ū': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
}


def _transliterate(text: str) -> str:
    """Map IPA symbols to Latin letters, dropping stress and length marks."""
    text = text.replace('ˈ', '').replace('ˌ', '')
    # Sequence output must not be re-mapped by the single-symbol table, so park
    # each match behind a placeholder until the single pass is done.
    parked = []
    for index, (symbol, latin) in enumerate(_IPA_SEQUENCES):
        if symbol in text:
            token = f'\x00{index}\x00'
            text = text.replace(symbol, token)
            parked.append((token, latin))
    text = ''.join(_IPA_SINGLE.get(char, char) for char in text)
    for token, latin in parked:
        text = text.replace(token, latin)
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


# One translate request carries a whole card's worth of text when the texts are
# joined by a marker the engine leaves alone, which keeps a cold card inside the
# panel timeout instead of spending it on a queue of single sentences.
TRANSLATE_BATCH_MARKER = ' ||| '


def _translate_cache_key(text: str, source_lang: str, mother_lang: str) -> str:
    return _cache_key(
        'translate_text', normalize_lang(source_lang), normalize_lang(mother_lang), text
    )


def _translate_text(text: str, source_lang: str, mother_lang: str) -> str:
    if not text:
        return ''
    # The same sentence is translated for more than one layer and the card
    # rebuilds its layers on every open, so the result is kept per text.
    cache_key = _translate_cache_key(text, source_lang, mother_lang)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    payload = translate_query({
        'sl': source_lang or 'auto', 'tl': mother_lang,
        'dt': 't', 'q': text,
    })
    if not is_translate_payload(payload):
        return ''
    translated = ''.join(
        segment[0] for segment in payload[0]
        if isinstance(segment, list) and segment and isinstance(segment[0], str)
    ).strip()
    if translated:
        cache.set(cache_key, translated, timeout=ENRICHMENT_CACHE_TTL)
    return translated


def translate_texts(
    texts: List[str],
    source_lang: str,
    mother_lang: str,
) -> List[str]:
    """Translate several texts in one request, keeping their order.

    Texts already cached are not sent. When the answer does not split back into
    the same number of parts the whole batch is retried one text at a time, so a
    wrong split can never put another sentence's words in a layer.
    """
    wanted = [str(text or '') for text in texts]
    if not wanted:
        return []

    keys = [_translate_cache_key(text, source_lang, mother_lang) for text in wanted]
    cached = [cache.get(key) for key in keys]
    pending = [index for index, text in enumerate(wanted) if text and cached[index] is None]
    if not pending:
        return [cached[index] if cached[index] is not None else '' for index in range(len(wanted))]

    # A batch is only safe for whole sentences: the engine reads a row of single
    # words as one phrase and hands the words back out of order. A single word
    # therefore keeps its own request.
    sentences = [index for index in pending if ' ' in wanted[index].strip()]
    words = [index for index in pending if index not in set(sentences)]

    values: Dict[int, str] = {}
    if sentences:
        joined = TRANSLATE_BATCH_MARKER.join(wanted[index] for index in sentences)
        payload = translate_query({
            'sl': source_lang or 'auto', 'tl': mother_lang, 'dt': 't', 'q': joined,
        })
        parts = []
        if is_translate_payload(payload):
            translated = ''.join(
                segment[0] for segment in payload[0]
                if isinstance(segment, list) and segment and isinstance(segment[0], str)
            )
            parts = [part.strip() for part in translated.split('|||')]
        if len(parts) == len(sentences):
            values.update(zip(sentences, parts))
        else:
            # The split failed, so the batch is abandoned rather than mismatched.
            words.extend(sentences)

    if words:
        with ThreadPoolExecutor(max_workers=max(1, min(4, len(words)))) as executor:
            for index, value in zip(words, executor.map(
                lambda index: _translate_text(wanted[index], source_lang, mother_lang),
                words,
            )):
                values[index] = value

    result = [cached[index] if cached[index] is not None else '' for index in range(len(wanted))]
    for index, value in values.items():
        if value:
            cache.set(keys[index], value, timeout=ENRICHMENT_CACHE_TTL)
        result[index] = value
    return result


def _google_examples(payload) -> List[str]:
    """Sentences from Google's example bank (``dt=ex``), if the payload has one.

    The bank sits at the end of the payload as a list of rows, each row holding
    the sentence at index 0 with the queried word wrapped in ``<b>`` tags. Only
    blocks that carry those tags are treated as the bank.
    """
    examples: List[str] = []
    for block in payload if isinstance(payload, list) else []:
        if not isinstance(block, list) or not block:
            continue
        rows = [
            item for item in block
            if isinstance(item, list) and item and isinstance(item[0], list)
        ]
        if not rows:
            continue
        if not any(
            isinstance(row[0], str) and '<b>' in row[0]
            for row in (row for item in rows for row in item)
        ):
            continue
        for item in rows:
            for row in item:
                if isinstance(row, list) and row and isinstance(row[0], str):
                    examples.append(re.sub(r'</?b>', '', row[0]).strip())

    return list(dict.fromkeys(text for text in examples if text))[:MAX_EXAMPLES]


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
        'dt': ['t', 'bd', 'rm', 'ex'], 'q': word,
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
        reading = reading.strip('/[] ')
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
            # Google puts the sense list at index 1 and the same senses with
            # their book-language words at index 2, so the back translations
            # must be read from that third block, matched by the sense itself.
            backs: Dict[str, List[str]] = {}
            if len(group) > 2 and isinstance(group[2], list):
                for sense in group[2]:
                    if not isinstance(sense, list) or len(sense) < 2:
                        continue
                    key = str(sense[0] or '').strip()
                    if key and isinstance(sense[1], list):
                        backs[key] = [str(value) for value in sense[1]][:6]
            for option in group[1] or []:
                candidate = option[0] if isinstance(option, list) and option else option
                candidate = (candidate or '').strip() if isinstance(candidate, str) else ''
                if not candidate or len(translations) >= MAX_TRANSLATIONS:
                    continue
                translations.append({
                    'target_word': candidate,
                    'pos': pos,
                    'back_translations': backs.get(candidate, []),
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

    google_examples = _google_examples(payload)

    result = {
        'mother_lang': mother,
        'primary_meaning': primary,
        'pronunciation': {
            'ipa': ipa,
            'guide': guide,
            'romanization': romanization,
        },
        'translations': translations,
        'google_examples': google_examples,
    }
    cache.set(cache_key, result, timeout=ENRICHMENT_CACHE_TTL)
    return result


def _empty_enrichment(mother_lang: str) -> Dict:
    return {
        'mother_lang': mother_lang,
        'primary_meaning': '',
        'pronunciation': {'ipa': '', 'guide': '', 'romanization': ''},
        'translations': [],
        'google_examples': [],
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

    translated = translate_texts(sentences, source_lang, mother_lang) if sentences else []

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


def fetch_tatoeba_examples(
    word: str,
    lang: str,
    translate_to: str,
    limit: int = 3,
) -> List[Dict]:
    """Real sentences in ``lang`` that use ``word``, with a translation.

    The sentences come from Tatoeba's public corpus of human-written sentences,
    so the card can show actual usage in the language being studied instead of
    a source-language sentence with a translated caption. A translation in the
    reader's mother tongue is kept when the corpus has one; otherwise the
    sentence is translated, and ``origin`` still marks the sentence as corpus.
    """
    source = normalize_lang(lang)
    target = normalize_lang(translate_to)
    source_code = TATOEBA_LANG_CODES.get(source)
    target_code = TATOEBA_LANG_CODES.get(target)
    if not word or not source_code or not target_code:
        return []

    cache_key = _cache_key('tatoeba', source, target, word.lower(), str(limit))
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    payload = None
    # Tatoeba answers 503 when it throttles a burst; one short retry keeps a
    # reading session from losing its examples to a transient rejection.
    for attempt in range(2):
        try:
            response = requests.get(
                TATOEBA_SEARCH_URL,
                params={
                    'query': word,
                    'from': source_code,
                    'to': target_code,
                    'orphans': 'no',
                    'unapproved': 'no',
                    'sort': 'relevance',
                },
                headers=TATOEBA_HEADERS,
                timeout=TATOEBA_TIMEOUT,
            )
        except requests.RequestException:
            response = None
        if response is not None and response.status_code == 200:
            try:
                payload = response.json()
            except ValueError:
                payload = None
            break
        if attempt == 0:
            time.sleep(0.4)

    rows = payload.get('results') if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return []

    # Match the word and, when the corpus sentence uses an inflected form,
    # its stem ("romper" covers "rompió" and "rompe").
    base = word.strip()
    stem = base[:-2] if len(base) > 4 and base[-2:] in {'ar', 'er', 'ir'} else base
    pattern = re.compile(
        rf'(?<!\w){re.escape(stem)}\w*' if stem != base
        else rf'(?<!\w){re.escape(base)}(?!\w)',
        re.IGNORECASE,
    )
    candidates = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        sentence = ' '.join(str(row.get('text') or '').split())
        if not sentence or not pattern.search(sentence) or sentence in seen:
            continue
        seen.add(sentence)
        translation = ''
        for group in row.get('translations') or []:
            for option in group if isinstance(group, list) else []:
                if not isinstance(option, dict):
                    continue
                if option.get('lang') == target_code and option.get('text'):
                    translation = ' '.join(str(option['text']).split())
                    break
            if translation:
                break
        candidates.append({'source_text': sentence, 'target_text': translation})
        if len(candidates) >= max(limit * 2, 6):
            break

    # Rows without a corpus translation go out in one request, so a page of ten
    # sentences does not stall the card on a queue of single calls.
    missing = [item for item in candidates if not item['target_text']]
    if missing:
        translated = translate_texts(
            [item['source_text'] for item in missing], source, target
        )
        for item, text in zip(missing, translated):
            item['target_text'] = text

    examples = [
        {
            'source_text': item['source_text'],
            'target_text': item['target_text'],
            'keyword': word,
            'origin': 'tatoeba',
        }
        for item in candidates
        if item['target_text']
    ][:limit]

    cache.set(cache_key, examples, timeout=TATOEBA_CACHE_TTL)
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



def source_definitions(senses: List[Dict], part_of_speech: str = '') -> List[Dict]:
    """Definitions in the word's own language, straight from the dictionary.

    Used when the studied language is the book language: there is nothing to
    translate, and the Definition tab still needs a list for that sub-tab.
    """
    result = []
    for sense in senses or []:
        definition = str(sense.get('meaning') or '').strip()
        if not definition:
            continue
        example = next(
            (text for text in (sense.get('examples') or []) if isinstance(text, str) and text.strip()),
            '',
        )
        result.append({
            'makna': definition,
            'kelas_kata': part_of_speech or '',
            'contoh': {'source_text': example, 'target_text': ''} if example else None,
            'sesuai_konteks': False,
        })
    if result:
        result[0]['sesuai_konteks'] = True
    return result


def translate_definitions(
    senses: List[Dict],
    source_lang: str,
    mother_lang: str,
    part_of_speech: str = '',
    contextual_meaning: str = '',
) -> List[Dict]:
    """Definitions of the word in the reader's chosen language.

    Each sense keeps its own example sentence, translated as well, and the
    sense that matches the contextual meaning is flagged so the UI can mark it.
    """
    if not senses:
        return []

    cache_key = _cache_key(
        'dict_definitions',
        normalize_lang(source_lang),
        normalize_lang(mother_lang),
        part_of_speech or '',
        contextual_meaning or '',
        *[str(sense.get('meaning') or '') for sense in senses],
    )
    cached = cache.get(cache_key)
    if cached:
        return cached

    definitions = [str(sense.get('meaning') or '').strip() for sense in senses]
    examples = [
        next(
            (text for text in (sense.get('examples') or []) if isinstance(text, str) and text.strip()),
            '',
        )
        for sense in senses
    ]
    # One request carries the definitions and their examples together, so the
    # Definition tab does not pay for a separate call per sense.
    texts = list(dict.fromkeys([text for text in definitions + examples if text]))
    translated = dict(zip(texts, translate_texts(texts, source_lang, mother_lang)))

    result = []
    for definition, example in zip(definitions, examples):
        if not definition:
            continue
        example_pair = None
        if example:
            example_pair = {
                'source_text': example,
                'target_text': translated.get(example, ''),
            }
        result.append({
            'makna': translated.get(definition) or definition,
            'kelas_kata': part_of_speech or '',
            'contoh': example_pair,
            'sesuai_konteks': False,
        })

    # Senses arrive ranked by context overlap, so the first one is the sense
    # the sentence uses. Marking it is a ranking fact, not a guess.
    if result:
        result[0]['sesuai_konteks'] = True

    cache.set(cache_key, result, timeout=ENRICHMENT_CACHE_TTL)
    return result


def build_alternative_meanings(
    translations: List[Dict],
    senses: List[Dict],
    source_lang: str,
    mother_lang: str,
    primary_meaning: str = '',
) -> List[Dict]:
    """Other meanings of the word in the chosen language.

    An example is attached only when the dictionary sense at the same position
    carries one. Nothing is invented: a meaning without a real example keeps
    ``contoh`` empty.
    """
    if not translations:
        return []

    examples = [
        next(
            (text for text in (sense.get('examples') or []) if isinstance(text, str) and text.strip()),
            '',
        )
        for sense in senses
    ]

    picked = []
    for index, item in enumerate(translations):
        value = str(item.get('target_word') or '').strip()
        if not value or value.lower() == (primary_meaning or '').strip().lower():
            continue
        picked.append((index, item, value))

    example_texts = [examples[index] if index < len(examples) else '' for index, _, _ in picked]
    translated_examples = translate_texts(example_texts, source_lang, mother_lang)

    result = []
    for position, (index, item, value) in enumerate(picked):
        example = example_texts[position]
        result.append({
            'makna': value,
            'kelas_kata': item.get('pos') or '',
            # Kept so the layered card can show the sense in the book language
            # without pairing two separate sources by position.
            'back_translations': item.get('back_translations') or [],
            'contoh': {
                'source_text': example,
                'target_text': translated_examples[position] if position < len(translated_examples) else '',
            } if example else None,
        })
    return result


def build_meaning_layers(
    alternatives: List[Dict],
    source_lang: str,
    mother_lang: str,
    learning_lang: str = '',
    makna_layer: str = 'learning',
    other_words: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """Add book, studied and mother-tongue readings to alternative meanings.

    Each row is one sense, so each layer is that sense in one language.
    ``makna`` is the word in ``makna_layer``: ``learning`` for the panel-language
    list, ``mother`` for the mother-tongue list. The book reading is the word
    that sense translates back to in the book language, which the provider
    returns with the sense itself, so no pairing is guessed across sources.

    ``other_words`` maps a book word to the same sense in the other layer's
    language, taken from the other layer's own sense list. A sense found there
    needs no new lookup; the rest are translated. A layer with no real source
    stays empty: nothing is copied between layers and nothing is invented.
    """
    if not alternatives:
        return []

    source = normalize_lang(source_lang)
    mother = normalize_lang(mother_lang) or 'id'
    learning = normalize_lang(learning_lang) or ''
    has_learning = bool(learning) and learning != mother
    # A book word may name more than one sense in the other language ("break"
    # is both "memecahkan" and "mematahkan"), so a pair is only used when that
    # word points at exactly one word there. Anything else is translated, which
    # keeps a shared word from standing in for the wrong sense.
    candidates: Dict[str, set] = {}
    for key, value in (other_words or {}).items():
        word = str(key or '').strip().lower()
        pairs = value if isinstance(value, (set, list, tuple)) else [value]
        for pair in pairs:
            pair = str(pair or '').strip()
            if word and pair:
                candidates.setdefault(word, set()).add(pair)
    known = {
        word: next(iter(pairs)) for word, pairs in candidates.items() if len(pairs) == 1
    }

    rows = []
    for item in alternatives:
        back = [
            str(value).strip() for value in (item.get('back_translations') or [])
            if str(value).strip()
        ]
        book = back[0] if back else ''
        matched = known.get(book.lower(), '') if book else ''
        rows.append({
            'item': item,
            'book': book,
            'word': str(item.get('makna') or '').strip(),
            'matched': matched,
        })

    # Only senses the other layer did not already carry need a lookup, and those
    # are single words, so each keeps its own request. The mother list has no
    # other layer to fill when the studied language is the mother tongue.
    if makna_layer == 'mother' and not has_learning:
        missing = []
    else:
        missing = [row['word'] for row in rows if not row['matched'] and row['word']]
    if makna_layer == 'mother':
        translated = translate_texts(missing, mother, learning) if missing else []
    else:
        translated = translate_texts(missing, learning or source, mother) if missing else []
    pending = iter(translated)

    layered = []
    for row in rows:
        entry = dict(row['item'])
        other = row['matched'] or (next(pending, '') if row['word'] else '')
        entry['meaning_book'] = row['book']
        if makna_layer == 'mother':
            entry['meaning_learning'] = other if has_learning else ''
            entry['meaning_mother'] = row['word']
        else:
            entry['meaning_learning'] = row['word'] if has_learning else ''
            entry['meaning_mother'] = other
        layered.append(entry)
    return layered


def build_example_layers(
    examples: List[Dict],
    source_lang: str,
    learning_lang: str,
    mother_lang: str,
) -> List[Dict]:
    """Add book, studied and mother-tongue text to each example sentence.

    ``source_text`` is the sentence in the book language and ``target_text`` the
    mother tongue, so both come from existing data. The studied reading is a
    real translation of the same sentence; when the studied language equals the
    book language, that side is reused instead of translating twice. A studied
    layer that would only repeat the mother tongue stays empty.
    """
    if not examples:
        return []

    source = normalize_lang(source_lang) or 'auto'
    learning = normalize_lang(learning_lang) or ''
    mother = normalize_lang(mother_lang) or 'id'

    def learning_text(example: Dict) -> str:
        book_text = str(example.get('source_text') or '').strip()
        mother_text = str(example.get('target_text') or '').strip()
        if not learning or learning == mother:
            return mother_text
        if learning == source:
            return book_text
        return ''

    learning_texts = [learning_text(example) for example in examples]
    pending = [
        index for index, value in enumerate(learning_texts)
        if not value and str(examples[index].get('source_text') or '').strip()
    ]
    if pending:
        translated = translate_texts(
            [str(examples[index].get('source_text') or '').strip() for index in pending],
            source,
            learning,
        )
        for index, value in zip(pending, translated):
            learning_texts[index] = value

    layered = []
    for index, item in enumerate(examples):
        row = dict(item)
        row['text_book'] = str(item.get('source_text') or '').strip()
        row['text_learning'] = (
            learning_texts[index] if index < len(learning_texts) and learning_texts[index] else ''
        )
        row['text_mother'] = str(item.get('target_text') or '').strip()
        layered.append(row)
    return layered


def build_nested_example_layers(
    rows: List[Dict],
    source_lang: str,
    learning_lang: str,
    mother_lang: str,
    target_layer: str = 'mother',
) -> List[Dict]:
    """Add three text layers to each row's nested ``contoh`` in place.

    ``contoh`` carries ``source_text`` (the book-language sentence). ``target_text``
    is the layer named by ``target_layer``: ``'mother'`` for the mother-tongue
    list, where it already holds the mother reading, or ``'learning'`` for the
    panel-language list, where it holds the studied reading. The third layer is a
    real translation of the book sentence, sent in one request; when the studied
    language equals the book or mother language the same text is reused, and a
    layer that is unavailable stays empty. Rows that already carry all three text
    layers (corpus-sourced examples) are left untouched. ``source_text`` and
    ``target_text`` stay, so older clients keep working.
    """
    if not rows:
        return rows

    source = normalize_lang(source_lang) or 'auto'
    learning = normalize_lang(learning_lang) or ''
    mother = normalize_lang(mother_lang) or 'id'

    pending = []
    for row in rows:
        contoh = row.get('contoh')
        if not isinstance(contoh, dict) or 'text_book' in contoh:
            continue
        book = str(contoh.get('source_text') or '').strip()
        if not book:
            continue
        if target_layer == 'mother':
            if learning and learning != source and learning != mother:
                pending.append(book)
        else:
            if mother and mother != source and mother != learning:
                pending.append(book)
    translated = {}
    if pending:
        wanted = list(dict.fromkeys(pending))
        pairs = zip(wanted, translate_texts(
            wanted,
            source,
            learning if target_layer == 'mother' else mother,
        ))
        translated = dict(pairs)

    for row in rows:
        contoh = row.get('contoh')
        if not isinstance(contoh, dict) or 'text_book' in contoh:
            continue
        book = str(contoh.get('source_text') or '').strip()
        other = str(contoh.get('target_text') or '').strip()
        if not book:
            continue
        layered = dict(contoh)
        layered['text_book'] = book
        if target_layer == 'mother':
            layered['text_mother'] = other
            if not learning or learning == mother:
                layered['text_learning'] = other
            elif learning == source:
                layered['text_learning'] = book
            else:
                layered['text_learning'] = translated.get(book, '')
        else:
            layered['text_learning'] = book if learning == source else other
            if not mother:
                layered['text_mother'] = ''
            elif mother == source:
                layered['text_mother'] = book
            elif mother == learning:
                layered['text_mother'] = other
            else:
                layered['text_mother'] = translated.get(book, '')
        row['contoh'] = layered
    return rows

