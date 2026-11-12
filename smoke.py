#!/usr/bin/env python3
# Smoke test untuk Contextual Reader CI
# Tes endpoint dasar tanpa memerlukan database yang berat

import requests
import sys

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
    """Test static files cache header"""
    print("Testing /assets/ cache header...")
    try:
        resp = requests.head(f"{BASE_URL}/assets/reader.css", timeout=5)
        cache_header = resp.headers.get("Cache-Control", "")
        if "immutable" not in cache_header.lower():
            print(f"  ✗ Cache-Control tidak mengandung 'immutable': {cache_header}")
            return False
        print(f"  ✓ Static files cacheable (Cache-Control: {cache_header})")
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