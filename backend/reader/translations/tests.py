import re
from django.test import TestCase
from reader.translations.services import (
    GrammarAnalyzer,
    GoogleTranslateClient,
    UniversalWordTokenizer,
    TranslationService
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


class GoogleTranslateClientTest(TestCase):
    def test_translate_sentence_id(self):
        text = "The quick brown fox jumps over the lazy dog."
        result = GoogleTranslateClient.translate_sentence(text, target_lang="id")
        self.assertNotEqual(result["indonesian_text"], text)
        self.assertTrue(len(result["indonesian_text"]) > 0)
        self.assertIn("tense", result)

    def test_translate_sentence_ja(self):
        text = "I love learning new languages."
        result = GoogleTranslateClient.translate_sentence(text, target_lang="ja")
        self.assertNotEqual(result["indonesian_text"], text)
        self.assertTrue(len(result["indonesian_text"]) > 0)

    def test_translate_word(self):
        result = GoogleTranslateClient.translate_word("apple", target_lang="id", mother_lang="id")
        self.assertTrue(len(result["contextual_meaning"]) > 0)


class UniversalWordTokenizerTest(TestCase):
    def test_token_pairs(self):
        translated_text = "こんにちは 世界"
        pairs = UniversalWordTokenizer.get_token_pairs(translated_text, target_lang="ja", mother_lang="id")
        self.assertTrue(isinstance(pairs, list))
