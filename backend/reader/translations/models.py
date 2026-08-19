# Translations app models
from django.db import models
from django.conf import settings
from reader.books.models import Sentence


class WordTranslation(models.Model):
    """Cached word translations with context & language support"""
    sentence = models.ForeignKey(Sentence, on_delete=models.CASCADE, related_name='word_translations')
    word = models.CharField(max_length=100)
    word_lower = models.CharField(max_length=100, db_index=True)
    target_lang = models.CharField(max_length=10, default='id')
    engine = models.CharField(max_length=20, default='google')
    contextual_meaning = models.TextField()  # Primary translation
    transliteration = models.CharField(max_length=200, blank=True)  # Latin phonetic guide for target word
    other_meanings = models.JSONField(default=list)  # Parts of speech list / alternatives
    insight = models.TextField(blank=True)  # Usage hint for beginners
    ipa = models.CharField(max_length=100, blank=True)
    audio_url = models.CharField(max_length=500, blank=True)
    is_false_friend = models.BooleanField(default=False)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['sentence', 'word_lower', 'target_lang', 'engine']
        indexes = [
            models.Index(fields=['word_lower', 'target_lang', 'engine']),
        ]
    
    def __str__(self):
        return f"{self.word} [{self.target_lang}] in sentence {self.sentence.id}"


class SentenceTranslation(models.Model):
    """Cached full sentence/paragraph translations with Grammar & Tense analysis"""
    sentence = models.ForeignKey(Sentence, on_delete=models.CASCADE, related_name='translations')
    target_lang = models.CharField(max_length=10, default='id')
    engine = models.CharField(max_length=20, default='google')
    indonesian_text = models.TextField()
    transliteration = models.TextField(blank=True)  # Latin phonetic guide (Pinyin, Romaji, etc.)
    tense = models.CharField(max_length=200, blank=True)  # 16 Tenses classification
    structure = models.TextField(blank=True)  # S+V+O pattern
    grammar_details = models.JSONField(default=dict)  # { verbs, nouns, adjectives }
    notes = models.TextField(blank=True)
    model_used = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['sentence', 'target_lang', 'engine']
    
    def __str__(self):
        return f"Translation [{self.target_lang}] for sentence {self.sentence.id}"
