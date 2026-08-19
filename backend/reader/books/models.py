# Books app models
from django.db import models
from django.conf import settings


class Book(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    title = models.CharField(max_length=500)
    author = models.CharField(max_length=500, blank=True)
    file = models.FileField(upload_to='books/', max_length=500)
    format = models.CharField(max_length=10, choices=[('epub', 'EPUB'), ('txt', 'TXT'), ('pdf', 'PDF')])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_chapters = models.IntegerField(default=0)
    total_words = models.IntegerField(default=0)
    language = models.CharField(max_length=10, default='en')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Chapter(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='chapters')
    index = models.IntegerField()
    title = models.CharField(max_length=500, blank=True)
    content = models.TextField()
    word_count = models.IntegerField(default=0)
    start_offset = models.IntegerField(default=0)
    end_offset = models.IntegerField(default=0)

    class Meta:
        ordering = ['index']
        unique_together = ['book', 'index']

    def __str__(self):
        return f"{self.book.title} - Chapter {self.index}"


class Sentence(models.Model):
    """Individual sentences for translation and word context"""
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='sentences')
    index = models.IntegerField()
    text = models.TextField()
    start_char = models.IntegerField(default=0)
    end_char = models.IntegerField(default=0)
    word_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['index']
        unique_together = ['chapter', 'index']

    def __str__(self):
        return f"Sentence {self.index} ({self.word_count} words)"
