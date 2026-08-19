# Books app views
import threading
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction, connection
from django.utils import timezone
from .models import Book, Chapter, Sentence
from .serializers import BookSerializer, BookUploadSerializer, ChapterSerializer, ChapterListSerializer
from .services import BookParser, SentenceSplitter


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    parser_classes = (MultiPartParser, FormParser)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BookUploadSerializer
        return BookSerializer

    def list(self, request, *args, **kwargs):
        """List all books and auto-fail any book stuck in 'processing' for > 3 minutes"""
        stuck_cutoff = timezone.now() - timezone.timedelta(minutes=3)
        Book.objects.filter(status='processing', created_at__lt=stuck_cutoff).update(
            status='failed', error_message='Ekstraksi memakan waktu terlalu lama / Gagal.'
        )
        return super().list(request, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = serializer.save(status='processing')
        
        # Start background processing thread so HTTP upload returns immediately!
        thread = threading.Thread(target=self._async_process, args=(book.id,))
        thread.daemon = True
        thread.start()
        
        return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)
    
    def _async_process(self, book_id: int):
        connection.close() # Ensure fresh DB connection for background thread
        try:
            book = Book.objects.get(id=book_id)
            self.process_book(book)
        except Exception as e:
            try:
                book = Book.objects.get(id=book_id)
                book.status = 'failed'
                book.error_message = str(e)
                book.save()
            except Exception:
                pass

    def process_book(self, book: Book):
        """Parse book file and create chapters/sentences using bulk_create (sub-2s)"""
        book.status = 'processing'
        book.save()
        
        file_path = book.file.path
        chapters_data = BookParser.parse(file_path, book.format)
        
        total_words = 0
        with transaction.atomic():
            # Clear old failed/partial chapters if re-processing
            book.chapters.all().delete()
            
            for ch_data in chapters_data:
                sentences_data = SentenceSplitter.split(ch_data.content)
                ch_word_count = len(ch_data.content.split())
                total_words += ch_word_count

                chapter = Chapter.objects.create(
                    book=book,
                    index=ch_data.index,
                    title=ch_data.title,
                    content=ch_data.content,
                    word_count=ch_word_count,
                    start_offset=0,
                    end_offset=len(ch_data.content),
                )
                
                sentences_to_create = [
                    Sentence(
                        chapter=chapter,
                        index=sent_data.index,
                        text=sent_data.text,
                        start_char=sent_data.start_char,
                        end_char=sent_data.end_char,
                        word_count=len(sent_data.text.split()),
                    )
                    for sent_data in sentences_data
                ]
                Sentence.objects.bulk_create(sentences_to_create, batch_size=1000)
            
            book.total_chapters = len(chapters_data)
            book.total_words = total_words
            book.status = 'completed'
            book.processed_at = timezone.now()
            book.save()

    @action(detail=True, methods=['get'])
    def chapter(self, request, pk=None):
        """Get specific chapter content by index"""
        index = request.query_params.get('index', 0)
        try:
            index = int(index)
        except ValueError:
            index = 0
        
        try:
            chapter = Chapter.objects.prefetch_related('sentences').get(book_id=pk, index=index)
            return Response(ChapterSerializer(chapter).data)
        except Chapter.DoesNotExist:
            return Response({'error': 'Chapter not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def toc(self, request, pk=None):
        """Get Table of Contents for book"""
        chapters = Chapter.objects.filter(book_id=pk).order_by('index')
        return Response(ChapterListSerializer(chapters, many=True).data)
