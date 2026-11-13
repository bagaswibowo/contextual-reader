"""Lightweight language detection for the reader.

No extra dependency is installed for this: the detector combines Unicode script
ranges with stop-word and suffix scoring for Latin-script languages. It is
deliberately conservative and returns a low confidence instead of guessing
wildly. The API contract is ``{lang, confidence}``.
"""

from __future__ import annotations

import re

SCRIPT_RANGES = (
    ('ko', re.compile(r'[\uac00-\ud7af\u1100-\u11ff]')),
    ('ja', re.compile(r'[\u3040-\u30ff]')),
    ('zh', re.compile(r'[\u4e00-\u9fff]')),
    ('ru', re.compile(r'[\u0400-\u04ff]')),
    ('ar', re.compile(r'[\u0600-\u06ff]')),
    ('th', re.compile(r'[\u0e00-\u0e7f]')),
    ('hi', re.compile(r'[\u0900-\u097f]')),
    ('he', re.compile(r'[\u0590-\u05ff]')),
    ('el', re.compile(r'[\u0370-\u03ff]')),
)

STOP_WORDS = {
    'en': {
        'the', 'and', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'it', 'that',
        'this', 'with', 'for', 'on', 'as', 'be', 'have', 'has', 'not', 'you', 'i',
        'he', 'she', 'they', 'we', 'at', 'from', 'but', 'by', 'or', 'an', 'a',
    },
    'id': {
        'yang', 'dan', 'di', 'ini', 'itu', 'dengan', 'untuk', 'tidak', 'dari',
        'dalam', 'akan', 'pada', 'saya', 'kamu', 'dia', 'mereka', 'kita', 'adalah',
        'ke', 'juga', 'bisa', 'sudah', 'belum', 'ada', 'karena', 'sebagai',
    },
    'es': {
        'el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por',
        'para', 'con', 'no', 'se', 'del', 'al', 'como', 'mas', 'pero', 'sus',
    },
    'fr': {
        'le', 'la', 'les', 'de', 'et', 'un', 'une', 'est', 'en', 'que', 'qui',
        'dans', 'pour', 'pas', 'au', 'aux', 'du', 'ce', 'il', 'elle', 'vous',
        'nous', 'avec', 'sur',
    },
    'de': {
        'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'zu', 'von', 'mit',
        'sich', 'auf', 'fur', 'nicht', 'im', 'dem', 'den', 'des', 'ich', 'du',
        'wir', 'auch', 'als',
    },
    'pt': {
        'o', 'a', 'os', 'as', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'uma',
        'para', 'com', 'nao', 'se', 'por', 'mais', 'como', 'dos', 'das',
    },
    'it': {
        'il', 'la', 'gli', 'le', 'di', 'che', 'e', 'un', 'una', 'per', 'con',
        'non', 'si', 'da', 'in', 'al', 'come', 'piu', 'dei', 'delle',
    },
    'nl': {
        'de', 'het', 'een', 'en', 'van', 'is', 'in', 'op', 'te', 'dat', 'die',
        'voor', 'met', 'niet', 'zijn', 'er', 'maar', 'om', 'aan', 'ook',
    },
}

SUFFIXES = {
    'en': ('tion', 'sion', 'ing', 'ed', 'ly', 'ous', 'al', 'ive', 'ent', 'ism', 'ness', 'ment'),
    'id': ('kan', 'nya', 'lah', 'kah', 'pun', 'ber', 'ter', 'pe', 'me'),
    'es': ('cion', 'ado', 'ida', 'ando', 'iendo', 'dad', 'oso', 'amiento'),
    'fr': ('tion', 'eau', 'aux', 'eux', 'aient', 'ait', 'ez', 'ment'),
    'de': ('ung', 'heit', 'keit', 'lich', 'schaft', 'chen', 'ung'),
    'pt': ('cao', 'ade', 'oso', 'amento', 'mente', 'inho'),
    'it': ('zione', 'mento', 'ismo', 'mente', 'are', 'ere', 'ire'),
    'nl': ('heid', 'ing', 'tje', 'je', 'en', 'er'),
}

CHAR_HINTS = {
    'es': ('ñ', '¿', '¡'),
    'pt': ('ã', 'õ', 'ç'),
    'fr': ('ç', 'œ', 'à', 'è', 'ê', 'ù'),
    'de': ('ß', 'ä', 'ö', 'ü'),
    'it': ('ì', 'ò', 'ù'),
    'id': (),
}

WORD_RE = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)?", re.UNICODE)


def _script_language(text: str) -> str | None:
    for lang, pattern in SCRIPT_RANGES:
        if pattern.search(text):
            return lang
    return None


def _latin_scores(text: str) -> dict[str, float]:
    lowered = text.lower()
    tokens = WORD_RE.findall(lowered)
    scores = {lang: 0.0 for lang in STOP_WORDS}

    for token in tokens:
        for lang, words in STOP_WORDS.items():
            if token in words:
                scores[lang] += 1.0
        if len(token) > 4:
            for lang, suffixes in SUFFIXES.items():
                if token.endswith(suffixes):
                    scores[lang] += 0.5

    for lang, hints in CHAR_HINTS.items():
        if any(hint in lowered for hint in hints):
            scores[lang] += 1.0

    return scores


def detect_language(text: str) -> dict:
    """Return ``{'lang': <code>, 'confidence': <0..1>}`` for the given text."""
    cleaned = re.sub(r'\s+', ' ', (text or '')).strip()
    if not cleaned:
        return {'lang': 'en', 'confidence': 0.0}

    script_lang = _script_language(cleaned)
    if script_lang:
        return {'lang': script_lang, 'confidence': 0.99}

    scores = _latin_scores(cleaned)
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_lang, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0

    if best_score <= 0:
        return {'lang': 'en', 'confidence': 0.2}

    confidence = 0.5 + min(0.35, best_score * 0.1)
    if best_score > second_score:
        confidence += 0.05
    return {'lang': best_lang, 'confidence': round(min(0.99, confidence), 2)}
