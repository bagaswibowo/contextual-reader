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
from typing import Dict
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
        'phonetic_ipa': _clean_text(data.get('ipa')).strip('/[] ')[:100] if is_latin_script(lang) else '',
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
    target_lang: str = '',
) -> dict:
    """Build the full word card: source entry plus two meaning layers.

    ``mother_lang`` is the reader's configured mother tongue and ``target_lang``
    the language currently picked in the reading panel. Both layers are present
    in one response so switching the panel language costs no new lookup.
    """
    from .enrichment import (
        build_alternative_meanings,
        build_example_layers,
        build_examples,
        build_meaning_layers,
        fetch_tatoeba_examples,
        fetch_word_enrichment,
        source_definitions,
        translate_definitions,
        translate_sentence,
        translate_texts,
    )
    from .pronunciation import build_pronunciation

    from concurrent.futures import ThreadPoolExecutor

    senses = _rank_by_context(list(entry.senses or []), context)

    def mother_layer():
        try:
            return fetch_word_enrichment(entry.word, entry.lang, mother_lang)
        except Exception:
            return {}

    def studied_layer():
        if not target_lang or target_lang in {mother_lang, entry.lang}:
            return {}
        try:
            return fetch_word_enrichment(entry.word, entry.lang, target_lang)
        except Exception:
            return {}

    def context_line():
        if not context:
            return {'source_text': '', 'target_text': ''}
        try:
            return translate_sentence(context, entry.lang, mother_lang)
        except Exception:
            return {'source_text': context, 'target_text': ''}

    # The mother-tongue layer, the studied layer and the clicked sentence each
    # need their own upstream call, so they run together instead of in a queue.
    with ThreadPoolExecutor(max_workers=3) as executor:
        enrichment_future = executor.submit(mother_layer)
        studied_future = executor.submit(studied_layer)
        context_future = executor.submit(context_line)
        enrichment = enrichment_future.result()
        target_layer = studied_future.result()
        sentence_translation = context_future.result()

    pronunciation = enrichment.get('pronunciation') or {}
    translations = enrichment.get('translations') or []
    primary_meaning = enrichment.get('primary_meaning') or ''
    target_translations = target_layer.get('translations') or []
    target_primary = target_layer.get('primary_meaning') or ''

    def by_book_word(items):
        """Map each book word to the words that carry it in that language.

        Both layers come from the same provider answer, so a sense the other
        layer already has needs no new lookup. A book word shared by several
        senses stays a set, so the caller can refuse to guess between them.
        """
        mapping: Dict[str, set] = {}
        for item in items or []:
            back = item.get('back_translations') or []
            word = str(item.get('target_word') or '').strip()
            book = str(back[0]).strip().lower() if back else ''
            if book and word:
                mapping.setdefault(book, set()).add(word)
        return mapping

    mother_by_book = by_book_word(translations)
    studied_by_book = by_book_word(target_translations)

    # Definitions for the studied language must exist for every language, not
    # only when a second translation layer was fetched. When the studied
    # language is the book language the dictionary senses are already in it;
    # otherwise Google Translate carries the meaning across.
    def studied_definitions():
        if not target_lang or target_lang == mother_lang:
            return []
        if target_lang == entry.lang:
            return source_definitions(senses, entry.part_of_speech)
        try:
            return translate_definitions(
                senses,
                entry.lang,
                target_lang,
                part_of_speech=entry.part_of_speech,
                contextual_meaning=target_primary,
            )
        except Exception:
            return []

    # Everyday sentences in the panel language: real usage of the studied
    # word, from Tatoeba's human-written corpus. Each alternative meaning gets
    # its own sentence too, so "Arti lainnya" is not stuck showing the source
    # language. Nothing is written by a model here: an empty list means the
    # corpus has no sentence for that word.
    def studied_meanings():
        try:
            rows = (
                build_alternative_meanings(
                    target_translations, senses, entry.lang, target_lang, target_primary
                )
                if target_layer
                else []
            )
        except Exception:
            rows = []

        if not (target_layer and target_primary):
            return rows, []

        words = [target_primary]
        words.extend(item['makna'] for item in rows[:2] if item.get('makna'))
        fetched = []
        try:
            with ThreadPoolExecutor(max_workers=len(words)) as executor:
                fetched = list(executor.map(
                    lambda value: fetch_tatoeba_examples(value, target_lang, mother_lang),
                    words,
                ))
        except Exception:
            fetched = []

        # Every corpus sentence needs its book-language reading, and they all go
        # out in one request instead of one per row.
        book_texts = {}
        if target_lang and target_lang != entry.lang:
            wanted = [
                row['source_text']
                for group in fetched
                for row in (group or [])[:2]
                if row.get('source_text')
            ]
            try:
                book_texts = dict(zip(wanted, translate_texts(wanted, target_lang, entry.lang)))
            except Exception:
                book_texts = {}

        for index, item in enumerate(rows[:2]):
            if index + 1 >= len(fetched) or not fetched[index + 1]:
                continue
            item['contoh_bahasa_pilihan'] = fetched[index + 1][:2]
            # The row's own example is now a real sentence in the panel
            # language, so the existing card renders Spanish usage without a
            # second field lookup. The source sentence stays in
            # `contoh_bahasa_pilihan` with its corpus translation.
            best = fetched[index + 1][0]
            # The corpus sentence is in the studied language, so that is its
            # studied layer; the corpus translation is the mother tongue. The
            # book-language layer is a real translation of the same sentence,
            # kept empty when the studied language is the book language.
            item['contoh'] = {
                'source_text': best['source_text'],
                'target_text': best['target_text'],
                'text_book': book_texts.get(best['source_text'], ''),
                'text_learning': best['source_text'],
                'text_mother': best['target_text'],
            }

        # Three language layers on every alternative meaning: the book-language
        # sense, the studied-language word, and the mother-tongue reading. Each
        # is a real source; a missing layer stays empty.
        try:
            rows = build_meaning_layers(
                rows, entry.lang, mother_lang, target_lang,
                other_words=mother_by_book,
            )
        except Exception:
            pass

        # The studied-language example list is written in the studied language
        # with a mother-tongue caption, so its book layer is a real translation
        # of the same sentence, not a copy of another layer.
        studied_examples = fetched[0] if fetched else []
        if studied_examples:
            try:
                studied_examples = build_example_layers(
                    studied_examples, target_lang, target_lang, mother_lang,
                )
                for item in studied_examples:
                    item['text_book'] = book_texts.get(item.get('source_text'), '')
            except Exception:
                pass
        return rows, studied_examples

    def everyday_examples():
        source_examples = []
        # The clicked sentence is the reading line, not an everyday example, so
        # it does not join the example list. Dictionary and corpus examples only.
        source_examples.extend(enrichment.get('google_examples') or [])
        source_examples.extend(
            example
            for sense in senses
            for example in (sense.get('examples') or [])
            if isinstance(example, str) and example.strip()
        )
        try:
            rows = build_examples(
                source_examples,
                entry.word,
                entry.lang,
                mother_lang,
                meaning=primary_meaning,
                part_of_speech=entry.part_of_speech,
            )
        except Exception:
            rows = []

        # Three language layers on every example: the book-language sentence,
        # the studied-language translation, and the mother tongue. The studied
        # reading is a real translation, never a model-written one.
        try:
            return build_example_layers(
                rows,
                entry.lang,
                target_lang or mother_lang,
                mother_lang,
            )
        except Exception:
            return rows

    def mother_meanings():
        try:
            rows = build_alternative_meanings(
                translations, senses, entry.lang, mother_lang, primary_meaning
            )
        except Exception:
            return []
        # The mother-tongue list carries ``makna`` as the mother reading, so the
        # studied layer is translated from the book sense, never copied over.
        try:
            return build_meaning_layers(
                rows, entry.lang, mother_lang, target_lang, makna_layer='mother',
                other_words=studied_by_book,
            )
        except Exception:
            return rows

    def mother_definitions():
        try:
            return translate_definitions(
                senses,
                entry.lang,
                mother_lang,
                part_of_speech=entry.part_of_speech,
                contextual_meaning=primary_meaning,
            )
        except Exception:
            return []

    # The studied language gets its own reading of the word's translation:
    # "divided" is read one way in English, "dividido" another in Spanish.
    def studied_pronunciation():
        if not (target_layer and target_primary):
            return None
        try:
            reading = fetch_word_enrichment(
                target_primary, target_lang, mother_lang
            ).get('pronunciation') or {}
        except Exception:
            reading = {}
        block = build_pronunciation(
            reading.get('ipa') or '',
            reading.get('guide') or '',
            # Google has no reading for every language; fall back to the
            # spelling so the tab still shows syllables, never a guess at IPA.
            reading.get('romanization') or target_primary,
            target_lang,
        )
        block['word'] = target_primary
        block['audio_url'] = build_audio_url(target_primary, target_lang)
        return block

    def resolved(future, default):
        try:
            return future.result()
        except Exception:
            return default

    # Every block below reads from the two layers and writes only its own part
    # of the card, so the six run at once. A cold card is then as slow as its
    # slowest block, not the sum of all of them.
    with ThreadPoolExecutor(max_workers=6) as executor:
        studied_definitions_future = executor.submit(studied_definitions)
        studied_meanings_future = executor.submit(studied_meanings)
        examples_future = executor.submit(everyday_examples)
        mother_meanings_future = executor.submit(mother_meanings)
        mother_definitions_future = executor.submit(mother_definitions)
        pronunciation_future = executor.submit(studied_pronunciation)

        target_definitions = resolved(studied_definitions_future, [])
        target_alternatives, contoh_bahasa_pilihan = resolved(studied_meanings_future, ([], []))
        examples = resolved(examples_future, [])
        alternative_meanings = resolved(mother_meanings_future, [])
        translated_definitions = resolved(mother_definitions_future, [])
        target_pronunciation = resolved(pronunciation_future, None)

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

    pronunciation_block = build_pronunciation(
        phonetic_ipa,
        guide,
        pronunciation.get('romanization') or '',
        entry.lang,
    )

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
            'fonetik': pronunciation_block['fonetik'],
            'suku_kata': pronunciation_block['suku_kata'],
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
        # Fixed fields the word card renders; names are part of the contract.
        # Tab Arti shows meanings only, so there is no `definisi` here; the
        # definition list lives in the Definition tab.
        'arti_konteks': primary_meaning,
        'arti_lain': alternative_meanings,
        'sinonim': list(entry.synonyms or []),
        'terjemahan_lain': [
            item.get('target_word', '')
            for item in translations
            if item.get('target_word')
        ],
        'ipa': phonetic_ipa,
        'fonetik': pronunciation_block['fonetik'],
        'suku_kata': pronunciation_block['suku_kata'],
        'definisi_bahasa_pilihan': translated_definitions,
        # Second meaning layer: the language picked in the reading panel. Empty
        # when it equals the mother tongue or the book language, because then
        # the existing fields already carry it.
        'bahasa_pilihan': target_lang or '',
        'arti_bahasa_pilihan': target_primary,
        'arti_lain_bahasa_pilihan': target_alternatives,
        'terjemahan_lain_bahasa_pilihan': [
            item.get('target_word', '')
            for item in target_translations
            if item.get('target_word')
        ],
        'definisi_bahasa_pilihan_lain': target_definitions,
        # Reading of the word in the panel language, same shape as
        # `pronunciation`; empty when the panel language matches the mother
        # tongue or the book language.
        'pelafalan_bahasa_pilihan': target_pronunciation or {
            'ipa': '', 'fonetik': '', 'suku_kata': [],
        },
        # Everyday sentences in the panel language, fetched from a real-sentence
        # corpus for the studied word and its alternative meanings. Empty when
        # the corpus has none, never filled with invented sentences.
        'contoh_bahasa_pilihan': contoh_bahasa_pilihan,
    }


def lookup(
    word: str,
    lang: str,
    context: str = '',
    mother_lang: str = 'id',
    target_lang: str = '',
) -> dict:
    """Return a dictionary payload, using the DB cache when it is still fresh."""
    word = _clean_text(word)
    lang = normalize_lang(lang)
    mother_lang = normalize_lang(mother_lang) or 'id'
    target_lang = normalize_lang(target_lang) if target_lang else ''
    word_lower = word.lower()
    now = timezone.now()

    entry = DictionaryEntry.objects.filter(word_lower=word_lower, lang=lang).first()
    if entry and entry.fetched_at >= now - DICTIONARY_CACHE_TTL:
        return serialize_entry(entry, context=context, mother_lang=mother_lang, target_lang=target_lang)

    try:
        data = _fetch_free_dictionary(word, lang)
    except DictionaryProviderError:
        try:
            data = _fetch_google_fallback(word, lang)
        except DictionaryProviderError as exc:
            if entry:
                # Serving stale data is better than failing the reading flow.
                return serialize_entry(entry, context=context, stale=True, mother_lang=mother_lang, target_lang=target_lang)
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
    return serialize_entry(entry, context=context, mother_lang=mother_lang, target_lang=target_lang)
