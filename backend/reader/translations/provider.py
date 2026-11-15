"""Shared upstream provider plumbing for dictionary lookups.

Both the source-language entry (``dictionary``) and the mother-tongue layer
(``enrichment``) talk to the same free Google Translate web endpoint. Keeping
the request shape, the client rotation and the language normalization here
means one place to fix when the upstream changes.
"""

from __future__ import annotations

from typing import Dict, Optional

import requests

GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'
REQUEST_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )
}

# Google rate-limits one client name at a time; these are the public names the
# app has always relied on.
CLIENT_NAMES = ('gtx', 'tw-ob', 'dict-chrome-ex')

# Languages written in Latin script: Google's reading field is an IPA-style
# respelling there, while for other scripts it is a romanization.
LATIN_SCRIPT_LANGS = {
    'en', 'id', 'ms', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'tr', 'vi', 'pl',
    'sv', 'da', 'no', 'nb', 'fi', 'cs', 'sk', 'ro', 'hu', 'hr', 'sl', 'tl',
    'sw', 'af', 'ca', 'et', 'lv', 'lt', 'is', 'ga', 'cy', 'eu', 'gl',
}

_LANG_ALIASES = {
    'zh-cn': 'zh',
    'zh-tw': 'zh',
    'zh-hans': 'zh',
    'zh-hant': 'zh',
    'in': 'id',
}


def normalize_lang(lang: str) -> str:
    value = (lang or '').strip().lower().replace('_', '-')
    return _LANG_ALIASES.get(value, value)


def is_latin_script(lang: str) -> bool:
    return normalize_lang(lang) in LATIN_SCRIPT_LANGS


def translate_query(params: Dict) -> Optional[list]:
    """Call the translate endpoint, rotating client names; never raises."""
    for client_name in CLIENT_NAMES:
        attempt = dict(params)
        attempt['client'] = client_name
        try:
            response = requests.get(
                GOOGLE_TRANSLATE_URL,
                params=attempt,
                headers=REQUEST_HEADERS,
                timeout=5,
            )
            if response.status_code == 200:
                return response.json()
        except Exception:
            continue
    return None


def is_translate_payload(payload) -> bool:
    """Google's shape is a list whose first item is the segment list."""
    return (
        isinstance(payload, list)
        and bool(payload)
        and isinstance(payload[0], list)
        and bool(payload[0])
    )
