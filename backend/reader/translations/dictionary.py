"""Dictionary lookup for the word insight card.

The lookup is cached in the database (``DictionaryEntry``) rather than in
``LocMemCache``: the local-memory cache is per process and is lost on restart,
so every worker would call the upstream provider again.

Providers, in order:
1. Free Dictionary API (definitions, examples, synonyms, IPA for supported languages).
2. Google Translate via ``GoogleTranslateClient`` (translation-only fallback).
"""

from __future__ import annotations

import re
from datetime import timedelta
from urllib.parse import quote

import requests
from django.utils import timezone

from .models import DictionaryEntry
from .services import GoogleTranslateClient

DICTIONARY_CACHE_TTL = timedelta(days=7)
FREE_DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/{lang}/{word}'
REQUEST_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )
}
MAX_SENSES = 8
MAX_SYNONYMS = 12


class DictionaryProviderError(RuntimeError):
    """Raised when no provider could return a usable entry."""


class DictionaryNotFound(DictionaryProviderError):
    """Raised when the word is neither cached nor available from a provider."""


def normalize_lang(lang: str) -> str:
    value = (lang or '').strip().lower().replace('_', '-')
    aliases = {
        'zh-cn': 'zh',
        'zh-tw': 'zh',
        'zh-hans': 'zh',
        'zh-hant': 'zh',
        'in': 'id',
    }
    return aliases.get(value, value)


def build_audio_url(word: str, lang: str) -> str:
    """Return the word-level TTS proxy URL (relative, so it follows the API host)."""
    return (
        f"/api/translations/tts/?text={quote(word, safe='')}"
        f"&lang={quote(normalize_lang(lang), safe='')}"
    )


def _clean_text(value) -> str:
    if not isinstance(value, str):
        return ''
    return re.sub(r'\s+', ' ', value).strip()


def _dedupe(values) -> list[str]:
    seen = set()
    result = []
    for value in values or []:
        text = _clean_text(value)
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def _context_tokens(context: str) -> set[str]:
    return {token for token in re.findall(r"[\w']+", (context or '').lower()) if len(token) > 2}


def _rank_by_context(senses: list[dict], context: str) -> list[dict]:
    """Stable-sort senses so ones whose example matches the sentence come first."""
    tokens = _context_tokens(context)
    if not tokens or not senses:
        return senses

    def score(sense: dict) -> int:
        haystack = ' '.join(
            [sense.get('meaning', '')]
            + list(sense.get('examples') or [])
            + list(sense.get('synonyms') or [])
        ).lower()
        return -sum(1 for token in tokens if token in haystack)

    return sorted(senses, key=score)


def _fetch_free_dictionary(word: str, lang: str) -> dict:
    url = FREE_DICTIONARY_URL.format(lang=quote(lang, safe=''), word=quote(word, safe=''))
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=6)
    except requests.RequestException as exc:
        raise DictionaryProviderError('dictionary provider unreachable') from exc

    if response.status_code != 200:
        raise DictionaryProviderError(f'dictionary provider returned {response.status_code}')

    try:
        payload = response.json()
    except ValueError as exc:
        raise DictionaryProviderError('dictionary provider returned invalid JSON') from exc

    if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
        raise DictionaryProviderError('dictionary provider returned no entry')

    entry = payload[0]
    senses: list[dict] = []
    synonyms: list[str] = []
    part_of_speech = ''
    phonetic_ipa = _clean_text(entry.get('phonetic'))

    if not phonetic_ipa:
        for phonetic in entry.get('phonetics') or []:
            if isinstance(phonetic, dict) and _clean_text(phonetic.get('text')):
                phonetic_ipa = _clean_text(phonetic.get('text'))
                break

    for meaning in entry.get('meanings') or []:
        if not isinstance(meaning, dict):
            continue
        pos = _clean_text(meaning.get('partOfSpeech'))
        if pos and not part_of_speech:
            part_of_speech = pos
        synonyms.extend(meaning.get('synonyms') or [])
        for definition in meaning.get('definitions') or []:
            if not isinstance(definition, dict):
                continue
            text = _clean_text(definition.get('definition'))
            if not text:
                continue
            example = _clean_text(definition.get('example'))
            sense_synonyms = _dedupe(list(definition.get('synonyms') or []) + list(meaning.get('synonyms') or []))
            synonyms.extend(sense_synonyms)
            senses.append({
                'meaning': text,
                'examples': [example] if example else [],
                'synonyms': sense_synonyms[:MAX_SYNONYMS],
            })
            if len(senses) >= MAX_SENSES:
                break
        if len(senses) >= MAX_SENSES:
            break

    if not senses:
        raise DictionaryProviderError('dictionary provider returned no definitions')

    return {
        'part_of_speech': part_of_speech[:50],
        'senses': senses,
        'synonyms': _dedupe(synonyms)[:MAX_SYNONYMS],
        'phonetic_ipa': phonetic_ipa[:100],
        'source': 'free-dictionary',
    }


