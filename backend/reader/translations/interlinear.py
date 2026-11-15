"""Word-by-word alignment and grammar notes for a sentence.

The sentence panel shows three layers for one sentence: the full translation,
each source word next to its meaning, and the grammatical shape of the
sentence. The full translation is context-aware (one call for the whole
sentence). The per-word layer is a dictionary lookup per token, because
alignment across languages is not something the free provider exposes; each
token also carries the alternative meanings the provider returns, so the
reader can swap a word that was translated too literally.

Everything is cached per sentence and language pair. A repeated click on the
same sentence costs nothing.
"""

from __future__ import annotations

import hashlib
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

from django.core.cache import cache

from .provider import is_translate_payload, normalize_lang, translate_query

CACHE_TTL = 86400 * 7
CACHE_VERSION = 'v1'
MAX_TOKENS = 60
MAX_ALTERNATIVES = 3

_AUXILIARIES = {
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'can', 'could', 'shall', 'should',
    'may', 'might', 'must',
}

_INDONESIAN_MARKERS = {
    'adalah', 'akan', 'sudah', 'telah', 'sedang', 'belum', 'bisa',
    'harus', 'ingin', 'mau', 'tidak', 'tak', 'pernah', 'masih',
}

# A subject pronoun is followed by its verb, which catches third-person "-s"
# forms ("she reads") that the suffix rules alone would miss.
_SUBJECT_PRONOUNS = {
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'saya', 'aku', 'kamu', 'anda', 'dia', 'kami', 'kita', 'mereka',
}

_PREPOSITIONS = {
    'to', 'for', 'with', 'in', 'on', 'at', 'by', 'from', 'about', 'of',
    'into', 'over', 'under', 'after', 'before', 'during', 'without',
    'through', 'against', 'between', 'among', 'across', 'behind',
    'di', 'ke', 'dari', 'pada', 'dengan', 'untuk', 'tentang', 'dalam',
    'oleh', 'sejak', 'sampai', 'antara', 'terhadap', 'bagi', 'tanpa',
}

_LABELS = {
    'subject': 'Subjek',
    'predicate': 'Predikat',
    'object': 'Objek',
    'adverbial': 'Keterangan',
    'neutral': 'Kalimat',
}

_CJK_LANGS = {'zh', 'ja'}


