#!/usr/bin/env python3
# Smoke test untuk Contextual Reader CI
# Tes endpoint dasar tanpa memerlukan database yang berat

import sys
import requests

BASE_URL = "http://localhost:8088"

def test_health():
    """Test health endpoint"""
    print("Testing /api/core/health/...")
    try:
        resp = requests.get(f"{BASE_URL}/api/core/health/", timeout=5)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert resp.json().get("status") == "healthy", "Status bukan healthy"
        print("  ✓ Health check ok")
        return True
    except Exception as e:
        print(f"  ✗ Health check failed: {e}")
        return False

def test_books_list():
    """Test list books endpoint"""
    print("Testing /api/books/...")
    try:
        resp = requests.get(f"{BASE_URL}/api/books/", timeout=5)
        # Boleh 200 atau 401 (auth belum ada)
        assert resp.status_code in [200, 401], f"Expected 200 or 401, got {resp.status_code}"
        print(f"  ✓ Books list responded with {resp.status_code}")
        return True
    except Exception as e:
        print(f"  ✗ Books list failed: {e}")
        return False

def test_vocabulary():
    """Test vocabulary endpoint"""
    print("Testing /api/vocabulary/...")
    try:
        resp = requests.get(f"{BASE_URL}/api/vocabulary/", timeout=5)
        assert resp.status_code in [200, 401], f"Expected 200 or 401, got {resp.status_code}"
        print(f"  ✓ Vocabulary responded with {resp.status_code}")
        return True
    except Exception as e:
        print(f"  ✗ Vocabulary failed: {e}")
        return False

def test_static_files():
    """Test static files cache header (/favicon.svg and /assets/)"""
    print("Testing static cache headers (/favicon.svg and /assets/)...")
    try:
        # 1. Test top-level static asset (/favicon.svg -> max-age=86400, public)
        resp_fav = requests.head(f"{BASE_URL}/favicon.svg", timeout=5)
        assert resp_fav.status_code == 200, f"Expected 200 for favicon, got {resp_fav.status_code}"
        fav_header = resp_fav.headers.get("Cache-Control", "")
        if "86400" not in fav_header:
            print(f"  ✗ Cache-Control favicon tidak mengandung '86400': {fav_header}")
            return False
        if "public" not in fav_header.lower():
            print(f"  ✗ Cache-Control favicon tidak mengandung 'public': {fav_header}")
            return False
        print(f"  ✓ Favicon cacheable (Cache-Control: {fav_header})")

        # 2. Test content-hashed / immutable asset under /assets/
        resp_asset = requests.head(f"{BASE_URL}/assets/visemes/rest.png", timeout=5)
        assert resp_asset.status_code == 200, f"Expected 200 for asset, got {resp_asset.status_code}"
        asset_header = resp_asset.headers.get("Cache-Control", "")
        if "immutable" not in asset_header.lower():
            print(f"  ✗ Cache-Control asset tidak mengandung 'immutable': {asset_header}")
            return False
        if "31536000" not in asset_header:
            print(f"  ✗ Cache-Control asset tidak mengandung '31536000': {asset_header}")
            return False
        print(f"  ✓ Static files cacheable (Cache-Control: {asset_header})")
        return True
    except Exception as e:
        print(f"  ✗ Static files test failed: {e}")
        return False

def main():
    print("=" * 50)
    print("Contextual Reader Smoke Test")
    print("=" * 50)

    tests = [
        test_health,
        test_books_list,
        test_vocabulary,
        test_static_files,
    ]

    results = [test() for test in tests]

    print("=" * 50)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} passed")

    if passed == total:
        print("✓ All smoke tests passed")
        return 0
    else:
        print("✗ Some smoke tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
