import json
from unittest import mock

from django.test import TestCase

from reader.translations.services import (
    GrammarAnalyzer,
    GoogleTranslateClient,
    UniversalWordTokenizer,
    TranslationService,
)


class GrammarAnalyzerTest(TestCase):
    def test_simple_future_tense(self):
        text = "But I will see something that he cannot see such as a bird working and get him"
        result = GrammarAnalyzer.analyze(text)
        self.assertIn("Simple Future Tense", result["tense"])
        self.assertIn("Subjek", result["structure"])

    def test_present_continuous_tense(self):
        text = "She is reading a novel in the library"
        result = GrammarAnalyzer.analyze(text)
        self.assertIn("Present Continuous Tense", result["tense"])

    def test_past_perfect_tense(self):
        text = "They had finished the project before the deadline arrived"
        result = GrammarAnalyzer.analyze(text)
        self.assertIn("Past Perfect Tense", result["tense"])

    def test_simple_past_tense(self):
        text = "He went to the market yesterday"
        result = GrammarAnalyzer.analyze(text)
        self.assertIn("Simple Past Tense", result["tense"])

    def test_simple_present_tense(self):
        text = "Water freezes at zero degrees Celsius"
        result = GrammarAnalyzer.analyze(text)
        self.assertIn("Simple Present Tense", result["tense"])


def fake_response(payload, status_code=200):
    response = mock.Mock()
    response.status_code = status_code
    response.json.return_value = payload
    response.text = ''
    return response


class GoogleTranslateClientTest(TestCase):
    """All network calls are mocked; these tests never touch the internet."""

    @mock.patch('reader.translations.services.requests.get')
    def test_translate_sentence_id(self, mock_get):
        mock_get.return_value = fake_response([[['Halo dunia.']]])
        result = GoogleTranslateClient.translate_sentence(
            "Hello world.", target_lang="id"
        )
        self.assertEqual(result["indonesian_text"], "Halo dunia.")
        self.assertIn("tense", result)

    @mock.patch('reader.translations.services.requests.get')
    def test_translate_sentence_ja(self, mock_get):
        mock_get.return_value = fake_response([[['こんにちは']]])
        result = GoogleTranslateClient.translate_sentence(
            "Hello.", target_lang="ja"
        )
        self.assertEqual(result["indonesian_text"], "こんにちは")

    @mock.patch('reader.translations.services.requests.get')
    def test_translate_word(self, mock_get):
        mock_get.return_value = fake_response([[['apel']]])
        result = GoogleTranslateClient.translate_word(
            "apple", target_lang="id", mother_lang="id"
        )
        self.assertEqual(result["contextual_meaning"], "apel")

    @mock.patch('reader.translations.services.requests.get')
    def test_translate_sentence_falls_back_when_offline(self, mock_get):
        mock_get.side_effect = ConnectionError('offline')
        result = GoogleTranslateClient.translate_sentence(
            "Hello world.", target_lang="id"
        )
        self.assertEqual(result["indonesian_text"], "Hello world.")


class UniversalWordTokenizerTest(TestCase):
    @mock.patch('reader.translations.services.requests.get')
    def test_token_pairs(self, mock_get):
        mock_get.return_value = fake_response([[['hello', 'halo']]])
        pairs = UniversalWordTokenizer.get_token_pairs(
            "hello world", target_lang="en", mother_lang="id"
        )
        self.assertIsInstance(pairs, list)
        self.assertTrue(all('word' in pair for pair in pairs))


class TranslationServiceOfflineTest(TestCase):
    @mock.patch('reader.translations.services.requests.get')
    def test_llm_engine_falls_back_to_google_without_endpoint(self, mock_get):
        mock_get.return_value = fake_response([[['Halo.']]])
        from reader.books.models import Book, Chapter, Sentence

        book = Book.objects.create(title='T', format='txt', status='ready')
        chapter = Chapter.objects.create(book=book, index=0, content='Hello.')
        sentence = Sentence.objects.create(chapter=chapter, index=0, text='Hello.')

        with mock.patch(
            'reader.translations.services.LLMClient.get_completion_text',
            side_effect=RuntimeError('no endpoint'),
        ):
            translation = TranslationService().translate_sentence(
                sentence, target_lang='id', engine='llm'
            )
        self.assertEqual(translation.indonesian_text, 'Halo.')


