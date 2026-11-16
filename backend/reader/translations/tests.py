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
    def test_context_sentence_is_not_an_everyday_example(self, free, google_get):
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

        # The clicked sentence is the reading line, not an everyday example.
        self.assertEqual(payload['examples'], [])
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


class PronunciationTest(TestCase):
    def test_syllables_follow_vowel_nuclei(self):
        from reader.translations.pronunciation import syllabify

        self.assertEqual(syllabify('memory'), ['me', 'mo', 'ry'])
        self.assertEqual(syllabify('believe'), ['be', 'lieve'])
        self.assertEqual(syllabify('water'), ['wa', 'ter'])

    def test_one_letter_tail_joins_previous_syllable(self):
        from reader.translations.pronunciation import syllabify

        self.assertEqual(syllabify('honey'), ['ho', 'ney'])

    def test_pronunciation_block_keeps_stress_case(self):
        from reader.translations.pronunciation import build_pronunciation

        block = build_pronunciation('rəˈzilēənt', 'reZILient', '', 'en')

        self.assertEqual(block['ipa'], 'rəˈzilēənt')
        self.assertEqual(block['fonetik'], 're-ZIL-ient')
        self.assertEqual(block['suku_kata'], ['re', 'zil', 'ient'])

    def test_non_latin_uses_romanization_for_syllables(self):
        from reader.translations.pronunciation import build_pronunciation

        block = build_pronunciation('', '', 'kitab', 'ar')

        self.assertEqual(block['ipa'], '')
        self.assertEqual(block['fonetik'], 'ki-tab')


class LanguageCatalogueTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_catalogue_lists_indonesian_first(self):
        response = self.client.get('/api/translations/languages/')

        self.assertEqual(response.status_code, 200)
        languages = response.json()['languages']
        self.assertEqual(languages[0]['code'], 'id')
        self.assertTrue(any(item['code'] == 'en' for item in languages))
        self.assertTrue(all('tts' in item for item in languages))

    def test_tts_voice_maps_mandarin(self):
        from reader.translations.languages import tts_voice

        self.assertEqual(tts_voice('zh'), 'zh-CN')
        self.assertEqual(tts_voice('id'), 'id')


