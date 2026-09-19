import posixpath
import zipfile
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
        
        if ext not in ['epub', 'txt', 'pdf', 'md', 'zip']:
            raise serializers.ValidationError({"file": f"Unsupported format (.{ext}). Use EPUB, TXT, PDF, MD, or ZIP (MinerU)."})

        # Validate magic bytes / file signature
        try:
            file.seek(0)
            header = file.read(4)
            file.seek(0)
        except Exception:
            header = b""

        if ext == 'pdf' and not header.startswith(b'%PDF'):
            raise serializers.ValidationError({"file": "Invalid PDF file header."})
        elif ext in ['epub', 'zip'] and not header.startswith(b'PK'):
            raise serializers.ValidationError({"file": f"Invalid {ext.upper()} archive header."})

        # Zip Slip & Zip Bomb validation for zip & epub archives
        if ext in ['zip', 'epub']:
            try:
                if not zipfile.is_zipfile(file):
                    raise serializers.ValidationError({"file": f"Uploaded file is not a valid {ext.upper()} archive."})
                with zipfile.ZipFile(file) as zf:
                    if len(zf.infolist()) > 1000:
                        raise serializers.ValidationError({"file": f"{ext.upper()} archive contains too many entries (max 1000)."})
                    total_uncompressed = 0
                    has_md = False
                    for member in zf.infolist():
                        sanitized_name = member.filename.replace('\\', '/')
                        norm_name = posixpath.normpath(sanitized_name)
                        if norm_name.startswith('..') or posixpath.isabs(norm_name) or '/../' in sanitized_name:
                            raise serializers.ValidationError({"file": f"Malformed {ext.upper()} archive: potential path traversal detected."})
                        total_uncompressed += member.file_size
                        if total_uncompressed > 250 * 1024 * 1024:
                            raise serializers.ValidationError({"file": f"Uncompressed {ext.upper()} contents exceed 250MB limit."})
                        if member.filename.lower().endswith('.md'):
                            has_md = True
                    if ext == 'zip' and not has_md:
                        raise serializers.ValidationError({"file": "ZIP archive must contain at least one Markdown (.md) document (MinerU format)."})
            except serializers.ValidationError:
                raise
            except Exception as e:
                raise serializers.ValidationError({"file": f"Failed to inspect {ext.upper()} archive: {str(e)}"})
            finally:
                file.seek(0)

        # Truncate filename safely if > 80 chars to fit Django FileField max_length
        if len(filename) > 80:
            name_part = filename.rsplit('.', 1)[0]
            clean_name = re.sub(r'[^\w\s-]', '', name_part)[:70].strip()
            file.name = f"{clean_name or 'book'}.{ext}"

        attrs['format'] = ext

        # Auto-set title if blank
        if not attrs.get('title'):
            attrs['title'] = filename.rsplit('.', 1)[0][:200]

        return attrs
