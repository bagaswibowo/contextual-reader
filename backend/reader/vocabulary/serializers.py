# Vocabulary serializers
from rest_framework import serializers
from .models import VocabularyEntry, ReviewSession
from reader.translations.serializers import WordTranslationSerializer
from reader.books.serializers import SentenceSerializer


class VocabularyEntrySerializer(serializers.ModelSerializer):
    word_translation = WordTranslationSerializer(read_only=True)
    sentence_text = serializers.CharField(source='sentence.text', read_only=True)
    chapter_title = serializers.CharField(source='sentence.chapter.title', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)
    
    class Meta:
        model = VocabularyEntry
        fields = ['id', 'word_translation', 'sentence_text', 'chapter_title', 'book_title',
                  'status', 'review_count', 'correct_count', 'last_reviewed', 
                  'next_review', 'ease_factor', 'interval', 'created_at']


class VocabularyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VocabularyEntry
        fields = ['user_id', 'word_translation']
        read_only_fields = ['user_id']


class ReviewSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewSession
        fields = ['id', 'book', 'started_at', 'ended_at', 'cards_reviewed', 'cards_correct']