import unittest

from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from reader.books.models import Book, Chapter, Sentence
from reader.translations.models import WordTranslation
from reader.vocabulary.models import ReviewSession, VocabularyEntry


class VocabularyFixtureMixin:
    def setUp(self):
        self.client = APIClient()
        self.book = Book.objects.create(title='Test Book', format='txt', status='ready')
        self.chapter = Chapter.objects.create(
            book=self.book, index=0, title='Chapter 1', content='Hello world.'
        )
        self.sentence = Sentence.objects.create(
            chapter=self.chapter, index=0, text='Hello world.'
        )
        self.word_translation = WordTranslation.objects.create(
            sentence=self.sentence,
            word='Hello',
            word_lower='hello',
            contextual_meaning='Halo',
        )


class StartSessionTest(VocabularyFixtureMixin, TestCase):
    def test_missing_book_id_returns_400(self):
        response = self.client.post('/api/vocabulary/start_session/', {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('book_id', response.json()['error'])

    def test_unknown_book_returns_404(self):
        response = self.client.post(
            '/api/vocabulary/start_session/', {'book_id': 999999}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_valid_book_creates_session(self):
        response = self.client.post(
            '/api/vocabulary/start_session/', {'book_id': self.book.id}, format='json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ReviewSession.objects.count(), 1)


class EndSessionTest(VocabularyFixtureMixin, TestCase):
    def test_unknown_session_returns_404(self):
        response = self.client.post(
            '/api/vocabulary/999999/end_session/', {}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_non_numeric_pk_returns_404(self):
        response = self.client.post(
            '/api/vocabulary/not-a-number/end_session/', {}, format='json'
        )
        self.assertEqual(response.status_code, 404)

    def test_existing_session_is_closed(self):
        session = ReviewSession.objects.create(user_id='default', book=self.book)
        response = self.client.post(
            f'/api/vocabulary/{session.id}/end_session/',
            {'cards_reviewed': 3, 'cards_correct': 2},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertIsNotNone(session.ended_at)
        self.assertEqual(session.cards_reviewed, 3)


class ReviewQualityTest(VocabularyFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.entry = VocabularyEntry.objects.create(
            user_id='default',
            book=self.book,
            word_translation=self.word_translation,
            sentence=self.sentence,
        )

    def test_string_quality_returns_400(self):
        response = self.client.post(
            f'/api/vocabulary/{self.entry.id}/review/', {'quality': '4'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_out_of_range_quality_returns_400(self):
        response = self.client.post(
            f'/api/vocabulary/{self.entry.id}/review/', {'quality': 9}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_integer_quality_updates_schedule(self):
        response = self.client.post(
            f'/api/vocabulary/{self.entry.id}/review/', {'quality': 4}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.review_count, 1)
        self.assertGreater(self.entry.next_review, timezone.now())


class NextReviewDefaultTest(VocabularyFixtureMixin, TestCase):
    def test_new_entry_is_due_immediately(self):
        entry = VocabularyEntry.objects.create(
            user_id='default',
            book=self.book,
            word_translation=self.word_translation,
            sentence=self.sentence,
        )
        self.assertIsNotNone(entry.next_review)
        self.assertLessEqual(entry.next_review, timezone.now())

    def test_new_entry_appears_in_due_for_review(self):
        VocabularyEntry.objects.create(
            user_id='default',
            book=self.book,
            word_translation=self.word_translation,
            sentence=self.sentence,
        )
        response = self.client.get('/api/vocabulary/due_for_review/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)


class VocabularyListTest(VocabularyFixtureMixin, TestCase):
    def test_list_does_not_error_on_empty_database(self):
        response = self.client.get('/api/vocabulary/')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# QA regression lock (S0-Q1b). These classes come from the QA branch and
# assert the desired P0 behaviour. They pass against the hardened backend.
# ---------------------------------------------------------------------------


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
    """Auth/ownership gate. EXPECTED-FAIL until S1-B1 auth lands.

    Marked with unittest.expectedFailure so the suite stays green while the
    defect is still open. When auth lands this becomes an unexpected success
    and the suite fails, which is the signal to remove the marker.
    """

    def setUp(self):
        self.client = APIClient()

    @unittest.expectedFailure
    @override_settings(DEBUG=False)
    def test_unauthenticated_request_to_protected_endpoint_is_rejected(self):
        # expected-fail(auth): seluruh API saat ini AllowAny, tidak ada autentikasi.
        # Setelah S1-B1 (token auth + owner FK) ini harus menjadi 401/403.
        resp = self.client.get("/api/books/", format="json")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
