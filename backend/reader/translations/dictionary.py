"""Dictionary lookup for the word insight card.

The lookup is cached in the database (``DictionaryEntry``) rather than in
``LocMemCache``: the local-memory cache is per process and is lost on restart,
so every worker would call the upstream provider again.

Providers, in order:
1. Free Dictionary API (definitions, examples, synonyms, IPA for supported languages).
2. Google Translate via ``GoogleTranslateClient`` (translation-only fallback).

The source-language entry is then enriched once per (word, lang, mother_lang)
with the mother-tongue meanings, a readable pronunciation guide, and bilingual
example sentences. That enrichment is cached in ``LocMemCache`` because it is
derived data: losing it only costs one extra upstream call.
"""

from __future__ import annotations

import re
from datetime import timedelta
from urllib.parse import quote

import requests
from django.utils import timezone

from .models import DictionaryEntry
from .provider import REQUEST_HEADERS, is_latin_script, normalize_lang
from .services import GoogleTranslateClient

DICTIONARY_CACHE_TTL = timedelta(days=7)
FREE_DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/{lang}/{word}'
MAX_SENSES = 8
MAX_SYNONYMS = 12


class DictionaryProviderError(RuntimeError):
    """Raised when no provider could return a usable entry."""


class DictionaryNotFound(DictionaryProviderError):
    """Raised when the word is neither cached nor available from a provider."""


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
        # Google's reading field is a romanization for non-Latin scripts, not IPA.
        'phonetic_ipa': _clean_text(data.get('ipa'))[:100] if is_latin_script(lang) else '',
        'source': 'google-translate',
    }


def _confidence_for(source: str, stale: bool) -> float:
    base = 0.95 if source == 'free-dictionary' else 0.6
    return round(max(0.2, base - (0.2 if stale else 0.0)), 2)


def serialize_entry(
    entry: DictionaryEntry,
    context: str = '',
    stale: bool = False,
    mother_lang: str = 'id',
) -> dict:
    """Build the full word card: source-language entry plus mother-tongue layer."""
    from .enrichment import build_examples, fetch_word_enrichment, translate_sentence

    senses = _rank_by_context(list(entry.senses or []), context)
    try:
        enrichment = fetch_word_enrichment(entry.word, entry.lang, mother_lang)
    except Exception:
        enrichment = {}
    pronunciation = enrichment.get('pronunciation') or {}
    translations = enrichment.get('translations') or []
    primary_meaning = enrichment.get('primary_meaning') or ''

    source_examples = []
    if context and entry.word.lower() in context.lower():
        source_examples.append(context)
    source_examples.extend(enrichment.get('google_examples') or [])
    source_examples.extend(
        example
        for sense in senses
        for example in (sense.get('examples') or [])
        if isinstance(example, str) and example.strip()
    )
    try:
        examples = build_examples(
            source_examples,
            entry.word,
            entry.lang,
            mother_lang,
            meaning=primary_meaning,
            part_of_speech=entry.part_of_speech,
        )
    except Exception:
        examples = []

    try:
        sentence_translation = translate_sentence(context, entry.lang, mother_lang) if context else {
            'source_text': '', 'target_text': ''
        }
    except Exception:
        sentence_translation = {'source_text': context, 'target_text': ''}

    phonetic_ipa = entry.phonetic_ipa or pronunciation.get('ipa') or ''
    if not is_latin_script(entry.lang):
        # A romanization is not IPA; the header must not print it as one.
        phonetic_ipa = ''
    guide = pronunciation.get('guide') or ''

    other_meanings = []
    for item in translations:
        value = item.get('target_word') or ''
        if not value:
            continue
        pos = item.get('pos') or ''
        other_meanings.append(f'{pos}: {value}' if pos else value)

    definitions = [
        {
            'pos': entry.part_of_speech,
            'definition': sense.get('meaning', ''),
            'example_phrase': (sense.get('examples') or [''])[0],
            'synonyms': sense.get('synonyms') or [],
        }
        for sense in senses
    ]

    return {
        'word': entry.word,
        'lang': entry.lang,
        'mother_lang': enrichment.get('mother_lang') or mother_lang,
        'part_of_speech': entry.part_of_speech,
        'phonetic_ipa': phonetic_ipa,
        'pronunciation': {
            'ipa': phonetic_ipa,
            'guide': guide,
            'romanization': pronunciation.get('romanization') or '',
        },
        'audio_url': entry.audio_url or build_audio_url(entry.word, entry.lang),
        'confidence': _confidence_for(entry.source, stale),
        'contextual_meaning': primary_meaning,
        'mother_meaning': primary_meaning,
        'other_meanings': other_meanings,
        'translations_table': [
            {
                'target_word': item.get('target_word', ''),
                'pos': item.get('pos', ''),
                # Ordinal rank for display, not a corpus frequency.
                'frequency': 3 if index == 0 else 2,
                'back_translations': item.get('back_translations', []),
            }
            for index, item in enumerate(translations)
        ],
        'definitions': definitions,
        'senses': senses,
        'examples': examples,
        'sentence_translation': sentence_translation,
        'synonyms': list(entry.synonyms or []),
        'source': entry.source,
        'fetched_at': entry.fetched_at,
    }


def lookup(word: str, lang: str, context: str = '', mother_lang: str = 'id') -> dict:
    """Return a dictionary payload, using the DB cache when it is still fresh."""
    word = _clean_text(word)
    lang = normalize_lang(lang)
    mother_lang = normalize_lang(mother_lang) or 'id'
    word_lower = word.lower()
    now = timezone.now()

    entry = DictionaryEntry.objects.filter(word_lower=word_lower, lang=lang).first()
    if entry and entry.fetched_at >= now - DICTIONARY_CACHE_TTL:
        return serialize_entry(entry, context=context, mother_lang=mother_lang)

    try:
        data = _fetch_free_dictionary(word, lang)
    except DictionaryProviderError:
        try:
            data = _fetch_google_fallback(word, lang)
        except DictionaryProviderError as exc:
            if entry:
                # Serving stale data is better than failing the reading flow.
                return serialize_entry(entry, context=context, stale=True, mother_lang=mother_lang)
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
    return serialize_entry(entry, context=context, mother_lang=mother_lang)
