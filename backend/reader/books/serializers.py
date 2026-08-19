# Books app serializers
import os
import re
from rest_framework import serializers
from .models import Book, Chapter, Sentence


class SentenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sentence
        fields = ['id', 'index', 'text', 'word_count']


class ChapterSerializer(serializers.ModelSerializer):
    sentences = SentenceSerializer(many=True, read_only=True)

    class Meta:
        model = Chapter
        fields = ['id', 'index', 'title', 'content', 'word_count', 'sentences']


class ChapterListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ['id', 'index', 'title', 'word_count']


class BookSerializer(serializers.ModelSerializer):
    chapters = ChapterListSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'format', 'status', 'total_chapters', 
                  'total_words', 'language', 'created_at', 'chapters']


class BookUploadSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)
    author = serializers.CharField(required=False, allow_blank=True)
    format = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'file', 'format']
        read_only_fields = ['id']

    def validate(self, attrs):
        file = attrs.get('file')
        if not file:
            raise serializers.ValidationError({"file": "File is required."})

        # Check file size (100MB limit)
        if file.size > 100 * 1024 * 1024:
            raise serializers.ValidationError({"file": "File size exceeds 100MB limit."})

        # Infer extension & format
        filename = file.name or ""
        ext = filename.split('.')[-1].lower() if '.' in filename else ""
        
        if ext not in ['epub', 'txt', 'pdf']:
            raise serializers.ValidationError({"file": f"Unsupported format (.{ext}). Use EPUB, TXT, or PDF."})

        # Truncate filename safely if > 80 chars to fit Django FileField max_length
        if len(filename) > 80:
            name_part = filename.rsplit('.', 1)[0]
            clean_name = re.sub(r'[^\w\s-]', '', name_part)[:70].strip()
            file.name = f"{clean_name}.{ext}"

        attrs['format'] = ext

        # Auto-set title if blank
        if not attrs.get('title'):
            attrs['title'] = filename.rsplit('.', 1)[0][:200]

        return attrs
