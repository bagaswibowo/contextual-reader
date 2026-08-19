# Translations serializers
from rest_framework import serializers
from .models import WordTranslation, SentenceTranslation


class WordTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordTranslation
        fields = ['id', 'word', 'target_lang', 'engine', 'contextual_meaning', 'other_meanings', 
                  'insight', 'ipa', 'audio_url', 'is_false_friend', 'confidence']


class SentenceTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SentenceTranslation
        fields = ['id', 'target_lang', 'engine', 'indonesian_text', 'tense', 'structure', 
                  'grammar_details', 'notes', 'model_used', 'created_at']
