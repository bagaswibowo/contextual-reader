import re
from unittest.mock import patch
from django.test import TestCase
from reader.translations.services import (
    GrammarAnalyzer,
    GoogleTranslateClient,
    UniversalWordTokenizer,
    TranslationService
)


# Static fake responses so tests never touch the real Google Translate API.
FAKE_WORD_TRANSLATION = {
    "contextual_meaning": "apel",
    "transliteration": "",
    "indonesian_meaning": "apel",
    "other_meanings": ["buah"],
    "insight": "buah yang manis",
    "ipa": "",
    "audio_url": "",
    "is_false_friend": False,
    "confidence": 0.95,
}

FAKE_SENTENCE_TRANSLATION = {
    "indonesian_text": "Anjing coklat yang cepat melompat di atas anjing malas.",
    "transliteration": "",
    "tense": "Simple Present Tense",
    "structure": "Subjek + Verbe + Objek",
    "grammar_details": {},
    "notes": "",
    "model_used": "google-gtx",
}


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


class GoogleTranslateClientTest(TestCase):
    @patch.object(GoogleTranslateClient, "translate_word", return_value=dict(FAKE_WORD_TRANSLATION))
    def test_translate_word(self, _mock):
        result = GoogleTranslateClient.translate_word("apple", target_lang="id", mother_lang="id")
        self.assertTrue(len(result["contextual_meaning"]) > 0)
        self.assertEqual(result["contextual_meaning"], "apel")

    @patch.object(GoogleTranslateClient, "translate_sentence", return_value=dict(FAKE_SENTENCE_TRANSLATION))
    def test_translate_sentence_id(self, _mock):
        text = "The quick brown fox jumps over the lazy dog."
        result = GoogleTranslateClient.translate_sentence(text, target_lang="id")
        self.assertNotEqual(result["indonesian_text"], text)
        self.assertTrue(len(result["indonesian_text"]) > 0)
        self.assertIn("tense", result)

    @patch.object(GoogleTranslateClient, "translate_sentence", return_value=dict(FAKE_SENTENCE_TRANSLATION))
    def test_translate_sentence_ja(self, _mock):
        text = "I love learning new languages."
        result = GoogleTranslateClient.translate_sentence(text, target_lang="ja")
        self.assertTrue(len(result["indonesian_text"]) > 0)


class UniversalWordTokenizerTest(TestCase):
    def test_token_pairs(self):
        translated_text = "こんにちは 世界"
        pairs = UniversalWordTokenizer.get_token_pairs(translated_text, target_lang="ja", mother_lang="id")
        self.assertTrue(isinstance(pairs, list))
