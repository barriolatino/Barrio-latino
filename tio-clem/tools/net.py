"""Appels HTTP des fournisseurs (urllib, sans dépendance).

`transport` est remplaçable dans les tests unitaires, qui vérifient ainsi les
requêtes envoyées sans jamais prétendre avoir joint l'API réelle.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request


class ProviderError(RuntimeError):
    pass


def _urllib_transport(method: str, url: str, headers: dict, body: bytes | None, timeout: float) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except urllib.error.URLError as e:
        raise ProviderError(f"réseau injoignable pour {url} : {e.reason}") from e


transport = _urllib_transport


def post_json(url: str, headers: dict, payload: dict, timeout: float = 120) -> bytes:
    status, data = transport("POST", url, {**headers, "Content-Type": "application/json"},
                             json.dumps(payload).encode("utf-8"), timeout)
    if status >= 400:
        raise ProviderError(f"{url} a répondu {status} : {data[:300].decode('utf-8', 'replace')}")
    return data
