"""Shared upstream provider plumbing for dictionary lookups.

Both the source-language entry (``dictionary``) and the mother-tongue layer
(``enrichment``) talk to the same free Google Translate web endpoint. Keeping
the request shape, the client rotation and the language normalization here
means one place to fix when the upstream changes.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Dict, Optional

import requests
from django.core.cache import cache

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

# The reading proxy answers with Google's block page when it is hit in a burst,
# so a retry backs off before giving up on a layer.
PROXY_ATTEMPTS = 4
PROXY_RETRY_DELAY = 0.6
PROXY_MAX_WAIT = 5.0
# One call may retry, but not for longer than this: the card is built from a
# handful of calls at once, and a single throttled one must not hold the whole
# card for half a minute. A card that lost a layer this way is not cached, so
# the next open retries it.
PROXY_BUDGET_SECONDS = 2.0

# The proxy throttles a burst and asks for a pause between requests, so only a
# few may be in flight; the rest wait for a slot. Three keeps a cold card's
# parallel calls inside two proxy waves, and four or more starts getting
# throttled replies. Direct Google calls stay unlimited.
_PROXY_SLOTS = threading.Semaphore(3)

# Google answers 429 to the data-centre address this app runs on, so every
# client name fails the same way. The block is remembered for a few minutes:
# three doomed attempts per call cost more than the proxy call they replace.
DIRECT_BLOCK_KEY = 'translate:direct-blocked'
DIRECT_BLOCK_SECONDS = 600

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


def _direct_blocked() -> bool:
    try:
        return bool(cache.get(DIRECT_BLOCK_KEY))
    except Exception:
        return False


def _remember_direct_block() -> None:
    try:
        cache.set(DIRECT_BLOCK_KEY, 1, timeout=DIRECT_BLOCK_SECONDS)
    except Exception:
        pass


def translate_query(params: Dict) -> Optional[list]:
    """Call the translate endpoint, rotating client names; never raises."""
    if _direct_blocked():
        return translate_query_via_reader(params)

    throttled = False
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
        except Exception:
            continue
        if response.status_code == 200:
            return response.json()
        if response.status_code == 429:
            # One client name is throttled for the whole address, so the other
            # names would only spend their own timeout on the same answer.
            throttled = True
            break
    if throttled:
        _remember_direct_block()
    return translate_query_via_reader(params)


def _proxy_wait(body: str, try_index: int) -> float:
    """Seconds to wait before retrying a throttled proxy request.

    The proxy states ``retryAfter`` in its reply; when it does not, a short
    backoff keeps the retry from hitting the same limit again.
    """
    try:
        data = json.loads(body)
    except ValueError:
        data = None
    if isinstance(data, dict):
        try:
            stated = float(data.get('retryAfter') or 0)
        except (TypeError, ValueError):
            stated = 0
        if stated > 0:
            return min(stated, PROXY_MAX_WAIT)
    return min(PROXY_RETRY_DELAY * (try_index + 1), PROXY_MAX_WAIT)


def translate_query_via_reader(params: Dict) -> Optional[list]:
    """Repeat the same query through a reading proxy when Google blocks us.

    Google answers 429 to the whole data-centre address this app runs on, so no
    client name gets through. The proxy fetches the same endpoint from its own
    address and returns the body, which is parsed exactly like Google's answer.
    Only used when ``TRANSLATE_READER_PROXY`` is set: the proxy sees the text,
    so a deployment that translates private material can leave it empty.
    """
    from django.conf import settings

    proxy = getattr(settings, 'TRANSLATE_READER_PROXY', '') or ''
    if not proxy:
        return None

    attempt = dict(params)
    attempt.setdefault('client', CLIENT_NAMES[0])
    url = proxy.rstrip('/') + '/' + GOOGLE_TRANSLATE_URL
    started = time.monotonic()

    def remaining() -> float:
        return PROXY_BUDGET_SECONDS - (time.monotonic() - started)

    for try_index in range(PROXY_ATTEMPTS):
        budget = remaining()
        if budget <= 0:
            return None
        try:
            with _PROXY_SLOTS:
                response = requests.get(
                    url, params=attempt, headers=REQUEST_HEADERS,
                    timeout=min(20, max(0.5, budget)),
                )
            if response.status_code != 200:
                return None
            body = response.text
        except Exception:
            return None

        marker = 'Markdown Content:'
        raw = body.split(marker, 1)[1].strip() if marker in body else body.strip()
        if not raw.startswith('['):
            # A burst of lookups makes the proxy answer with its own throttle
            # reply, which states how long to wait. Waiting less than that just
            # burns the remaining attempts and leaves the layer empty.
            wait = min(_proxy_wait(body, try_index), remaining())
            if try_index < PROXY_ATTEMPTS - 1 and wait > 0:
                time.sleep(wait)
                continue
            return None
        try:
            payload, _ = json.JSONDecoder().raw_decode(raw)
        except ValueError:
            return None
        return payload if is_translate_payload(payload) else None
    return None


def is_translate_payload(payload) -> bool:
    """Google's shape is a list whose first item is the segment list."""
    return (
        isinstance(payload, list)
        and bool(payload)
        and isinstance(payload[0], list)
        and bool(payload[0])
    )