class InterlinearEndpointTest(TestCase):
    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient

        cache.clear()
        self.client = APIClient()

    def test_missing_text_returns_400(self):
        response = self.client.post('/api/translations/interlinear/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    @mock.patch('reader.translations.enrichment.translate_sentence')
    @mock.patch('reader.translations.interlinear.translate_query')
    def test_words_carry_target_and_alternatives(self, translate_query, sentence):
        sentence.return_value = {
            'source_text': 'She reads books.',
            'target_text': 'Dia membaca buku.',
        }

        def fake_query(params):
            word = params.get('q')
            return [
                [[{'She': 'Dia', 'reads': 'membaca', 'books.': 'buku.'}.get(word, word), word, None, None, 10]],
                [['verb', ['membaca', 'membaca keras'], []]],
            ]

        translate_query.side_effect = fake_query

        response = self.client.post(
            '/api/translations/interlinear/',
            {'text': 'She reads books.', 'source_lang': 'en', 'target_lang': 'id'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['target_text'], 'Dia membaca buku.')
        self.assertEqual(len(payload['words']), 3)
        self.assertEqual(payload['words'][0]['target'], 'Dia')
        self.assertEqual(payload['words'][1]['target'], 'membaca')
        self.assertIn('membaca keras', payload['words'][1]['alternatives'])

    @mock.patch('reader.translations.enrichment.translate_sentence')
    @mock.patch('reader.translations.interlinear.translate_query')
    def test_structure_labels_subject_and_predicate(self, translate_query, sentence):
        sentence.return_value = {'source_text': 'She reads books.', 'target_text': 'Dia membaca buku.'}
        translate_query.return_value = [[['x', 'x', None, None, 10]], []]

        response = self.client.post(
            '/api/translations/interlinear/',
            {'text': 'She reads books.', 'source_lang': 'en', 'target_lang': 'id'},
            format='json',
        )

        structure = response.json()['structure']
        labels = [segment['label'] for segment in structure['source']]
        self.assertEqual(labels[0], 'Subjek')
        self.assertIn('Predikat', labels)
        self.assertEqual(structure['pattern'].split('-')[0], 'S')

    @mock.patch('reader.translations.enrichment.translate_sentence')
    @mock.patch('reader.translations.interlinear.translate_query')
    def test_grammar_reports_tense(self, translate_query, sentence):
        sentence.return_value = {'source_text': 'She reads books.', 'target_text': 'Dia membaca buku.'}
        translate_query.return_value = [[['x', 'x', None, None, 10]], []]

        response = self.client.post(
            '/api/translations/interlinear/',
            {'text': 'She reads books.', 'source_lang': 'en', 'target_lang': 'id'},
            format='json',
        )

        grammar = response.json()['grammar']
        self.assertIn('Tense', grammar['tense'])
        self.assertTrue(grammar['note'])


class WordCardContractTest(TestCase):
    """The word card exposes the fixed field names the UI renders."""

    WORD_PAYLOAD = [
        [['ulet', 'resilient', None, None, 10], [None, None, None, 'rəˈzilēənt']],
        [['adjective', ['elastis', 'tabah'], [['elastis', ['elastic'], None, 0.04]]]],
        'en',
    ]

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def _google_side_effect(self):
        def fake_get(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[['ulet', 'resilient', None, None, 10]]]
            else:
                response.json.return_value = self.WORD_PAYLOAD
            return response

        return fake_get

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_card_has_fixed_fields(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{
                'meaning': 'returning quickly to shape',
                'examples': ['She is resilient after every setback.'],
                'synonyms': [],
            }],
            'synonyms': ['tough'],
            'phonetic_ipa': '/rɪˈzɪliənt/',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id')

        for field in (
            'arti_konteks', 'arti_lain', 'sinonim',
            'terjemahan_lain', 'ipa', 'fonetik', 'suku_kata',
            'definisi_bahasa_pilihan',
        ):
            self.assertIn(field, payload)

        # Tab Arti no longer carries a definition; that lives in its own tab.
        self.assertNotIn('definisi', payload)

        self.assertEqual(payload['arti_konteks'], 'ulet')
        self.assertEqual(payload['ipa'], '/rɪˈzɪliənt/')
        self.assertTrue(payload['suku_kata'])
        self.assertIn('elastis', payload['terjemahan_lain'])
        self.assertEqual(payload['sinonim'], ['tough'])
        self.assertTrue(payload['definisi_bahasa_pilihan'])
        self.assertIn('sesuai_konteks', payload['definisi_bahasa_pilihan'][0])

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_alternative_meanings_skip_the_primary(self, free, google_get):
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

        meanings = [item['makna'] for item in payload['arti_lain']]
        self.assertNotIn('ulet', meanings)
        self.assertIn('elastis', meanings)
        self.assertTrue(all('contoh' in item for item in payload['arti_lain']))


class TtsSpeedTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    @mock.patch('reader.translations.views.requests.get')
    def test_slow_speed_requests_slow_voice(self, mock_get):
        mock_get.return_value = mock.Mock(status_code=200, content=b'ID3' + b'0' * 200)

        response = self.client.get(
            '/api/translations/tts/',
            {'text': 'memory', 'lang': 'en', 'speed': 'slow'},
        )

        self.assertEqual(response.status_code, 200)
        called_url = mock_get.call_args[0][0]
        self.assertIn('ttsspeed=0.24', called_url)

    @mock.patch('reader.translations.views.requests.get')
    def test_normal_speed_has_no_slow_flag(self, mock_get):
        mock_get.return_value = mock.Mock(status_code=200, content=b'ID3' + b'0' * 200)

        self.client.get('/api/translations/tts/', {'text': 'memory', 'lang': 'en'})

        called_url = mock_get.call_args[0][0]
        self.assertNotIn('ttsspeed', called_url)


class SecondLanguageLayerTest(TestCase):
    """The card carries meanings in the mother tongue and the panel language."""

    WORD_PAYLOAD = [
        [['ulet', 'resilient', None, None, 10], [None, None, None, 'rəˈzilēənt']],
        [['adjective', ['elastis', 'tabah'], [['elastis', ['elastic'], None, 0.04]]]],
        'en',
    ]

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def _google_side_effect(self):
        def fake_get(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[['ulet', 'resilient', None, None, 10]]]
                return response
            if (params or {}).get('q') == 'resistente':
                response.json.return_value = [
                    [['resistente', 'resistente', None, None, 10], [None, None, None, 'resisˈtente']],
                    [['adjective', ['resistente'], []]],
                    'es',
                ]
                return response
            if (params or {}).get('tl') == 'es':
                response.json.return_value = [
                    [['resistente', 'resilient', None, None, 10]],
                    [['adjective', ['resistente', 'flexible'], []]],
                    'en',
                ]
                return response
            response.json.return_value = self.WORD_PAYLOAD
            return response

        return fake_get

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_card_has_second_meaning_layer(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id', target_lang='es')

        self.assertEqual(payload['bahasa_pilihan'], 'es')
        self.assertEqual(payload['arti_bahasa_pilihan'], 'resistente')
        self.assertIn('flexible', payload['terjemahan_lain_bahasa_pilihan'])
        self.assertTrue(payload['definisi_bahasa_pilihan_lain'])
        self.assertIn('sesuai_konteks', payload['definisi_bahasa_pilihan_lain'][0])
        # The mother-tongue layer is untouched.
        self.assertEqual(payload['arti_konteks'], 'ulet')
        self.assertIn('elastis', payload['terjemahan_lain'])

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_card_has_second_pronunciation_layer(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id', target_lang='es')

        reading = payload['pelafalan_bahasa_pilihan']
        self.assertEqual(reading['ipa'], 'resisˈtente')
        self.assertTrue(reading['fonetik'])
        self.assertTrue(reading['suku_kata'])
        self.assertIn('lang=es', reading['audio_url'])

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_panel_language_equal_to_mother_tongue_is_empty(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        payload = lookup('resilient', 'en', mother_lang='id', target_lang='id')

        self.assertEqual(payload['bahasa_pilihan'], 'id')
        self.assertEqual(payload['arti_bahasa_pilihan'], '')
        self.assertEqual(payload['terjemahan_lain_bahasa_pilihan'], [])
        self.assertEqual(payload['definisi_bahasa_pilihan_lain'], [])
        self.assertEqual(payload['pelafalan_bahasa_pilihan']['ipa'], '')

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_endpoint_accepts_target_lang(self, free, google_get):
        from rest_framework.test import APIClient

        free.return_value = {
            'part_of_speech': 'adjective',
            'senses': [{'meaning': 'returning quickly to shape', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }
        google_get.side_effect = self._google_side_effect()

        client = APIClient()
        response = client.get(
            '/api/translations/dictionary/',
            {'word': 'resilient', 'lang': 'en', 'mother_lang': 'id', 'target_lang': 'es'},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['bahasa_pilihan'], 'es')
        self.assertTrue(payload['arti_bahasa_pilihan'])


class TatoebaExampleTest(TestCase):
    """Everyday sentences in the panel language come from a real corpus."""

    TATOEBA_PAYLOAD = {
        'results': [
            {
                'text': 'Ella rompió el vaso sin querer.',
                'lang': 'spa',
                'translations': [[{'text': 'Dia memecahkan gelas itu tanpa sengaja.', 'lang': 'ind'}]],
            },
            {
                'text': 'Esa frase no contiene la palabra.',
                'lang': 'spa',
                'translations': [[{'text': 'Kalimat itu tidak memuat katanya.', 'lang': 'ind'}]],
            },
        ],
    }

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    @mock.patch('reader.translations.enrichment.requests.get')
    def test_real_sentences_keep_their_corpus_translation(self, get):
        from reader.translations.enrichment import fetch_tatoeba_examples

        response = mock.Mock()
        response.status_code = 200
        response.json.return_value = self.TATOEBA_PAYLOAD
        get.return_value = response

        examples = fetch_tatoeba_examples('romper', 'es', 'id')

        self.assertEqual(len(examples), 1)
        self.assertEqual(examples[0]['source_text'], 'Ella rompió el vaso sin querer.')
        self.assertEqual(examples[0]['target_text'], 'Dia memecahkan gelas itu tanpa sengaja.')
        self.assertEqual(examples[0]['origin'], 'tatoeba')

    @mock.patch('reader.translations.enrichment.requests.get')
    def test_missing_corpus_language_returns_nothing(self, get):
        from reader.translations.enrichment import fetch_tatoeba_examples

        self.assertEqual(fetch_tatoeba_examples('romper', 'xx', 'id'), [])
        get.assert_not_called()

    @mock.patch('reader.translations.enrichment.requests.get')
    def test_unreachable_corpus_returns_nothing(self, get):
        import requests as requests_module

        from reader.translations.enrichment import fetch_tatoeba_examples

        get.side_effect = requests_module.RequestException('down')

        self.assertEqual(fetch_tatoeba_examples('romper', 'es', 'id'), [])


class StudiedLanguageExampleTest(TestCase):
    """The Arti tab carries example sentences in the studied language."""

    @mock.patch('reader.translations.enrichment.fetch_tatoeba_examples')
    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_card_carries_studied_language_examples(self, free, google_get, corpus):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'verb',
            'senses': [{
                'meaning': 'separate into pieces',
                'examples': ['He broke the glass.'],
                'synonyms': [],
            }],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }

        def fake_google(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            query = (params or {}).get('q')
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[['memecahkan', query, None, None, 10]]]
            elif (params or {}).get('tl') == 'es':
                response.json.return_value = [
                    [['romper', 'break', None, None, 10]],
                    [['verb', ['romper', 'quebrar'], []]],
                    'en',
                ]
            else:
                response.json.return_value = [
                    [['memecahkan', 'break', None, None, 10]],
                    [['verb', ['merusak', 'memecahkan'], []]],
                    'en',
                ]
            return response

        corpus.side_effect = lambda word, lang, mother: [
            {
                'source_text': f'Sentence with {word}',
                'target_text': 'Kalimat terjemahan',
                'keyword': word,
                'origin': 'tatoeba',
            }
        ]
        google_get.side_effect = fake_google

        payload = lookup('break', 'en', mother_lang='id', target_lang='es')

        self.assertTrue(payload['contoh_bahasa_pilihan'])
        self.assertEqual(payload['contoh_bahasa_pilihan'][0]['origin'], 'tatoeba')
        self.assertEqual(payload['contoh_bahasa_pilihan'][0]['keyword'], 'romper')
        self.assertTrue(payload['arti_lain_bahasa_pilihan'])
        self.assertIn(
            'contoh_bahasa_pilihan',
            payload['arti_lain_bahasa_pilihan'][0],
        )
        # The row's own example is now the real studied-language sentence, so
        # the card shows Spanish usage without another field lookup.
        row = payload['arti_lain_bahasa_pilihan'][0]
        self.assertIn(row['makna'], row['contoh']['source_text'])
        self.assertEqual(row['contoh']['target_text'], 'Kalimat terjemahan')

    @mock.patch('reader.translations.enrichment.fetch_tatoeba_examples')
    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_no_corpus_match_leaves_list_empty(self, free, google_get, corpus):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'verb',
            'senses': [{'meaning': 'separate into pieces', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }

        def fake_google(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[['memecahkan', 'break', None, None, 10]]]
            elif (params or {}).get('tl') == 'es':
                response.json.return_value = [
                    [['romper', 'break', None, None, 10]],
                    [['verb', ['romper'], []]],
                    'en',
                ]
            else:
                response.json.return_value = [
                    [['memecahkan', 'break', None, None, 10]],
                    [['verb', ['merusak'], []]],
                    'en',
                ]
            return response

        corpus.return_value = []
        google_get.side_effect = fake_google

        payload = lookup('break', 'en', mother_lang='id', target_lang='es')

        self.assertEqual(payload['contoh_bahasa_pilihan'], [])


class DefinitionCoverageTest(TestCase):
    """Definitions exist for the studied language in every case."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_studied_language_equal_to_book_language_uses_dictionary_senses(self, free, google_get):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'verb',
            'senses': [{
                'meaning': 'resting with eyes closed',
                'examples': ['She is sleeping now.'],
                'synonyms': [],
            }],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }

        def fake_get(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            response.json.return_value = [[['sedang tidur', 'sleeping', None, None, 10]]]
            return response

        google_get.side_effect = fake_get

        payload = lookup('sleeping', 'en', mother_lang='id', target_lang='en')

        self.assertEqual(payload['bahasa_pilihan'], 'en')
        self.assertTrue(payload['definisi_bahasa_pilihan_lain'])
        first = payload['definisi_bahasa_pilihan_lain'][0]
        self.assertEqual(first['makna'], 'resting with eyes closed')
        self.assertEqual(first['contoh']['source_text'], 'She is sleeping now.')
        self.assertTrue(first['sesuai_konteks'])

    @mock.patch('reader.translations.enrichment.fetch_word_enrichment')
    @mock.patch('reader.translations.provider.requests.get')
    @mock.patch('reader.translations.dictionary._fetch_free_dictionary')
    def test_definitions_survive_a_failed_second_translation_layer(self, free, google_get, enrich):
        from reader.translations.dictionary import lookup

        free.return_value = {
            'part_of_speech': 'verb',
            'senses': [{'meaning': 'resting with eyes closed', 'examples': [], 'synonyms': []}],
            'synonyms': [],
            'phonetic_ipa': '',
            'source': 'free-dictionary',
        }

        def fake_enrich(word, source_lang, mother_lang):
            if mother_lang == 'es':
                return {}
            return {
                'mother_lang': mother_lang,
                'primary_meaning': 'sedang tidur',
                'pronunciation': {'ipa': '', 'guide': '', 'romanization': ''},
                'translations': [],
                'google_examples': [],
            }

        enrich.side_effect = fake_enrich

        def fake_get(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            response.json.return_value = [[['sedang tidur', 'sleeping', None, None, 10]]]
            return response

        google_get.side_effect = fake_get

        payload = lookup('sleeping', 'en', mother_lang='id', target_lang='es')

        self.assertEqual(payload['arti_bahasa_pilihan'], '')
        self.assertTrue(payload['definisi_bahasa_pilihan_lain'])
        self.assertEqual(
            payload['definisi_bahasa_pilihan_lain'][0]['makna'],
            'sedang tidur',
        )


class SentenceLayersEndpointTest(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from reader.books.models import Book, Chapter, Sentence

        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()
        self.book = Book.objects.create(title='Layers', format='txt', status='ready', language='en')
        self.chapter = Chapter.objects.create(book=self.book, index=0, title='One', content='Hello world.')
        self.sentence = Sentence.objects.create(chapter=self.chapter, index=0, text='Hello world.')

    @mock.patch('reader.translations.services.GoogleTranslateClient.translate_sentence')
    def test_layers_return_book_target_and_mother(self, translate):
        translate.side_effect = lambda text, target_lang='id', mother_lang='id': {
            'indonesian_text': {'es': 'Hola mundo.', 'id': 'Halo dunia.'}.get(target_lang, text),
            'transliteration': '',
            'tense': '',
            'structure': '',
            'grammar_details': {},
            'notes': '',
        }
        response = self.client.post(
            '/api/translations/sentence/',
            {
                'sentence_id': self.sentence.id,
                'target_lang': 'es',
                'mother_lang': 'id',
                'engine': 'google',
                'layers': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        layers = response.data['layers']
        self.assertEqual(layers['book'], {'lang': 'en', 'text': 'Hello world.'})
        self.assertEqual(layers['target'], {'lang': 'es', 'text': 'Hola mundo.'})
        self.assertEqual(layers['mother'], {'lang': 'id', 'text': 'Halo dunia.'})

    @mock.patch('reader.translations.services.GoogleTranslateClient.translate_sentence')
    def test_mother_layer_reuses_target_when_languages_match(self, translate):
        translate.return_value = {
            'indonesian_text': 'Halo dunia.',
            'transliteration': '',
            'tense': '',
            'structure': '',
            'grammar_details': {},
            'notes': '',
        }
        response = self.client.post(
            '/api/translations/sentence/',
            {
                'sentence_id': self.sentence.id,
                'target_lang': 'id',
                'mother_lang': 'id',
                'engine': 'google',
                'layers': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['layers']['mother'], response.data['layers']['target'])
        self.assertEqual(translate.call_count, 1)


class InterlinearMotherLayerTest(TestCase):
    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient

        cache.clear()
        self.client = APIClient()

    @mock.patch('reader.translations.enrichment.translate_sentence')
    @mock.patch('reader.translations.interlinear.translate_query')
    def test_each_word_carries_studied_and_mother_meanings(self, translate_query, sentence):
        sentence.return_value = {'source_text': 'She reads books.', 'target_text': 'Ella lee libros.'}

        translations = {
            ('es', 'She'): 'Ella',
            ('es', 'reads'): 'lee',
            ('es', 'books.'): 'libros.',
            ('id', 'She'): 'Dia',
            ('id', 'reads'): 'membaca',
            ('id', 'books.'): 'buku.',
        }

        def fake_query(params):
            value = translations.get((params.get('tl'), params.get('q')), params.get('q'))
            return [[[value, value, None, None, 10]], []]

        translate_query.side_effect = fake_query
        response = self.client.post(
            '/api/translations/interlinear/',
            {
                'text': 'She reads books.', 'source_lang': 'en',
                'target_lang': 'es', 'mother_lang': 'id',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['mother_lang'], 'id')
        words = {word['source']: word for word in payload['words']}
        self.assertEqual(words['reads']['target'], 'lee')
        self.assertEqual(words['reads']['mother'], 'membaca')

    @mock.patch('reader.translations.enrichment.translate_sentence')
    @mock.patch('reader.translations.interlinear.translate_query')
    def test_mother_mirrors_target_without_extra_lookup(self, translate_query, sentence):
        sentence.return_value = {'source_text': 'She reads.', 'target_text': 'Dia membaca.'}
        translate_query.return_value = [[['Dia', 'Dia', None, None, 10]], []]

        response = self.client.post(
            '/api/translations/interlinear/',
            {
                'text': 'She reads.', 'source_lang': 'en',
                'target_lang': 'id', 'mother_lang': 'id',
            },
            format='json',
        )

        payload = response.json()
        for word in payload['words']:
            self.assertEqual(word['mother'], word['target'])
            self.assertNotEqual(word['target'], '')


class SentenceAudioUrlTest(TestCase):
    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient
        from reader.books.models import Book, Chapter, Sentence

        cache.clear()
        self.client = APIClient()
        self.book = Book.objects.create(title='Audio', format='txt', status='ready', language='en')
        self.chapter = Chapter.objects.create(book=self.book, index=0, title='One', content='Hello world.')
        self.sentence = Sentence.objects.create(chapter=self.chapter, index=0, text='Hello world.')

    @mock.patch('reader.translations.services.GoogleTranslateClient.translate_sentence')
    def test_layers_response_includes_audio_for_each_layer(self, translate):
        translate.side_effect = lambda text, target_lang='id', mother_lang='id': {
            'indonesian_text': {'es': 'Hola mundo.', 'id': 'Halo dunia.'}.get(target_lang, text),
            'transliteration': '', 'tense': '', 'structure': '', 'grammar_details': {}, 'notes': '',
        }
        response = self.client.post(
            '/api/translations/sentence/',
            {
                'sentence_id': self.sentence.id, 'target_lang': 'es',
                'mother_lang': 'id', 'engine': 'google', 'layers': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        audio = response.data['audio']
        self.assertIn('lang=en', audio['book'])
        self.assertIn('lang=es', audio['target'])
        self.assertIn('lang=id', audio['mother'])
        self.assertTrue(all(audio.values()))


class AlternativeMeaningLayersTest(TestCase):
    """Arti Lainnya carries book, studied and mother-tongue readings."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def test_each_alternative_has_three_readings(self):
        from reader.translations.enrichment import build_meaning_layers

        alternatives = [
            {'makna': 'descanso', 'kelas_kata': 'noun', 'back_translations': ['break']},
            {'makna': 'romper', 'kelas_kata': 'verb', 'back_translations': ['break']},
        ]

        with mock.patch(
            'reader.translations.enrichment.translate_texts',
            side_effect=lambda texts, src, dst: [
                'istirahat' if text == 'descanso' else '' for text in texts
            ],
        ):
            rows = build_meaning_layers(alternatives, 'en', 'id', 'es')

        self.assertEqual(rows[0]['meaning_book'], 'break')
        self.assertEqual(rows[0]['meaning_learning'], 'descanso')
        self.assertEqual(rows[0]['meaning_mother'], 'istirahat')
        # A word the provider could not translate leaves the mother layer empty.
        self.assertEqual(rows[1]['meaning_mother'], '')
        self.assertEqual(rows[1]['meaning_book'], 'break')

    def test_learning_layer_is_empty_when_studied_language_is_the_mother_tongue(self):
        from reader.translations.enrichment import build_meaning_layers

        alternatives = [{'makna': 'istirahat', 'back_translations': ['break']}]
        rows = build_meaning_layers(alternatives, 'en', 'id', '')

        self.assertEqual(rows[0]['meaning_learning'], '')
        self.assertEqual(rows[0]['meaning_book'], 'break')

    def test_missing_back_translation_leaves_book_layer_empty(self):
        from reader.translations.enrichment import build_meaning_layers

        alternatives = [{'makna': 'descanso'}, {'makna': 'romper', 'back_translations': ['break']}]
        rows = build_meaning_layers(alternatives, 'en', 'id', 'es')

        self.assertEqual(rows[0]['meaning_book'], '')
        self.assertEqual(rows[1]['meaning_book'], 'break')

    def test_mother_list_translates_its_own_word_for_the_studied_layer(self):
        from reader.translations.enrichment import build_meaning_layers

        alternatives = [{'makna': 'istirahat', 'back_translations': ['break']}]

        with mock.patch(
            'reader.translations.enrichment.translate_texts',
            side_effect=lambda texts, src, dst: [
                'descanso' if text == 'istirahat' else '' for text in texts
            ],
        ):
            rows = build_meaning_layers(alternatives, 'en', 'id', 'es', makna_layer='mother')

        self.assertEqual(rows[0]['meaning_mother'], 'istirahat')
        self.assertEqual(rows[0]['meaning_learning'], 'descanso')
        self.assertNotEqual(rows[0]['meaning_learning'], rows[0]['meaning_mother'])


class ExampleLayersTest(TestCase):
    """Contoh dalam Keseharian carries book, studied and mother-tongue text."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def test_each_example_has_three_texts(self):
        from reader.translations.enrichment import build_example_layers

        examples = [{
            'source_text': 'She took a short break.',
            'target_text': 'Dia istirahat sebentar.',
            'keyword': 'break',
            'origin': 'corpus',
        }]

        with mock.patch(
            'reader.translations.enrichment.translate_texts',
            return_value=['Ella tomó un descanso corto.'],
        ):
            rows = build_example_layers(examples, 'en', 'es', 'id')

        self.assertEqual(rows[0]['text_book'], 'She took a short break.')
        self.assertEqual(rows[0]['text_learning'], 'Ella tomó un descanso corto.')
        self.assertEqual(rows[0]['text_mother'], 'Dia istirahat sebentar.')

    def test_learning_text_reuses_book_text_without_translating(self):
        from reader.translations.enrichment import build_example_layers

        examples = [{'source_text': 'She took a break.', 'target_text': 'Dia istirahat.'}]

        with mock.patch('reader.translations.enrichment.translate_texts') as translate:
            rows = build_example_layers(examples, 'en', 'en', 'id')

        translate.assert_not_called()
        self.assertEqual(rows[0]['text_learning'], 'She took a break.')

    def test_learning_text_reuses_mother_text_when_languages_match(self):
        from reader.translations.enrichment import build_example_layers

        examples = [{'source_text': 'She took a break.', 'target_text': 'Dia istirahat.'}]

        with mock.patch('reader.translations.enrichment.translate_texts') as translate:
            rows = build_example_layers(examples, 'en', 'id', 'id')

        translate.assert_not_called()
        self.assertEqual(rows[0]['text_learning'], 'Dia istirahat.')


class DictionaryThreeLayerTest(TestCase):
    """The word card sends book, studied and mother layers for both blocks."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()

    def _free(self):
        return {
            'part_of_speech': 'verb',
            'senses': [
                {'meaning': 'separate into pieces', 'examples': ['He broke the glass.'], 'synonyms': []},
                {'meaning': 'a pause from work', 'examples': [], 'synonyms': []},
            ],
            'synonyms': [], 'phonetic_ipa': '', 'source': 'free-dictionary',
        }

    def _google(self):
        table = {
            ('separate into pieces', 'id'): 'memisahkan',
            ('a pause from work', 'id'): 'istirahat',
            ('He broke the glass.', 'id'): 'Dia memecahkan gelas itu.',
            ('separate into pieces', 'es'): 'separar en pedazos',
            ('a pause from work', 'es'): 'tomar un descanso',
            ('He broke the glass.', 'es'): 'Él rompió el vaso.',
            # The mother-tongue list translates its own word for the studied
            # layer, so those pairs are looked up too.
            ('merusak', 'es'): 'separar en pedazos',
            ('memecahkan', 'es'): 'romper',
            ('quebrar', 'id'): 'memisahkan',
        }

        def fake(url, params=None, **kwargs):
            response = mock.Mock()
            response.status_code = 200
            query = (params or {}).get('q')
            lang = (params or {}).get('tl')
            if (params or {}).get('dt') == 't':
                response.json.return_value = [[[table.get((query, lang), ''), query, None, None, 10]]]
            elif lang == 'es':
                # Shape Google really returns: sense list at index 1, the same
                # senses with their book-language words at index 2.
                response.json.return_value = [
                    [['romper', 'break', None, None, 10]],
                    [['verb', ['romper', 'quebrar'], [
                        ['romper', ['break', 'smash'], None, 0.5],
                        ['quebrar', ['break'], None, 0.1],
                    ]]],
                    'en',
                ]
            else:
                response.json.return_value = [
                    [['memecahkan', 'break', None, None, 10]],
                    [['verb', ['memecahkan', 'merusak'], [
                        ['memecahkan', ['break', 'smash'], None, 0.5],
                        ['merusak', ['break'], None, 0.1],
                    ]]],
                    'en',
                ]
            return response

        return fake

    def _lookup(self):
        from reader.translations.dictionary import lookup

        with mock.patch(
            'reader.translations.dictionary._fetch_free_dictionary', return_value=self._free()
        ), mock.patch(
            'reader.translations.provider.requests.get', side_effect=self._google()
        ), mock.patch(
            'reader.translations.enrichment.fetch_tatoeba_examples',
            side_effect=lambda word, lang, mother: [{
                'source_text': f'Uso real de {word}',
                'target_text': f'Pemakaian nyata {word}',
                'keyword': word,
                'origin': 'tatoeba',
            }],
        ):
            return lookup('break', 'en', mother_lang='id', target_lang='es')

    def test_alternative_meanings_carry_three_layers(self):
        payload = self._lookup()
        rows = payload['arti_lain_bahasa_pilihan']
        self.assertTrue(rows)
        row = rows[0]
        # The book reading is the word this sense translates back to, taken from
        # the same provider answer, so it belongs to the same sense.
        self.assertEqual(row['meaning_book'], 'break')
        self.assertEqual(row['meaning_learning'], 'quebrar')
        self.assertEqual(row['meaning_mother'], 'memisahkan')

    def test_mother_alternative_list_does_not_repeat_itself(self):
        payload = self._lookup()
        rows = payload['arti_lain']
        self.assertTrue(rows)
        row = rows[0]
        self.assertEqual(row['meaning_mother'], 'merusak')
        self.assertNotEqual(row['meaning_learning'], row['meaning_mother'])
        self.assertEqual(row['meaning_learning'], 'separar en pedazos')
        self.assertEqual(row['meaning_book'], 'break')

    def test_examples_carry_three_texts(self):
        payload = self._lookup()
        self.assertTrue(payload['examples'])
        row = payload['examples'][0]
        self.assertEqual(row['text_book'], 'He broke the glass.')
        self.assertEqual(row['text_learning'], 'Él rompió el vaso.')
        self.assertEqual(row['text_mother'], 'Dia memecahkan gelas itu.')

    def test_studied_examples_carry_three_texts(self):
        payload = self._lookup()
        self.assertTrue(payload['contoh_bahasa_pilihan'])
        row = payload['contoh_bahasa_pilihan'][0]
        self.assertEqual(row['text_learning'], 'Uso real de romper')
        self.assertEqual(row['text_mother'], 'Pemakaian nyata romper')
        self.assertIn('text_book', row)


class TranslateReaderProxyTest(TestCase):
    """A blocked server repeats the query through the reading proxy."""

    def _blocked(self):
        response = mock.Mock()
        response.status_code = 429
        return response

    @mock.patch('reader.translations.provider.requests.get')
    def test_proxy_payload_is_parsed_when_google_blocks(self, get):
        from django.test import override_settings
        from reader.translations.provider import translate_query

        blocked = self._blocked()
        proxied = mock.Mock()
        proxied.status_code = 200
        proxied.text = (
            'Title: \n\nMarkdown Content:\n'
            '[[["merusak","break",null,null,10]],[]]'
        )
        get.side_effect = [blocked, blocked, blocked, proxied]

        with override_settings(TRANSLATE_READER_PROXY='https://reader.example'):
            payload = translate_query({'sl': 'en', 'tl': 'id', 'dt': 't', 'q': 'break'})

        self.assertEqual(payload[0][0][0], 'merusak')

    @mock.patch('reader.translations.provider.requests.get')
    def test_no_proxy_configured_returns_none(self, get):
        from django.test import override_settings
        from reader.translations.provider import translate_query

        get.return_value = self._blocked()

        with override_settings(TRANSLATE_READER_PROXY=''):
            self.assertIsNone(translate_query({'sl': 'en', 'tl': 'id', 'q': 'break'}))

    @mock.patch('reader.translations.provider.requests.get')
    def test_proxy_block_page_is_not_mistaken_for_a_translation(self, get):
        from django.test import override_settings
        from reader.translations.provider import translate_query

        blocked = self._blocked()
        blocked_page = mock.Mock()
        blocked_page.status_code = 200
        blocked_page.text = 'Markdown Content:\nOur systems have detected unusual traffic'
        get.side_effect = [blocked, blocked, blocked, blocked_page]

        with override_settings(TRANSLATE_READER_PROXY='https://reader.example'):
            self.assertIsNone(translate_query({'sl': 'en', 'tl': 'id', 'q': 'break'}))
