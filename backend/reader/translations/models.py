# Translations app models
from django.db import models
from django.conf import settings
from reader.books.models import Sentence


class WordTranslation(models.Model):
    """Cached word translations"""
    sentence = models.ForeignKey(Sentence, on_delete=models.CASCADE, related_name='word_translations')
    word = models.CharField(max_length=100)
    word_lower = models.CharField(max_length=100, db_index=True)
    target_lang = models.CharField(max_length=10, default='id')
    engine = models.CharField(max_length=20, default='google')
    contextual_meaning = models.TextField()
    transliteration = models.CharField(max_length=200, blank=True)
    indonesian_meaning = models.CharField(max_length=200, blank=True)
    other_meanings = models.JSONField(default=list)
    insight = models.TextField(blank=True)
    ipa = models.CharField(max_length=100, blank=True)
    audio_url = models.CharField(max_length=500, blank=True)
    is_false_friend = models.BooleanField(default=False)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['word_lower', 'target_lang', 'engine']),
        ]

    def __str__(self):
        return f"{self.word} -> {self.contextual_meaning} ({self.target_lang})"


class SentenceTranslation(models.Model):
    """Cached sentence translations"""
    sentence = models.ForeignKey(Sentence, on_delete=models.CASCADE, related_name='translations')
    target_lang = models.CharField(max_length=10, default='id')
    engine = models.CharField(max_length=20, default='google')
    indonesian_text = models.TextField()
    transliteration = models.TextField(blank=True)
    tense = models.CharField(max_length=100, blank=True)
    structure = models.CharField(max_length=250, blank=True)
    grammar_details = models.JSONField(default=dict)
    notes = models.TextField(blank=True)
    model_used = models.CharField(max_length=100, default='google-gtx')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['sentence', 'target_lang', 'engine']),
        ]

    def __str__(self):
        return f"Translation for Sentence {self.sentence_id} ({self.target_lang})"