def _cache_key(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256('|'.join(parts).encode()).hexdigest()[:32]
    return f'{prefix}:{CACHE_VERSION}:{digest}'


def _clean_token(piece: str) -> str:
    return re.sub(r'^[^\w]+|[^\w]+$', '', piece, flags=re.UNICODE)


def tokenize(text: str, lang: str) -> List[Dict]:
    """Split a sentence into display tokens, keeping punctuation attached."""
    code = normalize_lang(lang)
    if code == 'zh':
        try:
            import jieba

            pieces = [piece for piece in jieba.cut(text) if piece.strip()]
        except Exception:
            pieces = [char for char in text if char.strip()]
    elif code == 'ja':
        try:
            import tinysegmenter

            pieces = [
                piece for piece in tinysegmenter.TinySegmenter().tokenize(text)
                if piece.strip()
            ]
        except Exception:
            pieces = re.findall(r'[\u3040-\u30ff\u4e00-\u9faf]+|[A-Za-z0-9]+', text)
    else:
        pieces = text.split()

    tokens = []
    for piece in pieces:
        clean = _clean_token(piece)
        if not clean:
            continue
        tokens.append({'index': len(tokens), 'source': piece, 'clean': clean})
    return tokens


def _translate_token(clean: str, source: str, target: str) -> Dict:
    if not clean:
        return {'target': '', 'alternatives': []}

    cache_key = _cache_key('interlinear_token', source, target, clean.lower())
    cached = cache.get(cache_key)
    if cached:
        return cached

    payload = translate_query({
        'sl': source, 'tl': target, 'dt': ['t', 'bd'], 'q': clean,
    })
    target_text = ''
    alternatives: List[str] = []
    if is_translate_payload(payload):
        if payload[0] and isinstance(payload[0][0], list) and payload[0][0]:
            target_text = (payload[0][0][0] or '').strip()
        if len(payload) > 1 and isinstance(payload[1], list):
            for group in payload[1]:
                if not isinstance(group, list) or len(group) < 2:
                    continue
                for option in group[1] or []:
                    value = option[0] if isinstance(option, list) and option else option
                    if isinstance(value, str) and value.strip():
                        alternatives.append(value.strip())

    alternatives = [
        value for value in dict.fromkeys(alternatives)
        if value and value.lower() != target_text.lower()
    ][:MAX_ALTERNATIVES]

    result = {'target': target_text, 'alternatives': alternatives}
    cache.set(cache_key, result, timeout=CACHE_TTL)
    return result


def _find_verb_index(tokens: List[str], lang: str) -> Optional[int]:
    code = normalize_lang(lang)
    if len(tokens) > 1 and tokens[0].lower() in _SUBJECT_PRONOUNS:
        return 1
    for index, token in enumerate(tokens):
        lowered = token.lower()
        if code == 'id':
            if lowered in _INDONESIAN_MARKERS:
                return index
            if re.match(r'^(me|mem|men|meng|meny|ber|di|ter|pe|per)[a-z]{2,}', lowered):
                return index
        else:
            if lowered in _AUXILIARIES:
                return index
            if len(lowered) > 3 and re.search(r'(ed|ing)$', lowered):
                return index
    return None


def _segments(tokens: List[str], lang: str) -> List[Dict]:
    if not tokens:
        return []

    verb = _find_verb_index(tokens, lang)
    if verb is None:
        return [{
            'label': _LABELS['neutral'],
            'text': ' '.join(tokens),
            'color': 'neutral',
        }]

    subject = tokens[:verb]
    rest = tokens[verb:]

    predicate_end = 1
    while predicate_end < len(rest) and rest[predicate_end].lower() in _AUXILIARIES:
        predicate_end += 1

    object_end = len(rest)
    for index in range(predicate_end, len(rest)):
        if rest[index].lower() in _PREPOSITIONS:
            object_end = index
            break

    predicate = rest[:predicate_end]
    obj = rest[predicate_end:object_end]
    adverbial = rest[object_end:]

    segments = []
    if subject:
        segments.append({'label': _LABELS['subject'], 'text': ' '.join(subject), 'color': 'subject'})
    if predicate:
        segments.append({'label': _LABELS['predicate'], 'text': ' '.join(predicate), 'color': 'predicate'})
    if obj:
        segments.append({'label': _LABELS['object'], 'text': ' '.join(obj), 'color': 'object'})
    if adverbial:
        segments.append({'label': _LABELS['adverbial'], 'text': ' '.join(adverbial), 'color': 'adverbial'})
    return segments


def _pattern(segments: List[Dict]) -> str:
    initials = {
        _LABELS['subject']: 'S',
        _LABELS['predicate']: 'P',
        _LABELS['object']: 'O',
        _LABELS['adverbial']: 'K',
        _LABELS['neutral']: 'S',
    }
    return '-'.join(initials.get(segment['label'], '?') for segment in segments)


def analyze_structure(text: str, source_lang: str, target_lang: str, target_text: str = '') -> Dict:
    """Label the source sentence and the translated sentence by role."""
    source_tokens = [token['clean'] for token in tokenize(text, source_lang)]
    target_tokens = [token['clean'] for token in tokenize(target_text, target_lang)] if target_text else []

    source_segments = _segments(source_tokens, source_lang)
    target_segments = _segments(target_tokens, target_lang) if target_tokens else []

    return {
        'source': source_segments,
        'target': target_segments,
        'pattern': _pattern(source_segments),
        'target_pattern': _pattern(target_segments) if target_segments else '',
    }


def analyze_grammar(text: str, source_lang: str) -> Dict:
    """Tense and a short note about the pattern used in the sentence."""
    from .services import GrammarAnalyzer

    analysis = GrammarAnalyzer.analyze(text)
    tense = analysis.get('tense', '')
    return {
        'tense': tense,
        'note': _grammar_note(tense),
        'details': analysis.get('grammar_details', {}),
    }


def _grammar_note(tense: str) -> str:
    if not tense:
        return ''
    name = tense.split('(')[0].strip()
    return f'Kalimat ini memakai pola {name}.'


def build_interlinear(text: str, source_lang: str, target_lang: str) -> Dict:
    """Return the full translation, per-word alignment and grammar shape."""
    cleaned = ' '.join((text or '').split())
    if not cleaned:
        return {
            'source_text': '',
            'target_text': '',
            'words': [],
            'structure': {'source': [], 'target': [], 'pattern': '', 'target_pattern': ''},
            'grammar': {'tense': '', 'note': '', 'details': {}},
        }

    source = normalize_lang(source_lang) or 'auto'
    target = normalize_lang(target_lang) or 'id'

    cache_key = _cache_key('interlinear', source, target, cleaned)
    cached = cache.get(cache_key)
    if cached:
        return cached

    from .enrichment import translate_sentence

    sentence = translate_sentence(cleaned, source, target)
    target_text = sentence.get('target_text', '')

    tokens = tokenize(cleaned, source)[:MAX_TOKENS]
    with ThreadPoolExecutor(max_workers=8) as executor:
        translated = list(executor.map(
            lambda token: _translate_token(token['clean'], source, target),
            tokens,
        ))

    words = [
        {
            'index': token['index'],
            'source': token['source'],
            'target': result['target'],
            'alternatives': result['alternatives'],
        }
        for token, result in zip(tokens, translated)
    ]

    result = {
        'source_text': cleaned,
        'target_text': target_text,
        'words': words,
        'structure': analyze_structure(cleaned, source, target, target_text),
        'grammar': analyze_grammar(cleaned, source),
    }
    cache.set(cache_key, result, timeout=CACHE_TTL)
    return result
