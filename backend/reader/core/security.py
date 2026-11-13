"""Server-side validation for client supplied LLM endpoints.

The translation API lets a client pass ``custom_base_url`` so it can point the
backend at its own OpenAI-compatible provider. Without validation that is a
server-side request forgery (SSRF) primitive: a caller could make the backend
POST to cloud metadata (169.254.169.254), loopback services, or private
networks.

This module enforces two independent gates:

1. The host must be on an explicit allowlist (``LLM_ALLOWED_HOSTS``, defaulting
   to the host of ``OMNIROUTE_BASE_URL``).
2. The host must not be, or resolve to, a loopback/private/link-local/reserved
   address. This also blocks DNS-rebinding tricks where an allowlisted name
   resolves to an internal IP.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Callable, Iterable
from urllib.parse import urlsplit

from django.conf import settings

BLOCKED_HOSTNAMES = {
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    'metadata',
    'metadata.google.internal',
    'instance-data',
}

BLOCKED_SUFFIXES = ('.localhost', '.local', '.internal')

BLOCKED_NETWORKS = tuple(
    ipaddress.ip_network(net)
    for net in (
        '0.0.0.0/8',
        '10.0.0.0/8',
        '100.64.0.0/10',
        '127.0.0.0/8',
        '169.254.0.0/16',
        '172.16.0.0/12',
        '192.0.0.0/24',
        '192.0.2.0/24',
        '192.168.0.0/16',
        '198.18.0.0/15',
        '198.51.100.0/24',
        '203.0.113.0/24',
        '224.0.0.0/4',
        '240.0.0.0/4',
        '255.255.255.255/32',
        '::/128',
        '::1/128',
        'fc00::/7',
        'fe80::/10',
        'ff00::/8',
        '2001:db8::/32',
    )
)


class LLMUrlError(ValueError):
    """Raised when a client supplied LLM base URL is not allowed."""


def _is_blocked_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False

    # IPv4-mapped IPv6 (::ffff:127.0.0.1) must be judged by its IPv4 address.
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped

    if (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    ):
        return True

    return any(address in network for network in BLOCKED_NETWORKS)


def _default_allowed_hosts() -> list[str]:
    configured = list(getattr(settings, 'LLM_ALLOWED_HOSTS', []) or [])
    if configured:
        return configured

    base_url = (
        getattr(settings, 'OMNIROUTE_BASE_URL', '')
        or getattr(settings, 'OMNIROUTE_URL', '')
    )
    if not base_url:
        return []

    hostname = urlsplit(base_url).hostname
    return [hostname] if hostname else []


def _resolve_host(host: str) -> list[str]:
    """Return every address the host resolves to (IPv4 and IPv6)."""
    infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    addresses = []
    for info in infos:
        address = info[4][0]
        if address not in addresses:
            addresses.append(address)
    return addresses


def validate_llm_base_url(
    raw_url: str,
    *,
    allowed_hosts: Iterable[str] | None = None,
    resolver: Callable[[str], list[str]] | None = None,
) -> str:
    """Validate and normalise a client supplied LLM base URL.

    Returns the URL without a trailing slash. Raises :class:`LLMUrlError` with a
    message safe to show to the caller.
    """
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise LLMUrlError('custom_base_url must be a non-empty URL.')

    candidate = raw_url.strip()
    try:
        parts = urlsplit(candidate)
        host = (parts.hostname or '').lower().rstrip('.')
    except ValueError as exc:
        raise LLMUrlError('custom_base_url is not a valid URL.') from exc

    if parts.scheme not in ('http', 'https'):
        raise LLMUrlError('custom_base_url must use http or https.')
    if not host:
        raise LLMUrlError('custom_base_url must include a hostname.')
    if parts.username or parts.password:
        raise LLMUrlError('custom_base_url must not contain credentials.')
    try:
        parts.port  # noqa: B018 - raises ValueError for a malformed port
    except ValueError as exc:
        raise LLMUrlError('custom_base_url has an invalid port.') from exc

    if host in BLOCKED_HOSTNAMES or host.endswith(BLOCKED_SUFFIXES):
        raise LLMUrlError('custom_base_url points to a blocked host.')
    if _is_blocked_ip(host):
        raise LLMUrlError('custom_base_url points to a private or reserved address.')

    allowlist = {
        entry.strip().lower().rstrip('.')
        for entry in (allowed_hosts if allowed_hosts is not None else _default_allowed_hosts())
        if entry and entry.strip()
    }
    if not allowlist:
        raise LLMUrlError(
            'custom_base_url is disabled because no LLM host allowlist is configured.'
        )
    if host not in allowlist:
        raise LLMUrlError('custom_base_url host is not in the server allowlist.')

    # Resolve allowlisted names and reject DNS rebinding to internal addresses.
    # IP literals were already checked above and need no lookup.
    try:
        ipaddress.ip_address(host)
        resolved = []
    except ValueError:
        resolve = resolver or _resolve_host
        try:
            resolved = resolve(host)
        except OSError as exc:
            raise LLMUrlError('custom_base_url host could not be resolved.') from exc

    for address in resolved:
        if _is_blocked_ip(address):
            raise LLMUrlError('custom_base_url resolves to a private or reserved address.')

    return candidate.rstrip('/')