class DictionaryLookupTest(TestCase):
    """Dictionary cache and provider fallback; no real network calls."""

    FREE_ENTRY = [{
        'word': 'traditional',
        'phonetic': '/trəˈdɪʃənəl/',
        'meanings': [{
            'partOfSpeech': 'adjective',
            'synonyms': ['conventional', 'customary'],
            'definitions': [{
                'definition': 'existing in or as part of a tradition; long-established.',
                'example': 'the traditional festivities of the Church year',
                'synonyms': ['established'],
            }],
        }],
    }]

    @mock.patch('reader.translations.dictionary.requests.get')
    def test_cache_miss_calls_provider_and_stores_row(self, mock_get):
        from reader.translations.dictionary import lookup
        from reader.translations.models import DictionaryEntry

        mock_get.return_value = fake_response(self.FREE_ENTRY)
        payload = lookup('Traditional', 'en', context='traditional festivities')

        self.assertEqual(payload['word'], 'Traditional')
        self.assertEqual(payload['lang'], 'en')
        self.assertEqual(payload['part_of_speech'], 'adjective')
        self.assertEqual(payload['phonetic_ipa'], '/trəˈdɪʃənəl/')
        self.assertIn('conventional', payload['synonyms'])
        self.assertEqual(payload['source'], 'free-dictionary')
        self.assertIn('/api/translations/tts/', payload['audio_url'])
        self.assertEqual(DictionaryEntry.objects.count(), 1)

    @mock.patch('reader.translations.dictionary.requests.get')
    def test_cache_hit_skips_provider(self, mock_get):
        from reader.translations.dictionary import lookup

        mock_get.return_value = fake_response(self.FREE_ENTRY)
        lookup('traditional', 'en')
        lookup('traditional', 'en')

        self.assertEqual(mock_get.call_count, 1)

    @mock.patch('reader.translations.dictionary.requests.get')
    def test_stale_entry_is_refreshed(self, mock_get):
        from datetime import timedelta

        from django.utils import timezone

        from reader.translations.dictionary import lookup
        from reader.translations.models import DictionaryEntry

        entry = DictionaryEntry.objects.create(
            word='traditional', word_lower='traditional', lang='en',
            senses=[{'meaning': 'old', 'examples': [], 'synonyms': []}],
            source='free-dictionary',
        )
        DictionaryEntry.objects.filter(pk=entry.pk).update(
            fetched_at=timezone.now() - timedelta(days=8)
        )
        mock_get.return_value = fake_response(self.FREE_ENTRY)

        payload = lookup('traditional', 'en')

        self.assertEqual(payload['senses'][0]['meaning'], self.FREE_ENTRY[0]['meanings'][0]['definitions'][0]['definition'])
        self.assertEqual(DictionaryEntry.objects.count(), 1)

    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    @mock.patch('reader.translations.dictionary._fetch_google_fallback')
    def test_provider_failure_without_cache_raises_not_found(self, google, free):
        from reader.translations.dictionary import (
            DictionaryNotFound,
            DictionaryProviderError,
            lookup,
        )

        free.side_effect = DictionaryProviderError('down')
        google.side_effect = DictionaryProviderError('down')

        with self.assertRaises(DictionaryNotFound):
            lookup('traditional', 'en')

    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    @mock.patch('reader.translations.dictionary._fetch_google_fallback')
    def test_stale_entry_is_served_when_providers_fail(self, google, free):
        from datetime import timedelta

        from django.utils import timezone

        from reader.translations.dictionary import DictionaryProviderError, lookup
        from reader.translations.models import DictionaryEntry

        entry = DictionaryEntry.objects.create(
            word='traditional', word_lower='traditional', lang='en',
            senses=[{'meaning': 'old', 'examples': [], 'synonyms': []}],
            source='free-dictionary',
        )
        DictionaryEntry.objects.filter(pk=entry.pk).update(
            fetched_at=timezone.now() - timedelta(days=8)
        )
        free.side_effect = DictionaryProviderError('down')
        google.side_effect = DictionaryProviderError('down')

        payload = lookup('traditional', 'en')

        self.assertEqual(payload['senses'][0]['meaning'], 'old')
        self.assertLess(payload['confidence'], 0.95)


class DictionaryEndpointTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_missing_word_returns_400(self):
        response = self.client.get('/api/translations/dictionary/', {'lang': 'en'})
        self.assertEqual(response.status_code, 400)

    def test_missing_lang_returns_400(self):
        response = self.client.get('/api/translations/dictionary/', {'word': 'traditional'})
        self.assertEqual(response.status_code, 400)

    def test_unsupported_word_characters_return_400(self):
        response = self.client.get(
            '/api/translations/dictionary/', {'word': '<script>', 'lang': 'en'}
        )
        self.assertEqual(response.status_code, 400)

    @mock.patch('reader.translations.views.lookup_dictionary')
    def test_successful_lookup_returns_contract_fields(self, lookup):
        from django.utils import timezone

        lookup.return_value = {
            'word': 'traditional',
            'lang': 'en',
            'part_of_speech': 'adjective',
            'phonetic_ipa': '/trəˈdɪʃənəl/',
            'audio_url': '/api/translations/tts/?text=traditional&lang=en',
            'confidence': 0.95,
            'senses': [{'meaning': 'long-established', 'examples': [], 'synonyms': []}],
            'synonyms': ['conventional'],
            'source': 'free-dictionary',
            'fetched_at': timezone.now(),
        }
        response = self.client.get(
            '/api/translations/dictionary/',
            {'word': 'traditional', 'lang': 'en', 'context': 'traditional festivities'},
        )
        self.assertEqual(response.status_code, 200)
        for field in ('word', 'lang', 'part_of_speech', 'phonetic_ipa', 'audio_url',
                      'confidence', 'senses', 'synonyms', 'source', 'fetched_at'):
            self.assertIn(field, response.data)

    @mock.patch('reader.translations.views.lookup_dictionary')
    def test_not_found_returns_404(self, lookup):
        from reader.translations.dictionary import DictionaryNotFound

        lookup.side_effect = DictionaryNotFound('not found')
        response = self.client.get(
            '/api/translations/dictionary/', {'word': 'zzzz', 'lang': 'en'}
        )
        self.assertEqual(response.status_code, 404)


class LanguageDetectEndpointTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_detects_english(self):
        response = self.client.post(
            '/api/translations/detect/', {'text': 'The traditional festivities of the Church year'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['lang'], 'en')
        self.assertGreater(response.data['confidence'], 0.5)

    def test_detects_indonesian(self):
        response = self.client.post(
            '/api/translations/detect/', {'text': 'Ini adalah buku yang sangat menarik dan bagus'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['lang'], 'id')

    def test_detects_script_language(self):
        response = self.client.post(
            '/api/translations/detect/', {'text': 'こんにちは世界'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['lang'], 'ja')

    def test_missing_text_returns_400(self):
        response = self.client.post('/api/translations/detect/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_text_over_limit_returns_400(self):
        response = self.client.post(
            '/api/translations/detect/', {'text': 'a' * 5001}, format='json'
        )
        self.assertEqual(response.status_code, 400)


class WordTtsEndpointTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_missing_text_returns_400(self):
        response = self.client.get('/api/translations/tts/')
        self.assertEqual(response.status_code, 400)

    @mock.patch('reader.translations.views.requests.get')
    def test_word_tts_returns_audio(self, mock_get):
        mock_get.return_value = mock.Mock(status_code=200, content=b'ID3' + b'0' * 200)

        response = self.client.get(
            '/api/translations/tts/', {'text': 'traditional', 'lang': 'en'}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'audio/mpeg')
        self.assertIn('max-age', response['Cache-Control'])
