import io
import zipfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from reader.books.models import Book
from reader.books.serializers import BookUploadSerializer


def make_upload(name, content=b'hello world', content_type='text/plain'):
    return SimpleUploadedFile(name, content, content_type=content_type)


class UploadValidationTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_rejects_unsupported_extension(self):
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.exe', b'MZ')}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('file', serializer.errors)

    def test_accepts_markdown(self):
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.md', b'# Title\n\nHello.')}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['format'], 'md')

    def test_accepts_zip_with_markdown(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('content.md', '# Title\n\nHello.')
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.zip', buffer.getvalue(), 'application/zip')}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['format'], 'zip')

    @override_settings(MAX_FILE_SIZE=10)
    def test_rejects_file_over_configured_limit(self):
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.txt', b'x' * 11)}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('file', serializer.errors)

    @override_settings(SUPPORTED_FORMATS=['txt'])
    def test_rejects_format_disabled_by_settings(self):
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.pdf', b'%PDF-1.4')}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('file', serializer.errors)

    def test_rejects_pdf_without_magic_bytes(self):
        serializer = BookUploadSerializer(
            data={'file': make_upload('book.pdf', b'not a pdf')}
        )
        self.assertFalse(serializer.is_valid())

    def test_upload_endpoint_returns_400_for_bad_format(self):
        response = self.client.post(
            '/api/books/', {'file': make_upload('book.exe', b'MZ')}, format='multipart'
        )
        self.assertEqual(response.status_code, 400)


class BookStatusTest(TestCase):
    def test_status_choices_use_ready(self):
        values = {choice[0] for choice in Book.STATUS_CHOICES}
        self.assertIn('ready', values)
        self.assertNotIn('completed', values)

    def test_process_book_sets_ready(self):
        book = Book.objects.create(
            title='T',
            format='txt',
            status='processing',
            file=SimpleUploadedFile('book.txt', b'Hello world.'),
        )
        parsed = [
            mock.Mock(
                index=0,
                title='Chapter 1',
                content='Hello world.',
                page_number=1,
                level=0,
            )
        ]
        with mock.patch('reader.books.views.BookParser.parse', return_value=parsed), \
             mock.patch('reader.books.views.SentenceSplitter.split', return_value=[]), \
             mock.patch('reader.books.views.LanguageDetector.detect', return_value='en'):
            from reader.books.views import BookViewSet

            BookViewSet().process_book(book)

        book.refresh_from_db()
        self.assertEqual(book.status, 'ready')
        self.assertIsNotNone(book.processed_at)
