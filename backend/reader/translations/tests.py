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

    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_cache_hit_skips_provider(self, free):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'long-established', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '/trəˈdɪʃənəl/',
            'source': 'free-dictionary',
        }
        lookup('traditional', 'en')
        lookup('traditional', 'en')

        self.assertEqual(free.call_count, 1)

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


class PronunciationGuideTest(TestCase):
    def test_ipa_is_turned_into_a_readable_guide(self):
        from reader.translations.enrichment import ipa_to_guide

        guide = ipa_to_guide('rəˈzilēənt')

        self.assertTrue(guide)
        self.assertNotIn('ə', guide)
        self.assertNotIn('ˈ', guide)
        self.assertTrue(any(char.isupper() for char in guide))

    def test_blank_ipa_returns_empty_guide(self):
        from reader.translations.enrichment import ipa_to_guide

        self.assertEqual(ipa_to_guide(''), '')
        self.assertEqual(ipa_to_guide(None), '')


class DictionaryEnrichmentTest(TestCase):
    """The mother-tongue layer is added on top of the source-language entry."""

    WORD_PAYLOAD = [
        [['ulet', 'resilient', None, None, 10], [None, None, None, 'rəˈzilēənt']],
        [['adjective', ['elastis', 'tabah', 'lenting'], [['elastis', ['elastic'], None, 0.04]]]],
        'en',
    ]

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def _google_side_effect(self, payload=None):
        payload = payload or self.WORD_PAYLOAD

        def fake_get(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[['ulet', 'resilient', None, None, 10]]]
            else:
                response.json.return_value = payload
            return response

        return fake_get

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_lookup_adds_mother_tongue_layer(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id')

        self.assertEqual(payload['mother_meaning'], 'ulet')
        self.assertEqual(payload['contextual_meaning'], 'ulet')
        self.assertTrue(any('elastis' in item for item in payload['other_meanings']))
        self.assertEqual(payload['translations_table'][0]['target_word'], 'ulet')
        self.assertEqual(payload['translations_table'][0]['frequency'], 3)
        self.assertTrue(payload['pronunciation']['guide'])
        self.assertEqual(payload['phonetic_ipa'], 'rəˈzilēənt')

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_lookup_builds_bilingual_examples(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{
                'meaning': 'returning quickly to shape',
                'examples': ['She is resilient after every setback.'],
                'synonyms': [],
            }],
            'synonyms': [],
            'phonetic_ipa': '/rɪˈzɪliənt/',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id')

        self.assertEqual(len(payload['examples']), 1)
        self.assertEqual(payload['examples'][0]['source_text'], 'She is resilient after every setback.')
        self.assertEqual(payload['examples'][0]['target_text'], 'ulet')
        self.assertEqual(payload['examples'][0]['keyword'], 'resilient')

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_context_sentence_becomes_first_example(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '/rɪˈzɪliənt/',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup(
            'resilient', 'en',
            context='The team stayed resilient through the crisis.',
            mother_lang='id',
        )

        self.assertEqual(
            payload['examples'][0]['source_text'],
            'The team stayed resilient through the crisis.',
        )
        self.assertEqual(payload['examples'][0]['target_text'], 'ulet')
        self.assertEqual(
            payload['sentence_translation']['source_text'],
            'The team stayed resilient through the crisis.',
        )
        self.assertEqual(payload['sentence_translation']['target_text'], 'ulet')

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_enrichment_failure_keeps_source_entry(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '/rɪˈzɪliənt/',
            'source': 'free-dictionary',
        }
        google_get.side_effect = RuntimeError('upstream down')

        payload = lookup('resilient', 'en', mother_lang='id')

        self.assertEqual(payload['senses'][0]['meaning'], 'returning quickly to shape')
        self.assertEqual(payload['mother_meaning'], '')
        self.assertEqual(payload['examples'], [])
        self.assertEqual(payload['phonetic_ipa'], '/rɪˈzɪliənt/')

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_non_latin_word_uses_romanization(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'noun',
            'senses': [{'meaning': 'book', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect([
            [['buku', '本', None, None, 11], [None, None, None, 'Hon']],
            [['noun', ['buku'], [['buku', ['book'], None, 0.1]]]],
            'ja',
        ])

        payload = lookup('本', 'ja', mother_lang='id')

        self.assertEqual(payload['pronunciation']['romanization'], 'Hon')
        self.assertEqual(payload['pronunciation']['guide'], 'Hon')
        self.assertEqual(payload['phonetic_ipa'], '')
        self.assertEqual(payload['mother_meaning'], 'buku')


class EverydayExampleTest(TestCase):
    """Examples must never be empty when the model can supply everyday usage."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def test_model_examples_fill_when_corpus_is_thin(self):
        from reader.translations import enrichment

        response = (
            '{"examples": ['
            '{"source": "He remarried last year.", "target": "Dia menikah lagi tahun lalu."},'
            '{"source": "She remarried after the divorce.", "target": "Dia menikah lagi setelah bercerai."},'
            '{"source": "They remarried in a small ceremony.", "target": "Mereka menikah lagi dalam upacara kecil."}'
            ']}'
        )
        with mock.patch(
            'reader.translations.services.LLMClient.get_completion_text',
            return_value=response,
        ):
            examples = enrichment.build_examples(
                [], 'remarried', 'en', 'id', meaning='menikah lagi'
            )

        self.assertEqual(len(examples), 3)
        self.assertTrue(all(item['origin'] == 'model' for item in examples))
        self.assertEqual(examples[0]['target_text'], 'Dia menikah lagi tahun lalu.')

    def test_model_examples_without_the_word_are_dropped(self):
        from reader.translations import enrichment

        response = (
            '{"examples": ['
            '{"source": "He stayed home.", "target": "Dia di rumah."},'
            '{"source": "They remarried quietly.", "target": "Mereka menikah lagi diam-diam."}'
            ']}'
        )
        with mock.patch(
            'reader.translations.services.LLMClient.get_completion_text',
            return_value=response,
        ):
            examples = enrichment.build_examples(
                [], 'remarried', 'en', 'id', meaning='menikah lagi'
            )

        self.assertEqual(len(examples), 1)
        self.assertEqual(examples[0]['source_text'], 'They remarried quietly.')

    def test_model_failure_leaves_corpus_examples(self):
        from reader.translations import enrichment

        with mock.patch(
            'reader.translations.services.LLMClient.get_completion_text',
            side_effect=RuntimeError('no endpoint'),
        ), mock.patch(
            'reader.translations.enrichment._translate_text',
            return_value='Dia menikah lagi.',
        ):
            examples = enrichment.build_examples(
                ['She remarried.'], 'remarried', 'en', 'id', meaning='menikah lagi'
            )

        self.assertEqual(len(examples), 1)
        self.assertEqual(examples[0]['origin'], 'corpus')

    @mock.patch('reader.translations.enrichment.translate_query')
    def test_sentence_translation_returns_pair(self, translate_query):
        from reader.translations import enrichment

        translate_query.return_value = [[['Orang tuaku bercerai saat aku berusia empat tahun.', 'My parents divorced when I was four.', None, None, 10]]]

        result = enrichment.translate_sentence(
            'My parents divorced when I was four.', 'en', 'id'
        )

        self.assertEqual(
            result['target_text'],
            'Orang tuaku bercerai saat aku berusia empat tahun.',
        )
        self.assertEqual(result['source_text'], 'My parents divorced when I was four.')

    def test_google_example_bank_is_used_before_writing_our_own(self):
        from reader.translations import enrichment

        payload = [
            [['ulet', 'resilient', None, None, 10], [None, None, None, 'rəˈzilēənt']],
            [['adjective', ['elastis'], []]],
            'en', None, None, None, None, [], None, None, None, None, None,
            [
                [['a shoe with <b>resilient</b> cushioning', None, None, None, None, 'x'],
                ['the fish are <b>resilient</b> to most infections', None, None, None, None, 'x']],
            ],
        ]
        with mock.patch('reader.translations.enrichment.translate_query', return_value=payload):
            from django.core.cache import cache
            cache.clear()
            result = enrichment.fetch_word_enrichment('resilient', 'en', 'id')

        self.assertEqual(len(result['google_examples']), 2)
        self.assertEqual(result['google_examples'][0], 'a shoe with resilient cushioning')

    def test_google_macron_reading_is_not_left_empty(self):
        from reader.translations.enrichment import ipa_to_guide

        self.assertEqual(ipa_to_guide('bəˈlēv'), 'beLIV')


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
    def test_mother_lang_is_forwarded(self, lookup):
        lookup.return_value = {'word': 'resilient', 'lang': 'en', 'mother_lang': 'es'}
        response = self.client.get(
            '/api/translations/dictionary/',
            {'word': 'resilient', 'lang': 'en', 'mother_lang': 'es'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(lookup.call_args.kwargs['mother_lang'], 'es')

    def test_mother_lang_too_long_returns_400(self):
        response = self.client.get(
            '/api/translations/dictionary/',
            {'word': 'resilient', 'lang': 'en', 'mother_lang': 'x' * 11},
        )
        self.assertEqual(response.status_code, 400)

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
