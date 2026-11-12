# Regression tests locking P0 defects found in Sprint 0 audit.
#
# These tests assert the DESIRED behaviour (400/404 instead of 500,
# next_review populated, tables created). Against the unfixed code they
# FAIL — that is the point: they lock the defect until Backend fixes it.
# They require NO internet: Google Translate is mocked, and no external
# service is called.
#
# Markers:
#   - expected-fail(auth): auth/ownership does not exist yet (S1-B1),
#     so unauthenticated requests are currently accepted (AllowAny).
#     This test is EXPECTED TO FAIL until auth lands; do not delete it.

from django.test import TestCase, override_settings
from django.db import connection
from rest_framework.test import APIClient
from rest_framework import status

from reader.books.models import Book, Chapter, Sentence
from reader.translations.models import WordTranslation
from reader.vocabulary.models import VocabularyEntry, ReviewSession


class MigrationTablesTest(TestCase):
    """Empty DB must reproduce the 4 missing translations/vocabulary tables."""

    def test_four_missing_tables_exist(self):
        tables = set(connection.introspection.table_names(connection.cursor()))
        required = {
            "translations_wordtranslation",
            "translations_sentencetranslation",
            "vocabulary_vocabularyentry",
            "vocabulary_reviewsession",
        }
        missing = required - tables
        self.assertFalse(
            missing,
            f"Migrasi belum membuat tabel: {sorted(missing)}. "
            "Jalankan makemigrations/migrate untuk translations dan vocabulary.",
        )


class VocabularyRegressionTest(TestCase):
    """Lock the 3 endpoint 500s + next_review behaviour."""

    def setUp(self):
        self.client = APIClient()
        self.book = Book.objects.create(title="Buku Uji", format="txt", status="ready")
        self.chapter = Chapter.objects.create(
            book=self.book, index=1, title="Bab 1", content="Ini kalimat uji.",
            word_count=3,
        )
        self.sentence = Sentence.objects.create(
            chapter=self.chapter, index=1, text="Ini kalimat uji.",
            word_count=3,
        )
        self.word_translation = WordTranslation.objects.create(
            sentence=self.sentence, word="uji", word_lower="uji",
            target_lang="id", engine="google", contextual_meaning="test",
        )

    def test_start_session_without_book_id_returns_400_not_500(self):
        # Bug: start_session tanpa book_id -> IntegrityError -> 500.
        resp = self.client.post(
            "/api/vocabulary/start_session/", {"user_id": "default"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_end_session_unknown_pk_returns_404_not_500(self):
        # Bug: end_session pk tak ada -> DoesNotExist -> 500.
        resp = self.client.post("/api/vocabulary/999999/end_session/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_review_with_string_quality_returns_400_not_500(self):
        # Bug: review quality "4" (string) -> TypeError -> 500.
        entry = VocabularyEntry.objects.create(
            user_id="default", book=self.book, sentence=self.sentence,
            word_translation=self.word_translation, status="learning",
        )
        resp = self.client.post(
            f"/api/vocabulary/{entry.pk}/review/",
            {"quality": "4"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_new_vocabulary_entry_has_next_review_and_appears_due(self):
        # Bug: next_review default NULL -> kata baru tidak pernah masuk antrean review.
        entry = VocabularyEntry.objects.create(
            user_id="default", book=self.book, sentence=self.sentence,
            word_translation=self.word_translation, status="learning",
        )
        self.assertIsNotNone(entry.next_review, "next_review harus diisi saat entri dibuat")
        resp = self.client.get("/api/vocabulary/due_for_review/", {"user_id": "default"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in resp.json()]
        self.assertIn(entry.id, ids, "entri baru harus muncul di due_for_review")


class AuthRegressionTest(TestCase):
    """Auth/ownership gate. EXPECTED TO FAIL until S1-B1 auth lands."""

    def setUp(self):
        self.client = APIClient()

    @override_settings(DEBUG=False)
    def test_unauthenticated_request_to_protected_endpoint_is_rejected(self):
        # expected-fail(auth): seluruh API saat ini AllowAny, tidak ada autentikasi.
        # Setelah S1-B1 (token auth + owner FK) ini harus menjadi 401/403.
        resp = self.client.get("/api/books/", format="json")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
