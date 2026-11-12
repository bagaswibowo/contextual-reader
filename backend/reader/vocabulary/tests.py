from django.test import TestCase
from django.utils import timezone
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