def _fetch_google_fallback(word: str, lang: str) -> dict:
    data = GoogleTranslateClient.translate_word(word, target_lang='id', mother_lang='id')
    meaning = _clean_text(data.get('contextual_meaning'))
    if not meaning:
        raise DictionaryProviderError('translation provider returned no meaning')
    if meaning.lower() == word.lower() and not data.get('other_meanings'):
        raise DictionaryProviderError('translation provider returned the input unchanged')

    synonyms = []
    for label in data.get('other_meanings') or []:
        _, _, values = str(label).partition(':')
        synonyms.extend(part.strip() for part in (values or '').split(',') if part.strip())

    return {
        'part_of_speech': '',
        'senses': [{'meaning': meaning, 'examples': [], 'synonyms': []}],
        'synonyms': _dedupe(synonyms)[:MAX_SYNONYMS],
        'phonetic_ipa': _clean_text(data.get('ipa'))[:100],
        'source': 'google-translate',
    }


def _confidence_for(source: str, stale: bool) -> float:
    base = 0.95 if source == 'free-dictionary' else 0.6
    return round(max(0.2, base - (0.2 if stale else 0.0)), 2)


def serialize_entry(entry: DictionaryEntry, context: str = '', stale: bool = False) -> dict:
    return {
        'word': entry.word,
        'lang': entry.lang,
        'part_of_speech': entry.part_of_speech,
        'phonetic_ipa': entry.phonetic_ipa,
        'audio_url': entry.audio_url or build_audio_url(entry.word, entry.lang),
        'confidence': _confidence_for(entry.source, stale),
        'senses': _rank_by_context(list(entry.senses or []), context),
        'synonyms': list(entry.synonyms or []),
        'source': entry.source,
        'fetched_at': entry.fetched_at,
    }


def lookup(word: str, lang: str, context: str = '') -> dict:
    """Return a dictionary payload, using the DB cache when it is still fresh."""
    word = _clean_text(word)
    lang = normalize_lang(lang)
    word_lower = word.lower()
    now = timezone.now()

    entry = DictionaryEntry.objects.filter(word_lower=word_lower, lang=lang).first()
    if entry and entry.fetched_at >= now - DICTIONARY_CACHE_TTL:
        return serialize_entry(entry, context=context)

    try:
        data = _fetch_free_dictionary(word, lang)
    except DictionaryProviderError:
        try:
            data = _fetch_google_fallback(word, lang)
        except DictionaryProviderError as exc:
            if entry:
                # Serving stale data is better than failing the reading flow.
                return serialize_entry(entry, context=context, stale=True)
            raise DictionaryNotFound(f'No dictionary entry found for "{word}" ({lang})') from exc

    defaults = {
        'word': word[:255],
        'part_of_speech': data['part_of_speech'],
        'senses': data['senses'],
        'synonyms': data['synonyms'],
        'phonetic_ipa': data['phonetic_ipa'],
        'audio_url': build_audio_url(word, lang),
        'source': data['source'],
        'fetched_at': now,
    }
    entry, _ = DictionaryEntry.objects.update_or_create(
        word_lower=word_lower,
        lang=lang,
        defaults=defaults,
    )
    return serialize_entry(entry, context=context)
