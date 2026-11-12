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
