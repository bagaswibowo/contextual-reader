# Vocabulary app models
from django.db import models
from django.conf import settings
from reader.books.models import Book, Sentence
from reader.translations.models import WordTranslation


class VocabularyEntry(models.Model):
    """User's saved vocabulary words"""
    user_id = models.CharField(max_length=100, db_index=True)  # Simple user identification
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='vocabulary_entries')
    word_translation = models.ForeignKey(WordTranslation, on_delete=models.CASCADE, related_name='vocabulary_entries')
    sentence = models.ForeignKey(Sentence, on_delete=models.CASCADE, related_name='vocabulary_entries')
    
    # Learning status
    STATUS_CHOICES = [
        ('learning', 'Learning'),
        ('known', 'Known'),
        ('mastered', 'Mastered'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='learning')
    
    # Spaced repetition fields
    review_count = models.IntegerField(default=0)
    correct_count = models.IntegerField(default=0)
    last_reviewed = models.DateTimeField(null=True, blank=True)
    next_review = models.DateTimeField(null=True, blank=True)
    ease_factor = models.FloatField(default=2.5)  # SM-2 algorithm
    interval = models.IntegerField(default=1)  # days
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user_id', 'word_translation']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'status']),
            models.Index(fields=['user_id', 'next_review']),
        ]
    
    def __str__(self):
        return f"{self.word_translation.word} ({self.status})"


class ReviewSession(models.Model):
    """Track review sessions for statistics"""
    user_id = models.CharField(max_length=100, db_index=True)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='review_sessions')
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    cards_reviewed = models.IntegerField(default=0)
    cards_correct = models.IntegerField(default=0)
    
    def __str__(self):
        return f"Session {self.id} - {self.cards_reviewed} cards"