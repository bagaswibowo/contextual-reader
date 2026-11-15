"""Language catalogue for the reader.

The UI must not hard-code a language list: adding a language is a data change
here, not a code change in the frontend. Each entry carries the code used by
the translation provider, the label shown to the reader, the TTS voice code and
the script family, which decides whether a reading is IPA or a romanization.
"""

from __future__ import annotations

from typing import Dict, List

from .provider import is_latin_script, normalize_lang

# code, label, tts voice code
_LANGUAGES = [
    ('id', 'Indonesia', 'id'),
    ('en', 'Inggris', 'en'),
    ('ms', 'Melayu', 'ms'),
    ('es', 'Spanyol', 'es'),
    ('fr', 'Prancis', 'fr'),
    ('de', 'Jerman', 'de'),
    ('it', 'Italia', 'it'),
    ('pt', 'Portugis', 'pt'),
    ('nl', 'Belanda', 'nl'),
    ('tr', 'Turki', 'tr'),
    ('ar', 'Arab', 'ar'),
    ('hi', 'Hindi', 'hi'),
    ('th', 'Thai', 'th'),
    ('vi', 'Vietnam', 'vi'),
    ('ja', 'Jepang', 'ja'),
    ('ko', 'Korea', 'ko'),
    ('zh', 'Mandarin', 'zh-CN'),
    ('ru', 'Rusia', 'ru'),
]

DEFAULT_LANGUAGE = 'id'


def language_catalogue() -> List[Dict]:
    """Return the selectable languages in display order."""
    return [
        {
            'code': code,
            'label': label,
            'tts': tts,
            'latin_script': is_latin_script(code),
        }
        for code, label, tts in _LANGUAGES
    ]


def tts_voice(lang: str) -> str:
    """Map an app language code to the voice code the TTS endpoint expects."""
    code = normalize_lang(lang)
    for entry_code, _, tts in _LANGUAGES:
        if entry_code == code:
            return tts
    return code or 'en'


def is_supported(lang: str) -> bool:
    code = normalize_lang(lang)
    return any(entry_code == code for entry_code, _, _ in _LANGUAGES)
